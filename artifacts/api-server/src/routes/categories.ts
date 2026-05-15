import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, vendorsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);

  const counts = await db
    .select({ categoryId: vendorsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(vendorsTable)
    .where(eq(vendorsTable.isActive, true))
    .groupBy(vendorsTable.categoryId);

  const countMap: Record<number, number> = {};
  for (const c of counts) countMap[c.categoryId] = c.count;

  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      description: c.description,
      vendorCount: countMap[c.id] ?? 0,
    }))
  );
});

export default router;
