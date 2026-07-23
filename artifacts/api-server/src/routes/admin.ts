import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, usersTable, bookingsTable, reviewsTable, categoriesTable } from "@workspace/db";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/vendors", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const vendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt));
  const categories = await db.select().from(categoriesTable);
  const catMap: Record<number, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  res.json(
    vendors.map((v) => ({
      id: v.id,
      name: v.name,
      categoryId: v.categoryId,
      categoryName: catMap[v.categoryId] ?? "",
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
    }))
  );
});

router.get("/bookings", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));

  const vendorIds = [...new Set(bookings.map((b) => b.vendorId))];
  const userIds = [...new Set(bookings.map((b) => b.userId))];

  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;
  const userMap: Record<number, string> = {};
  for (const u of users) userMap[u.id] = u.name;

  res.json(
    bookings.map((b) => ({
      id: b.id,
      vendorId: b.vendorId,
      vendorName: vendorMap[b.vendorId] ?? "",
      userId: b.userId,
      userName: userMap[b.userId] ?? "",
      eventDate: b.eventDate,
      eventType: b.eventType,
      guestCount: b.guestCount,
      message: b.message,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    }))
  );
});

router.get("/users", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isVerified: u.isVerified,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

router.patch("/users/:id/verify", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role !== "vendor") {
    res.status(400).json({ error: "Only vendor accounts can be verified" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isVerified: true })
    .where(eq(usersTable.id, id))
    .returning();

  res.json({ id: updated.id, isVerified: updated.isVerified });
});

router.get("/stats", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const [totalVendors] = await db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable);
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [totalBookings] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable);
  const [pendingBookings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(eq(bookingsTable.status, "pending"));
  const [totalReviews] = await db.select({ count: sql<number>`count(*)::int` }).from(reviewsTable);

  const vendorsByCategory = await db
    .select({
      category: categoriesTable.name,
      count: sql<number>`count(${vendorsTable.id})::int`,
    })
    .from(categoriesTable)
    .leftJoin(vendorsTable, eq(vendorsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.name)
    .orderBy(sql`count(${vendorsTable.id}) desc`);

  res.json({
    totalVendors: totalVendors.count,
    totalUsers: totalUsers.count,
    totalBookings: totalBookings.count,
    pendingBookings: pendingBookings.count,
    totalReviews: totalReviews.count,
    vendorsByCategory,
  });
});

export default router;
