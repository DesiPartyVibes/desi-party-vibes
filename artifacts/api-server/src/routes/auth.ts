import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, otpCodesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "desipartyhub_salt").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Normalise phone: strip non-digits, prepend +1 if no country code
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

async function issueOtp(identifier: string, purpose: "signup" | "password_reset"): Promise<string> {
  const code = generateOtp();
  await db.insert(otpCodesTable).values({
    identifier,
    purpose,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return code;
}

async function consumeOtp(
  identifier: string,
  purpose: "signup" | "password_reset",
  code: string
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.identifier, identifier),
        eq(otpCodesTable.purpose, purpose),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false)
      )
    )
    .orderBy(desc(otpCodesTable.createdAt))
    .limit(1);

  if (!row) return false;
  if (row.expiresAt < new Date()) return false;

  await db.update(otpCodesTable).set({ used: true }).where(eq(otpCodesTable.id, row.id));
  return true;
}

function otpEmailHtml(greetingName: string, intro: string, code: string): string {
  return `<p>Hi ${greetingName},</p><p>${intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in 15 minutes.</p><p>— The DesiPartyVibes Team</p>`;
}

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(7),
  address: z.string().optional(),
  role: z.enum(["user", "vendor"]).default("user"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post("/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { firstName, lastName, email, password, phone: rawPhone, address, role } = parsed.data;
  const phone = normalisePhone(rawPhone);
  const name = `${firstName} ${lastName}`.trim();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    firstName,
    lastName,
    email,
    passwordHash: hashPassword(password),
    role, // restricted to "user" | "vendor" by registerSchema — "admin" is rejected at parse time
    isVerified: role !== "vendor", // vendors start pending admin approval; users don't need review
    phone,
    address,
  }).returning();

  if (role === "vendor") {
    // Fire-and-forget: a slow/misconfigured email provider should never block registration.
    sendEmail(
      email,
      "Your DesiPartyVibes vendor account is pending review",
      `<p>Hi ${firstName},</p><p>Thanks for signing up as a vendor on DesiPartyVibes! Your account is currently <strong>pending verification</strong>. Our team will review your application, and you'll receive another email as soon as you're approved and live on the marketplace.</p><p>— The DesiPartyVibes Team</p>`
    ).catch((err) => logger.error({ err, userId: user.id }, "Failed to send vendor pending-verification email"));
  }

  // Fire-and-forget: send a signup email-verification code. Verifying is not
  // required to use the account — it's surfaced as a dismissible prompt in
  // the app (see /verify-email) rather than blocking login.
  issueOtp(email, "signup")
    .then((code) =>
      sendEmail(
        email,
        "Verify your email for DesiPartyVibes",
        otpEmailHtml(firstName, "Your verification code is:", code)
      )
    )
    .catch((err) => logger.error({ err, userId: user.id }, "Failed to send signup verification email"));

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.cookie("session_token", token, {
    httpOnly: true,
    expires: expiresAt,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// POST /api/auth/forgot-password/request
// Sends a one-time code to the account's email. Replaces the previous
// direct-reset endpoint (no verification step) with a real OTP flow.
router.post("/forgot-password/request", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  const email = parsed.data.email.trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  const code = await issueOtp(email, "password_reset");
  sendEmail(
    email,
    "Your DesiPartyVibes password reset code",
    otpEmailHtml(user.firstName || user.name, "Your password reset code is:", code)
  ).catch((err) => logger.error({ err, email }, "Failed to send password reset email"));

  res.json({ message: "A reset code has been sent to your email." });
});

// POST /api/auth/forgot-password/confirm
router.post("/forgot-password/confirm", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      email: z.string().email(),
      code: z.string().min(4),
      newPassword: z.string().min(6),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide your email, the code, and a new password" });
    return;
  }

  const email = parsed.data.email.trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  const valid = await consumeOtp(email, "password_reset", parsed.data.code.trim());
  if (!valid) {
    res.status(400).json({ error: "That code is invalid or has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(parsed.data.newPassword) })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Your password has been reset. You can now log in." });
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email(), code: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide your email and the verification code" });
    return;
  }

  const email = parsed.data.email.trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  if (user.emailVerified) {
    res.json({ emailVerified: true });
    return;
  }

  const valid = await consumeOtp(email, "signup", parsed.data.code.trim());
  if (!valid) {
    res.status(400).json({ error: "That code is invalid or has expired. Please request a new one." });
    return;
  }

  await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
  res.json({ emailVerified: true });
});

// POST /api/auth/resend-email-otp
router.post("/resend-email-otp", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      email: z.string().email(),
      purpose: z.enum(["signup", "password_reset"]),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide a valid email and purpose" });
    return;
  }

  const email = parsed.data.email.trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  if (parsed.data.purpose === "signup" && user.emailVerified) {
    res.json({ message: "Your email is already verified." });
    return;
  }

  const code = await issueOtp(email, parsed.data.purpose);
  const subject =
    parsed.data.purpose === "signup"
      ? "Verify your email for DesiPartyVibes"
      : "Your DesiPartyVibes password reset code";
  const intro =
    parsed.data.purpose === "signup" ? "Your verification code is:" : "Your password reset code is:";

  sendEmail(email, subject, otpEmailHtml(user.firstName || user.name, intro, code)).catch((err) =>
    logger.error({ err, email, purpose: parsed.data.purpose }, "Failed to resend OTP email")
  );

  res.json({ message: "A new code has been sent to your email." });
});

router.post("/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.cookie("session_token", token, {
    httpOnly: true,
    expires: expiresAt,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.session_token;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    res.clearCookie("session_token");
  }
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res): Promise<void> => {
  const token = req.cookies?.session_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
