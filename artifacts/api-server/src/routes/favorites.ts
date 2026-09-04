import { Router } from "express";
import { db } from "@workspace/db";
import { favoritesTable, vendorsTable, categoriesTable, eventsTable } from "@workspace/db";
import { eq, and, desc, isNotNull, inArray } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

function formatFavoriteEvent(e: typeof eventsTable.$inferSelect, vendorName: string | null) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    city: e.city,
    state: e.state,
    venue: e.venue,
    language: e.language,
    eventDate: e.eventDate.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    imageUrl: e.imageUrl,
    ticketUrl: e.ticketUrl,
    additionalInfo: e.additionalInfo,
    vendorId: e.vendorId,
    vendorName,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const favorites = await db
    .select()
    .from(favoritesTable)
    .where(and(eq(favoritesTable.userId, user.id), isNotNull(favoritesTable.vendorId)))
    .orderBy(desc(favoritesTable.createdAt));

  const vendorIds = favorites.map((f) => f.vendorId).filter((id): id is number => id != null);
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

// Event favorites live under their own sub-path so they don't collide with
// the vendorId-keyed routes below - these must stay registered first, or
// Express would try to match "events" itself as a :vendorId param.
router.get("/events", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const favorites = await db
    .select()
    .from(favoritesTable)
    .where(and(eq(favoritesTable.userId, user.id), isNotNull(favoritesTable.eventId)))
    .orderBy(desc(favoritesTable.createdAt));

  const eventIds = favorites.map((f) => f.eventId).filter((id): id is number => id != null);
  if (eventIds.length === 0) {
    res.json([]);
    return;
  }

  const events = await db.select().from(eventsTable).where(inArray(eventsTable.id, eventIds));
  const vendorIds = [...new Set(events.map((e) => e.vendorId).filter((id): id is number => id != null))];
  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;

  // Preserve the same most-recently-favorited-first order as the favorites
  // rows, rather than whatever order the eventIds IN(...) query happens to
  // return them in.
  const eventMap: Record<number, typeof eventsTable.$inferSelect> = {};
  for (const e of events) eventMap[e.id] = e;
  const result = eventIds
    .map((id) => eventMap[id])
    .filter((e): e is typeof eventsTable.$inferSelect => e != null)
    .map((e) => formatFavoriteEvent(e, e.vendorId != null ? vendorMap[e.vendorId] ?? null : null));

  res.json(result);
});

router.post("/events/:eventId", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const eventId = parseInt(req.params.eventId);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid event ID" });
    return;
  }

  try {
    await db.insert(favoritesTable).values({ userId: user.id, eventId });
    res.status(201).json({ message: "Added to favorites" });
  } catch {
    res.status(400).json({ error: "Already in favorites" });
  }
});

router.delete("/events/:eventId", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const eventId = parseInt(req.params.eventId);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid event ID" });
    return;
  }

  await db.delete(favoritesTable).where(
    and(eq(favoritesTable.userId, user.id), eq(favoritesTable.eventId, eventId))
  );
  res.json({ message: "Removed from favorites" });
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
