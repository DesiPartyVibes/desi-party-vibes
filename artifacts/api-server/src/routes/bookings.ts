import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, vendorsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

async function formatBooking(b: typeof bookingsTable.$inferSelect) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, b.vendorId)).limit(1);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
  return {
    id: b.id,
    vendorId: b.vendorId,
    vendorName: vendor?.name ?? "",
    userId: b.userId,
    userName: user?.name ?? "",
    eventDate: b.eventDate,
    eventType: b.eventType,
    guestCount: b.guestCount,
    message: b.message,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, user.id))
    .orderBy(desc(bookingsTable.createdAt));

  const result = await Promise.all(bookings.map(formatBooking));
  res.json(result);
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const schema = z.object({
    vendorId: z.number().int(),
    eventDate: z.string(),
    eventType: z.string(),
    guestCount: z.number().int().min(1),
    message: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [booking] = await db.insert(bookingsTable).values({
    ...parsed.data,
    userId: user.id,
    status: "pending",
  }).returning();

  const formatted = await formatBooking(booking);
  res.status(201).json(formatted);
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

  const schema = z.object({
    status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [booking] = await db.update(bookingsTable).set({ status: parsed.data.status }).where(eq(bookingsTable.id, id)).returning();
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const formatted = await formatBooking(booking);
  res.json(formatted);
});

export default router;
