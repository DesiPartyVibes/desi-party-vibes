import { Request } from "express";
import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db";

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
  return user ?? null;
}
