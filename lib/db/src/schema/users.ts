import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "vendor", "admin"] }).notNull().default("user"),
  isVerified: boolean("is_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  address: text("address"),
  themePreference: text("theme_preference", { enum: ["light", "dark", "system"] }).notNull().default("system"),
  // Gates the non-critical status-update emails (vendor approved/rejected,
  // claim approved/rejected). OTP/security codes are never gated by this --
  // they're sent regardless, since disabling them would break login/signup/
  // password-reset/profile-edit flows that depend on the user receiving them.
  emailNotifications: boolean("email_notifications").notNull().default(true),
  // Whether this user's name/avatar show on the public reviews they've
  // left, vs "Anonymous". Defaults to visible, matching current behavior.
  reviewsArePublic: boolean("reviews_are_public").notNull().default(true),
  // Self-service "pause my account" -- a disabled account can't log in
  // (except that a successful login, which requires the password AND an
  // emailed OTP, automatically reactivates it). Distinct from rejectedAt
  // (admin-driven vendor rejection) and deletedAt (permanent).
  accountStatus: text("account_status", { enum: ["active", "disabled"] }).notNull().default("active"),
  // Soft-delete marker. Deleted accounts are scrubbed of personal data
  // (see DELETE /auth/account) rather than hard-deleted, since bookings,
  // reviews, and vendor claims reference the user row.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
