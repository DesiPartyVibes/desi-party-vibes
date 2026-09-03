import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // Freeform tag chosen from a fixed list on the submit form (cultural
  // festival, community gathering, concert/performance, religious/temple
  // event, vendor showcase, other) - not a foreign key, just a label like
  // the existing vendor category name would be if it weren't normalized.
  category: text("category").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  venue: text("venue"),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  imageUrl: text("image_url"),
  ticketUrl: text("ticket_url"),
  // Optional link to the submitting vendor's own listing, so a vendor's
  // event can show "Hosted by <business>" and link back to their profile.
  // Null for events not tied to any listing (e.g. a temple's Diwali mela).
  vendorId: integer("vendor_id"),
  submittedByUserId: integer("submitted_by_user_id").notNull(),
  // Every event starts pending and only becomes publicly visible once an
  // admin approves it - same moderation pattern as vendor_claims, since
  // anyone with a vendor account could otherwise post anything.
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  status: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
