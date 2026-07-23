import { Router } from "express";
import { db } from "@workspace/db";
import { vendorClaimsTable, vendorsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

function formatClaim(
  c: typeof vendorClaimsTable.$inferSelect,
  vendorName: string,
  userName: string,
  userEmail: string
) {
  return {
    id: c.id,
    vendorId: c.vendorId,
    vendorName,
    userId: c.userId,
    userName,
    userEmail,
    status: c.status,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
  };
}

const claimInputSchema = z.object({
  vendorId: z.number().int(),
  note: z.string().optional(),
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || user.role !== "vendor") {
    res.status(403).json({ error: "Only vendor accounts can claim a listing" });
    return;
  }
  if (!user.isVerified) {
    res.status(403).json({ error: "Your vendor account is pending admin approval" });
    return;
  }

  const parsed = claimInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, parsed.data.vendorId)).limit(1);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  if (vendor.userId) {
    res.status(400).json({ error: "This listing has already been claimed" });
    return;
  }

  const [existing] = await db
    .select()
    .from(vendorClaimsTable)
    .where(
      and(
        eq(vendorClaimsTable.vendorId, vendor.id),
        eq(vendorClaimsTable.userId, user.id),
        eq(vendorClaimsTable.status, "pending")
      )
    )
    .limit(1);
  if (existing) {
    res.status(400).json({ error: "You already have a pending claim for this listing" });
    return;
  }

  const [claim] = await db
    .insert(vendorClaimsTable)
    .values({ vendorId: vendor.id, userId: user.id, note: parsed.data.note })
    .returning();

  res.status(201).json(formatClaim(claim, vendor.name, user.name, user.email));
});

router.get("/mine", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const claims = await db
    .select()
    .from(vendorClaimsTable)
    .where(eq(vendorClaimsTable.userId, user.id))
    .orderBy(desc(vendorClaimsTable.createdAt));

  const vendorIds = [...new Set(claims.map((c) => c.vendorId))];
  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;

  res.json(claims.map((c) => formatClaim(c, vendorMap[c.vendorId] ?? "", user.name, user.email)));
});

export default router;
