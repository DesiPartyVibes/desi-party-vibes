import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A favorite points at either a vendor or an event, never both. vendorId was
// the only target originally; eventId is the equivalent for the Events
// feature, added later, so both are nullable. Postgres treats NULLs as
// distinct in a unique constraint, so a plain unique() on each pairing is
// enough - rows for one kind never collide with rows for the other kind.
export const favoritesTable = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vendorId: integer("vendor_id"),
  eventId: integer("event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.vendorId),
  unique().on(t.userId, t.eventId),
]);

export const insertFavoriteSchema = createInsertSchema(favoritesTable).omit({ id: true, createdAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoritesTable.$inferSelect;
