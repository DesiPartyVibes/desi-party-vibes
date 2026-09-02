import { Request } from "express";
import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db";
import crypto from "crypto";

// The frontend is served from a different origin than the API (Railway
// deployments on separate domains), so session identification can't rely
// solely on the `session_token` cookie: browsers increasingly restrict or
// block cookies set by a cross-site fetch/XHR response (third-party cookie
// blocking), which silently drops the session even though the request
// itself succeeded. As a robust fallback, clients may instead send the
// token returned in the login/verify response body as a bearer token.
// Bearer token takes priority when present; cookie is the fallback for any
// caller that only sends the cookie.
export function extractSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice("Bearer ".length).trim();
    if (bearer) return bearer;
  }
  return req.cookies?.session_token;
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const token = extractSessionToken(req);
  if (!token) return null;

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (!session || session.expiresAt < new Date()) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user || user.deletedAt) return null;
  return user;
}


// Short-lived, stateless "proof of OTP" grant handed back once a user
// confirms a profile-update OTP. The client must present it with a
// follow-up sensitive update (profile edit, theme-adjacent account
// changes, or a vendor deleting their own business listing), so those
// endpoints don't have to be re-protected by a second OTP entry. It's just
// an HMAC over (userId, expiry) -- no DB row needed, and it can't be
// replayed past its 10-minute window or reused by a different account.
const EDIT_GRANT_SECRET = process.env.EDIT_GRANT_SECRET || "desipartyhub_profile_edit_grant_secret";
const EDIT_GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateEditGrant(userId: number): string {
  const expiresAt = Date.now() + EDIT_GRANT_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", EDIT_GRANT_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyEditGrant(userId: number, token: string | undefined): boolean {
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
