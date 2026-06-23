import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const phoneVerificationsTable = pgTable("phone_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
