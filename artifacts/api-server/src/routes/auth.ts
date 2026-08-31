import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, otpCodesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { extractSessionToken, getSessionUser } from "../lib/auth.js";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "desipartyhub_salt").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Short-lived, stateless "proof of OTP" grant handed back once a user
// confirms a profile-update OTP. The client must present it with the
// follow-up PATCH /profile or PATCH /theme-adjacent update call, so that
// endpoint doesn't have to be re-protected by a second OTP entry. It's just
// an HMAC over (userId, expiry) — no DB row needed, and it can't be replayed
// past its 10-minute window or reused by a different account.
const EDIT_GRANT_SECRET = process.env.EDIT_GRANT_SECRET || "desipartyhub_profile_edit_grant_secret";
const EDIT_GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateEditGrant(userId: number): string {
  const expiresAt = Date.now() + EDIT_GRANT_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", EDIT_GRANT_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyEditGrant(userId: number, token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [uidStr, expiresAtStr, sig] = decoded.split(".");
    if (!uidStr || !expiresAtStr || !sig) return false;
    if (Number(uidStr) !== userId) return false;
    if (Date.now() > Number(expiresAtStr)) return false;
    const expectedSig = crypto.createHmac("sha256", EDIT_GRANT_SECRET).update(`${uidStr}.${expiresAtStr}`).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
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

async function issueOtp(identifier: string, purpose: "signup" | "password_reset" | "login" | "profile_update"): Promise<string> {
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
  purpose: "signup" | "password_reset" | "login" | "profile_update",
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

  // Send a signup email-verification code. Unlike the earlier design, the
  // account is NOT logged in yet — no session is created here. The client
  // must confirm this code via POST /register/verify before receiving a
  // session cookie. We still await the send (rather than fire-and-forget)
  // so a delivery failure surfaces to the user immediately instead of
  // leaving them stuck on a "check your email" screen with no code coming.
  try {
    const code = await issueOtp(email, "signup");
    await sendEmail(
      email,
      "Verify your email for DesiPartyVibes",
      otpEmailHtml(firstName, "Your verification code is:", code)
    );
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send signup verification email");
    // The account exists but couldn't be sent a code — resend-email-otp lets
    // the client retry from the verification screen, so we don't fail the
    // whole registration over a transient email-provider hiccup.
  }

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      isRejected: !!user.rejectedAt,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      address: user.address,
      themePreference: user.themePreference,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// POST /api/auth/register/verify
// Confirms the signup OTP and — only on success — creates the session.
// This is the gate the earlier "log in immediately" design skipped.
router.post("/register/verify", async (req, res): Promise<void> => {
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

  if (!user.emailVerified) {
    const valid = await consumeOtp(email, "signup", parsed.data.code.trim());
    if (!valid) {
      res.status(400).json({ error: "That code is invalid or has expired. Please request a new one." });
      return;
    }
    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
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
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      emailVerified: true,
      isRejected: !!user.rejectedAt,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      address: user.address,
      themePreference: user.themePreference,
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
      purpose: z.enum(["signup", "password_reset", "login", "profile_update"]),
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
      : parsed.data.purpose === "login"
      ? "Your DesiPartyVibes login code"
      : parsed.data.purpose === "profile_update"
      ? "Your DesiPartyVibes account verification code"
      : "Your DesiPartyVibes password reset code";
  const intro =
    parsed.data.purpose === "signup"
      ? "Your verification code is:"
      : parsed.data.purpose === "login"
      ? "Your login code is:"
      : parsed.data.purpose === "profile_update"
      ? "Your verification code is:"
      : "Your password reset code is:";

  sendEmail(email, subject, otpEmailHtml(user.firstName || user.name, intro, code)).catch((err) =>
    logger.error({ err, email, purpose: parsed.data.purpose }, "Failed to resend OTP email")
  );

  res.json({ message: "A new code has been sent to your email." });
});

// POST /api/auth/login
// Checks the password, then emails a one-time code instead of creating a
// session directly. The session is only created once that code is confirmed
// via POST /login/verify below — this is an OTP-on-every-login requirement,
// distinct from the signup/forgot-password OTP flows.
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

  try {
    const code = await issueOtp(email, "login");
    await sendEmail(
      email,
      "Your DesiPartyVibes login code",
      otpEmailHtml(user.firstName || user.name, "Your login code is:", code)
    );
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send login verification email");
    res.status(500).json({ error: "Couldn't send a login code right now. Please try again." });
    return;
  }

  res.json({ requiresOtp: true, email: user.email });
});

// POST /api/auth/login/verify
// Confirms the login OTP and — only on success — creates the session.
router.post("/login/verify", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email(), code: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide your email and the login code" });
    return;
  }

  const email = parsed.data.email.trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  const valid = await consumeOtp(email, "login", parsed.data.code.trim());
  if (!valid) {
    res.status(400).json({ error: "That code is invalid or has expired. Please request a new one." });
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
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      isRejected: !!user.rejectedAt,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      address: user.address,
      themePreference: user.themePreference,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/logout", async (req, res): Promise<void> => {
  const token = extractSessionToken(req);
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.clearCookie("session_token");
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res): Promise<void> => {
  const token = extractSessionToken(req);
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
    isRejected: !!user.rejectedAt,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    themePreference: user.themePreference,
    createdAt: user.createdAt.toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Profile self-service: name / email / phone / address / password / avatar
// can all be changed from the My Profile page, but only after the user
// proves it's really them by entering a one-time code sent to their current
// email. request-otp sends that code; verify-otp checks it and hands back a
// short-lived edit grant; PATCH /profile applies whichever fields were
// submitted, gated on that grant. Theme preference is intentionally NOT
// gated behind OTP — it's a display setting, not account data, so it has
// its own unprotected PATCH /theme endpoint below.
// ─────────────────────────────────────────────────────────────────────────

// POST /api/auth/profile/request-otp
router.post("/profile/request-otp", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const code = await issueOtp(user.email, "profile_update");
    await sendEmail(
      user.email,
      "Your DesiPartyVibes account verification code",
      otpEmailHtml(user.firstName || user.name, "Use this code to confirm it's you before making changes to your account:", code)
    );
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send profile-update verification email");
    res.status(500).json({ error: "Couldn't send a verification code right now. Please try again." });
    return;
  }

  res.json({ message: "A verification code has been sent to your email." });
});

// POST /api/auth/profile/verify-otp
router.post("/profile/verify-otp", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ code: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide the verification code" });
    return;
  }

  const valid = await consumeOtp(user.email, "profile_update", parsed.data.code.trim());
  if (!valid) {
    res.status(400).json({ error: "That code is invalid or has expired. Please request a new one." });
    return;
  }

  res.json({ editGrant: generateEditGrant(user.id) });
});

const updateProfileSchema = z.object({
  editGrant: z.string().min(1),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  address: z.string().optional(),
  newPassword: z.string().min(8).optional(),
  avatarUrl: z.string().optional(),
});

// PATCH /api/auth/profile
router.patch("/profile", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  if (!verifyEditGrant(user.id, parsed.data.editGrant)) {
    res.status(401).json({ error: "Please verify a fresh code before making changes." });
    return;
  }

  const { name, email, phone, address, newPassword, avatarUrl } = parsed.data;

  if (email && email !== user.email) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "That email address is already in use." });
      return;
    }
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = normalisePhone(phone);
  if (address !== undefined) updates.address = address;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (newPassword) updates.passwordHash = hashPassword(newPassword);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No changes were submitted." });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isVerified: updated.isVerified,
    emailVerified: updated.emailVerified,
    isRejected: !!updated.rejectedAt,
    avatarUrl: updated.avatarUrl,
    phone: updated.phone,
    address: updated.address,
    themePreference: updated.themePreference,
    createdAt: updated.createdAt.toISOString(),
  });
});

// PATCH /api/auth/theme
// Deliberately not OTP-gated — this is a display preference, not sensitive
// account data, so it should switch instantly.
router.patch("/theme", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ theme: z.enum(["light", "dark", "system"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid theme value" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ themePreference: parsed.data.theme })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isVerified: updated.isVerified,
    emailVerified: updated.emailVerified,
    isRejected: !!updated.rejectedAt,
    avatarUrl: updated.avatarUrl,
    phone: updated.phone,
    address: updated.address,
    themePreference: updated.themePreference,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
