import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, phoneVerificationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { sendSms } from "../lib/sms";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "desipartyhub_salt").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Normalise phone: strip non-digits, prepend +1 if no country code
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

const sendOtpSchema = z.object({
  phone: z.string().min(7),
});

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(7),
  address: z.string().optional(),
  role: z.enum(["user", "vendor", "admin"]),
  otpCode: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res): Promise<void> => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }

  const phone = normalisePhone(parsed.data.phone);
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db.insert(phoneVerificationsTable).values({ phone, code, expiresAt });

  try {
    await sendSms(phone, `Your Desi Party Vibes verification code is: ${code}. It expires in 10 minutes.`);
    req.log.info({ phone }, "OTP sent");
  } catch (err) {
    req.log.error({ err, phone }, "Failed to send OTP SMS");
    res.status(500).json({ error: "Failed to send verification code" });
    return;
  }

  // In dev/no-Twilio mode, return the code so it can be displayed in the UI
  const devMode = !process.env.TWILIO_ACCOUNT_SID;
  res.json({ success: true, ...(devMode ? { devCode: code } : {}) });
});

// POST /api/auth/register
router.post("/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { firstName, lastName, email, password, phone: rawPhone, address, role, otpCode } = parsed.data;
  const phone = normalisePhone(rawPhone);
  const name = `${firstName} ${lastName}`.trim();

  // Verify OTP
  const now = new Date();
  const [verification] = await db
    .select()
    .from(phoneVerificationsTable)
    .where(
      and(
        eq(phoneVerificationsTable.phone, phone),
        eq(phoneVerificationsTable.code, otpCode),
        eq(phoneVerificationsTable.used, false),
        gt(phoneVerificationsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!verification) {
    res.status(400).json({ error: "Invalid or expired verification code" });
    return;
  }

  // Mark OTP used
  await db
    .update(phoneVerificationsTable)
    .set({ used: true })
    .where(eq(phoneVerificationsTable.id, verification.id));

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
    role,
    phone,
    address,
  }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.cookie("session_token", token, {
    httpOnly: true,
    expires: expiresAt,
    sameSite: "lax",
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
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
    sameSite: "lax",
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
