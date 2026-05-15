import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, vendorsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, avg, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res): Promise<void> => {
  const vendorId = parseInt(req.params.id);
  if (isNaN(vendorId)) {
    res.status(400).json({ error: "Invalid vendor ID" });
    return;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.vendorId, vendorId))
    .orderBy(desc(reviewsTable.createdAt));

  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap: Record<number, { name: string; avatarUrl: string | null }> = {};
  for (const u of users) userMap[u.id] = { name: u.name, avatarUrl: u.avatarUrl };

  res.json(
    reviews.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      userId: r.userId,
      userName: userMap[r.userId]?.name ?? "Anonymous",
      userAvatarUrl: userMap[r.userId]?.avatarUrl ?? null,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const vendorId = parseInt(req.params.id);
  if (isNaN(vendorId)) {
    res.status(400).json({ error: "Invalid vendor ID" });
    return;
  }

  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    vendorId,
    userId: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  }).returning();

  // Recompute vendor rating
  const agg = await db
    .select({ avg: avg(reviewsTable.rating), count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .where(eq(reviewsTable.vendorId, vendorId));

  const newRating = parseFloat(agg[0].avg ?? "0");
  const newCount = agg[0].count;
  await db.update(vendorsTable).set({ rating: newRating, reviewCount: newCount }).where(eq(vendorsTable.id, vendorId));

  res.status(201).json({
    id: review.id,
    vendorId: review.vendorId,
    userId: review.userId,
    userName: user.name,
    userAvatarUrl: user.avatarUrl,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  });
});

export default router;
