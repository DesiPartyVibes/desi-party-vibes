import { Router } from "express";
import { db } from "@workspace/db";
import { favoritesTable, vendorsTable, categoriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const favorites = await db
    .select()
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, user.id))
    .orderBy(desc(favoritesTable.createdAt));

  const vendorIds = favorites.map((f) => f.vendorId);
  if (vendorIds.length === 0) {
    res.json([]);
    return;
  }

  const vendors = await db.select().from(vendorsTable).where(eq(vendorsTable.isActive, true));
  const categories = await db.select().from(categoriesTable);
  const catMap: Record<number, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  const favSet = new Set(vendorIds);
  const result = vendors
    .filter((v) => favSet.has(v.id))
    .map((v) => ({
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
    }));

  res.json(result);
});

router.post("/:vendorId", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const vendorId = parseInt(req.params.vendorId);
  if (isNaN(vendorId)) {
    res.status(400).json({ error: "Invalid vendor ID" });
    return;
  }

  try {
    await db.insert(favoritesTable).values({ userId: user.id, vendorId });
    res.status(201).json({ message: "Added to favorites" });
  } catch {
    res.status(400).json({ error: "Already in favorites" });
  }
});

router.delete("/:vendorId", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const vendorId = parseInt(req.params.vendorId);
  if (isNaN(vendorId)) {
    res.status(400).json({ error: "Invalid vendor ID" });
    return;
  }

  await db.delete(favoritesTable).where(
    and(eq(favoritesTable.userId, user.id), eq(favoritesTable.vendorId, vendorId))
  );
  res.json({ message: "Removed from favorites" });
});

export default router;
