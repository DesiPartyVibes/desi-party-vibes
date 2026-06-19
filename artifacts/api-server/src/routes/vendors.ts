import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, categoriesTable, reviewsTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

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
    const terms = search.trim().split(/\s+/).filter(Boolean);
    const termConditions = terms.map((term) =>
      or(
        ilike(vendorsTable.name, `%${term}%`),
        ilike(vendorsTable.description, `%${term}%`)
      )!
    );
    conditions.push(or(...termConditions)!);
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

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== "admin" && user.role !== "vendor")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = vendorInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [vendor] = await db.insert(vendorsTable).values({
    ...parsed.data,
    gallery: parsed.data.gallery ?? [],
    isActive: true,
    isFeatured: parsed.data.isFeatured ?? false,
  }).returning();

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, vendor.categoryId)).limit(1);

  res.status(201).json(formatVendor(vendor, cat?.name ?? ""));
});

router.patch("/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [vendor] = await db.update(vendorsTable).set(req.body).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, vendor.categoryId)).limit(1);
  res.json(formatVendor(vendor, cat?.name ?? ""));
});

router.delete("/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.json({ message: "Vendor deleted" });
});

export default router;
