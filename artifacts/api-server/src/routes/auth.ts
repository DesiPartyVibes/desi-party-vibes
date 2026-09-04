import { Router, Request } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, otpCodesTable, vendorsTable } from "@workspace/db";
import { eq, and, ne, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { extractSessionToken, getSessionUser, generateEditGrant, verifyEditGrant } from "../lib/auth.js";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "desipartyhub_salt").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Creates a session row and captures the request's user-agent/IP so the
// Manage Sessions screen can show roughly what device each one belongs to.
// req.ip depends on Express's trust proxy setting; behind Railway's proxy
// this resolves to the real client IP once trust proxy is configured, and
// falls back to the proxy's IP (still useful, just less precise) otherwise.
async function createSession(req: Request, userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  await db.insert(sessionsTable).values({
    userId,
    token,
    expiresAt,
    userAgent: req.headers["user-agent"] || null,
    ipAddress: req.ip || null,
    lastUsedAt: now,
  });
  return { token, expiresAt };
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
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
    emailNotifications: user.emailNotifications,
    reviewsArePublic: user.reviewsArePublic,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
  };
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
  // Enforced server-side too, not just as a UI gate, so the requirement
  // can't be bypassed by calling the API directly.
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Privacy Policy and Terms of Service" }),
  }),
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

  res.status(201).json({ user: formatUser(user) });
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
    user.emailVerified = true;
  }

  const { token, expiresAt } = await createSession(req, user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    expires: expiresAt,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.json({ token, user: formatUser(user) });
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
  // Deleted accounts are treated the same as "no account" — the row still
  // exists (soft delete) but should behave as if it doesn't for login.
  if (!user || user.deletedAt || user.passwordHash !== hashPassword(password)) {
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

  // A successful login (password + emailed OTP) is proof enough that it's
  // really the account owner, so a self-disabled account is automatically
  // reactivated here rather than requiring a separate "reactivate" step.
  if (user.accountStatus === "disabled") {
    await db.update(usersTable).set({ accountStatus: "active" }).where(eq(usersTable.id, user.id));
    user.accountStatus = "active";
  }

  const { token, expiresAt } = await createSession(req, user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    expires: expiresAt,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.json({ token, user: formatUser(user) });
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
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(formatUser(user));
});

// ─────────────────────────────────────────────────────────────────────────
// Profile self-service: name / email / phone / address / password / avatar
// can all be changed from the My Profile page, but only after the user
// proves it's really them by entering a one-time code sent to their current
// email. request-otp sends that code; verify-otp checks it and hands back a
// short-lived edit grant; PATCH /profile applies whichever fields were
// submitted, gated on that grant. Theme preference is intentionally NOT
// gated behind OTP — it's a display setting, not account data, so it has
// its own unprotected PATCH /theme endpoint below. Email preferences and
// privacy are the same story — display/notification settings, not account
// data — while account status and deletion reuse this same edit-grant gate
// since those are as sensitive as editing the profile itself.
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

  res.json(formatUser(updated));
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

  res.json(formatUser(updated));
});

// PATCH /api/auth/email-preferences
// Not OTP-gated, same reasoning as theme. This only controls the
// non-critical status-update emails (vendor approval, claim decisions,
// etc.) — OTP/security codes always send regardless of this setting, so
// there's no toggle for those.
router.patch("/email-preferences", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ emailNotifications: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ emailNotifications: parsed.data.emailNotifications })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(formatUser(updated));
});

// PATCH /api/auth/privacy
// Not OTP-gated — a visibility preference, not account data.
router.patch("/privacy", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ reviewsArePublic: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ reviewsArePublic: parsed.data.reviewsArePublic })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(formatUser(updated));
});

// ─────────────────────────────────────────────────────────────────────────
// Session management: list/revoke the sessions (devices/browsers) currently
// signed in to this account.
// ─────────────────────────────────────────────────────────────────────────

// GET /api/auth/sessions
router.get("/sessions", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentToken = extractSessionToken(req);
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, user.id))
    .orderBy(desc(sessionsTable.lastUsedAt));

  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: (s.lastUsedAt ?? s.createdAt).toISOString(),
      isCurrent: s.token === currentToken,
    })),
  });
});

// DELETE /api/auth/sessions/:id — revoke a single session by ID. Scoped to
// the caller's own sessions so one account can't revoke another's.
router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  await db.delete(sessionsTable).where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, user.id)));
  res.json({ message: "Session revoked." });
});

// DELETE /api/auth/sessions — "Sign out of all other devices": revokes
// every session for this account except the one making the request.
router.delete("/sessions", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentToken = extractSessionToken(req);
  await db
    .delete(sessionsTable)
    .where(
      currentToken
        ? and(eq(sessionsTable.userId, user.id), ne(sessionsTable.token, currentToken))
        : eq(sessionsTable.userId, user.id)
    );

  res.json({ message: "Signed out of all other devices." });
});

// ─────────────────────────────────────────────────────────────────────────
// Account status: temporarily disable (and auto-reactivate on next
// successful login) or permanently delete an account. Both reuse the same
// edit-grant gate as PATCH /profile — a fresh OTP is required first.
// ─────────────────────────────────────────────────────────────────────────

// PATCH /api/auth/account/status
router.patch("/account/status", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ editGrant: z.string().min(1), status: z.enum(["active", "disabled"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (!verifyEditGrant(user.id, parsed.data.editGrant)) {
    res.status(401).json({ error: "Please verify a fresh code before making changes." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ accountStatus: parsed.data.status })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (parsed.data.status === "disabled") {
    // Disabling signs the account out everywhere, including this device —
    // reactivating requires logging back in (password + emailed OTP),
    // which doubles as proof it's really the account owner doing it.
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
    res.clearCookie("session_token");
  }

  res.json(formatUser(updated));
});

// DELETE /api/auth/account
// Soft-delete: the row stays (bookings/reviews/vendor claims reference it)
// but is scrubbed of personal data and its email is freed up for reuse.
router.delete("/account", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = z.object({ editGrant: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (!verifyEditGrant(user.id, parsed.data.editGrant)) {
    res.status(401).json({ error: "Please verify a fresh code before making changes." });
    return;
  }

  const anonymizedEmail = `deleted-${user.id}-${Date.now()}@deleted.desipartyvibes.local`;
  await db
    .update(usersTable)
    .set({
      deletedAt: new Date(),
      name: "Deleted User",
      firstName: null,
      lastName: null,
      email: anonymizedEmail,
      passwordHash: crypto.randomBytes(32).toString("hex"),
      phone: null,
      address: null,
      avatarUrl: null,
    })
    .where(eq(usersTable.id, user.id));

  // A deleted vendor's listing(s) shouldn't stay visible on the marketplace.
  if (user.role === "vendor") {
    await db.update(vendorsTable).set({ isActive: false }).where(eq(vendorsTable.userId, user.id));
  }

  await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
  res.clearCookie("session_token");
  res.json({ message: "Your account has been deleted." });
});

export default router;
