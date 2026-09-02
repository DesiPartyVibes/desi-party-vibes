import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, categoriesTable, reviewsTable, vendorClaimsTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser, verifyEditGrant } from "../lib/auth.js";

const router = Router();

function formatVendor(v: typeof vendorsTable.$inferSelect, categoryName: string) {
  return {
    id: v.id,
    name: v.name,
    categoryId: v.categoryId,
    categoryName,
    city: v.city,
    state: v.state,
    description: v.description,
    priceMin: v.priceMin,
    priceMax: v.priceMax,
    rating: v.rating,
    reviewCount: v.reviewCount,
    imageUrl: v.imageUrl,
    gallery: v.gallery,
    phone: v.phone,
    email: v.email,
    website: v.website,
    isActive: v.isActive,
    isFeatured: v.isFeatured,
    isClaimed: v.userId != null,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const querySchema = z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    minRating: z.coerce.number().optional(),
    search: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(12),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { category, city, minPrice, maxPrice, minRating, search, page, limit } = parsed.data;

  const conditions = [eq(vendorsTable.isActive, true)];

  if (city) conditions.push(ilike(vendorsTable.city, `%${city}%`));
  if (minPrice !== undefined) conditions.push(gte(vendorsTable.priceMin, minPrice));
  if (maxPrice !== undefined) conditions.push(lte(vendorsTable.priceMax, maxPrice));
  if (minRating !== undefined) conditions.push(gte(vendorsTable.rating, minRating));
  if (search) {
    const terms = search.trim().split(/\s+/).filter((t) => t.length >= 2);
    const searchTerms = terms.length > 0 ? terms : [search.trim()];
    const termConditions = searchTerms.map((term) =>
      or(
        ilike(vendorsTable.name, `%${term}%`),
        ilike(vendorsTable.description, `%${term}%`)
      )!
    );
    conditions.push(and(...termConditions)!);
  }

  if (category) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, category)).limit(1);
    if (cat) conditions.push(eq(vendorsTable.categoryId, cat.id));
  }

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorsTable)
    .where(and(...conditions));
  const total = totalResult[0].count;

  const vendors = await db
    .select()
    .from(vendorsTable)
    .where(and(...conditions))
    .orderBy(desc(vendorsTable.rating))
    .limit(limit)
    .offset((page - 1) * limit);

  const categories = await db.select().from(categoriesTable);
  const catMap: Record<number, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  res.json({
    vendors: vendors.map((v) => formatVendor(v, catMap[v.categoryId] ?? "")),
    total,
    page,
    limit,
  });
});

router.get("/featured", async (req, res): Promise<void> => {
  const vendors = await db
    .select()
    .from(vendorsTable)
    .where(and(eq(vendorsTable.isFeatured, true), eq(vendorsTable.isActive, true)))
    .orderBy(desc(vendorsTable.rating))
    .limit(8);

  const categories = await db.select().from(categoriesTable);
  const catMap: Record<number, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  res.json(vendors.map((v) => formatVendor(v, catMap[v.categoryId] ?? "")));
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid vendor ID" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id)).limit(1);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, vendor.categoryId)).limit(1);

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.vendorId, id))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(20);

  const { usersTable } = await import("@workspace/db");
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap: Record<number, { name: string; avatarUrl: string | null }> = {};
  for (const u of users) userMap[u.id] = { name: u.name, avatarUrl: u.avatarUrl };

  res.json({
    ...formatVendor(vendor, cat?.name ?? ""),
    longDescription: vendor.longDescription,
    reviews: reviews.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      userId: r.userId,
      userName: userMap[r.userId]?.name ?? "Anonymous",
      userAvatarUrl: userMap[r.userId]?.avatarUrl ?? null,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

const vendorInputSchema = z.object({
  name: z.string().min(1),
  categoryId: z.number().int(),
  city: z.string().min(1),
  state: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().optional(),
  priceMin: z.number().int(),
  priceMax: z.number().int(),
  imageUrl: z.string().url(),
  gallery: z.array(z.string()).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  isFeatured: z.boolean().optional(),
});

// A vendor self-registering their own listing must provide real contact
// details (mirrors the required fields on the Register Your Business form).
// Admin-created listings go through vendorInputSchema above and keep
// phone/email optional.
const vendorSelfInputSchema = vendorInputSchema.extend({
  phone: z.string().trim().min(7, "Phone number is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== "admin" && user.role !== "vendor")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (user.role === "vendor" && !user.isVerified) {
    res.status(403).json({ error: "Your vendor account is pending admin approval" });
    return;
  }

  const schema = user.role === "vendor" ? vendorSelfInputSchema : vendorInputSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const [vendor] = await db.insert(vendorsTable).values({
    ...parsed.data,
    gallery: parsed.data.gallery ?? [],
    isActive: true,
    // Self-featuring stays an admin-only lever.
    isFeatured: user.role === "admin" ? (parsed.data.isFeatured ?? false) : false,
    // A vendor registering their own business owns it immediately.
    // Admin-created listings stay unclaimed until a vendor claims them
    // through POST /vendor-claims.
    userId: user.role === "vendor" ? user.id : null,
  }).returning();

  if (user.role === "vendor") {
    // vendor-dashboard.tsx (and everywhere else) treats an approved row in
    // vendor_claims as "this is the vendor's business" rather than checking
    // vendors.userId directly, so a self-registered listing needs the same
    // auto-approved claim record a reviewed claim would get.
    await db.insert(vendorClaimsTable).values({
      vendorId: vendor.id,
      userId: user.id,
      status: "approved",
      note: "Auto-approved: vendor self-registered this listing.",
      reviewedAt: new Date(),
    });
  }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, vendor.categoryId)).limit(1);

  res.status(201).json(formatVendor(vendor, cat?.name ?? ""));
});

// Fields a vendor is allowed to edit on their own listing. isFeatured,
// userId, rating, and reviewCount stay admin-only levers - unknown keys are
// stripped by zod's default "strip" behavior, so this schema doubles as the
// allowlist. isActive is owner-settable (added for the profile page's
// "temporarily disable my business" control) so a vendor can pull their own
// listing from public view without needing an admin.
const vendorSelfUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.number().int().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  longDescription: z.string().optional(),
  priceMin: z.number().int().optional(),
  priceMax: z.number().int().optional(),
  imageUrl: z.string().url().optional(),
  gallery: z.array(z.string()).optional(),
  // Phone/email stay required (not just required-if-present) for a vendor's
  // own listing, matching the Edit Your Listing form and self-registration.
  phone: z.string().trim().min(7, "Phone number is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  website: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.patch("/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const isAdmin = user.role === "admin";
  let isOwner = false;
  if (!isAdmin) {
    const [claim] = await db
      .select()
      .from(vendorClaimsTable)
      .where(
        and(
          eq(vendorClaimsTable.vendorId, id),
          eq(vendorClaimsTable.userId, user.id),
          eq(vendorClaimsTable.status, "approved")
        )
      )
      .limit(1);
    isOwner = !!claim;
  }

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let updateData: Record<string, unknown>;
  if (isAdmin) {
    updateData = req.body;
  } else {
    const parsed = vendorSelfUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }
    updateData = parsed.data;
  }

  const [vendor] = await db.update(vendorsTable).set(updateData).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, vendor.categoryId)).limit(1);
  res.json(formatVendor(vendor, cat?.name ?? ""));
});

// Vendor owners may permanently delete their own business listing, but
// only with a valid profile-edit OTP grant (the same "prove it's you" flow
// used for account changes) -- this is a destructive, irreversible action
// so it gets the same gating as deleting the account itself. Admins can
// still delete any listing outright, no grant required.
router.delete("/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const [claim] = await db
      .select()
      .from(vendorClaimsTable)
      .where(
        and(
          eq(vendorClaimsTable.vendorId, id),
          eq(vendorClaimsTable.userId, user.id),
          eq(vendorClaimsTable.status, "approved")
        )
      )
      .limit(1);
    const isOwner = !!claim;

    if (!isOwner) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const editGrant = typeof req.body?.editGrant === "string" ? req.body.editGrant : undefined;
    if (!verifyEditGrant(user.id, editGrant)) {
      res.status(403).json({ error: "This action requires a valid verification code. Please verify your identity again." });
      return;
    }
  }

  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.json({ message: "Vendor deleted" });
});

export default router;
