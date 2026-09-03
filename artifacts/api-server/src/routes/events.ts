import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, vendorsTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, asc, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

function formatEvent(e: typeof eventsTable.$inferSelect, vendorName: string | null) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    city: e.city,
    state: e.state,
    venue: e.venue,
    eventDate: e.eventDate.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    imageUrl: e.imageUrl,
    ticketUrl: e.ticketUrl,
    vendorId: e.vendorId,
    vendorName,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
  };
}

async function attachVendorNames(rows: (typeof eventsTable.$inferSelect)[]) {
  const vendorIds = [...new Set(rows.map((r) => r.vendorId).filter((id): id is number => id != null))];
  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;
  return rows.map((r) => formatEvent(r, r.vendorId != null ? vendorMap[r.vendorId] ?? null : null));
}

// Public: only approved, upcoming-or-past events are ever returned here -
// pending/rejected submissions stay invisible until an admin reviews them
// (mirrors how an unverified vendor listing never shows on /vendors).
router.get("/", async (req, res): Promise<void> => {
  const querySchema = z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    search: z.string().optional(),
    upcoming: z.coerce.boolean().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(12),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { category, city, state, search, upcoming, page, limit } = parsed.data;

  const conditions = [eq(eventsTable.status, "approved")];

  if (category) conditions.push(eq(eventsTable.category, category));
  if (city) conditions.push(ilike(eventsTable.city, `%${city}%`));
  if (state) conditions.push(ilike(eventsTable.state, `%${state}%`));
  if (upcoming) conditions.push(gte(eventsTable.eventDate, new Date()));
  if (search) {
    const term = `%${search.trim()}%`;
    conditions.push(or(ilike(eventsTable.title, term), ilike(eventsTable.description, term))!);
  }

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(...conditions));
  const total = totalResult[0].count;

  const events = await db
    .select()
    .from(eventsTable)
    .where(and(...conditions))
    .orderBy(asc(eventsTable.eventDate))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    events: await attachVendorNames(events),
    total,
    page,
    limit,
  });
});

// A short "what's coming up nationwide" list for the homepage teaser.
router.get("/upcoming", async (req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.status, "approved"), gte(eventsTable.eventDate, new Date())))
    .orderBy(asc(eventsTable.eventDate))
    .limit(4);

  res.json(await attachVendorNames(events));
});

// A vendor's own submissions, any status, so they can see what's pending,
// approved, or rejected - not filtered to just their linked business, since
// a vendor may submit events unrelated to their own listing too.
router.get("/mine", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.submittedByUserId, user.id))
    .orderBy(sql`${eventsTable.createdAt} desc`);

  res.json(await attachVendorNames(events));
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid event ID" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Only the submitter or an admin may view a pending/rejected event; it's
  // effectively invisible to everyone else until approved.
  if (event.status !== "approved") {
    const user = await getSessionUser(req);
    const isOwner = !!user && user.id === event.submittedByUserId;
    const isAdmin = !!user && user.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
  }

  const [formatted] = await attachVendorNames([event]);
  res.json(formatted);
});

const eventInputSchema = z.object({
  title: z.string().min(3, "Give the event a title"),
  description: z.string().min(10, "Add a short description (10+ characters)"),
  category: z.string().min(1, "Choose a category"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  venue: z.string().optional(),
  eventDate: z.string().min(1, "Event date is required"),
  endDate: z.string().optional(),
  imageUrl: z.string().optional(),
  ticketUrl: z.string().optional(),
  vendorId: z.number().int().optional(),
});

// Only vendor accounts can submit events, and only once their vendor
// account itself has been approved by an admin - same gate used before a
// vendor can create a business listing. Every submission starts pending
// regardless of who submits it.
router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || user.role !== "vendor") {
    res.status(403).json({ error: "Only vendor accounts can submit events" });
    return;
  }
  if (!user.isVerified) {
    res.status(403).json({ error: "Your vendor account is pending admin approval" });
    return;
  }

  const parsed = eventInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const eventDate = new Date(parsed.data.eventDate);
  if (isNaN(eventDate.getTime())) {
    res.status(400).json({ error: "Invalid event date" });
    return;
  }
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : undefined;
  if (endDate && isNaN(endDate.getTime())) {
    res.status(400).json({ error: "Invalid end date" });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      city: parsed.data.city,
      state: parsed.data.state,
      venue: parsed.data.venue || null,
      eventDate,
      endDate: endDate ?? null,
      imageUrl: parsed.data.imageUrl || null,
      ticketUrl: parsed.data.ticketUrl || null,
      vendorId: parsed.data.vendorId ?? null,
      submittedByUserId: user.id,
    })
    .returning();

  const [formatted] = await attachVendorNames([event]);
  res.status(201).json(formatted);
});

// A submitter may withdraw their own event any time before it's approved
// (or after rejection); once approved, only an admin can remove it, since
// it's already public and other people may be relying on it.
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

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  const isOwner = event.submittedByUserId === user.id;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isAdmin && event.status === "approved") {
    res.status(403).json({ error: "This event is already live - please contact support to remove it" });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  res.json({ message: "Event deleted" });
});

export default router;
