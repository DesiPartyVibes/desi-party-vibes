import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, categoriesTable, usersTable, bookingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/homepage", async (req, res): Promise<void> => {
  const [vendors] = await db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable).where(eq(vendorsTable.isActive, true));
  const [categories] = await db.select({ count: sql<number>`count(*)::int` }).from(categoriesTable);
  const [bookings] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable);
  const cities = await db.selectDistinct({ city: vendorsTable.city }).from(vendorsTable).where(eq(vendorsTable.isActive, true));

  res.json({
    totalVendors: vendors.count,
    totalCategories: categories.count,
    totalCities: cities.length,
    totalBookings: bookings.count,
  });
});

router.get("/cities", async (req, res): Promise<void> => {
  const result = await db
    .select({
      city: vendorsTable.city,
      state: vendorsTable.state,
      count: sql<number>`count(*)::int`,
    })
    .from(vendorsTable)
    .where(eq(vendorsTable.isActive, true))
    .groupBy(vendorsTable.city, vendorsTable.state)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  res.json(result);
});

export default router;
