import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

// Generic email OTP store, used for both signup email verification and
// password-reset codes. `identifier` is always an email address today;
// named generically in case SMS-based OTPs are added later.
export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  identifier: text("identifier").notNull(),
  purpose: text("purpose", { enum: ["signup", "password_reset"] }).notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OtpCode = typeof otpCodesTable.$inferSelect;
