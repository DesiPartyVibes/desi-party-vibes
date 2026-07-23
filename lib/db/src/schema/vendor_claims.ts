import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorClaimsTable = pgTable("vendor_claims", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertVendorClaimSchema = createInsertSchema(vendorClaimsTable).omit({ id: true, createdAt: true, reviewedAt: true, status: true });
export type InsertVendorClaim = z.infer<typeof insertVendorClaimSchema>;
export type VendorClaim = typeof vendorClaimsTable.$inferSelect;
