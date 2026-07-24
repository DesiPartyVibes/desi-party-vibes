import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, usersTable, bookingsTable, reviewsTable, categoriesTable, vendorClaimsTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/vendors", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const vendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt));
  const categories = await db.select().from(categoriesTable);
  const catMap: Record<number, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  res.json(
    vendors.map((v) => ({
      id: v.id,
      name: v.name,
      categoryId: v.categoryId,
      categoryName: catMap[v.categoryId] ?? "",
      city: v.city,
      state: v.state,
      description: v.description,
      priceMin: v.priceMin,
      priceMax: v.priceMax,
      rating: v.rating,
      reviewCount: v.reviewCount,
      imageUrl: v.imageUrl,
      gallery: v.gallery,
      phone: v.phone,
      email: v.email,
      website: v.website,
      isActive: v.isActive,
      isFeatured: v.isFeatured,
      isClaimed: v.userId != null,
      createdAt: v.createdAt.toISOString(),
    }))
  );
});

router.get("/bookings", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));

  const vendorIds = [...new Set(bookings.map((b) => b.vendorId))];
  const userIds = [...new Set(bookings.map((b) => b.userId))];

  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;
  const userMap: Record<number, string> = {};
  for (const u of users) userMap[u.id] = u.name;

  res.json(
    bookings.map((b) => ({
      id: b.id,
      vendorId: b.vendorId,
      vendorName: vendorMap[b.vendorId] ?? "",
      userId: b.userId,
      userName: userMap[b.userId] ?? "",
      eventDate: b.eventDate,
      eventType: b.eventType,
      guestCount: b.guestCount,
      message: b.message,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    }))
  );
});

router.get("/users", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isVerified: u.isVerified,
      emailVerified: u.emailVerified,
      isRejected: !!u.rejectedAt,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

router.patch("/users/:id/verify", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role !== "vendor") {
    res.status(400).json({ error: "Only vendor accounts can be verified" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isVerified: true })
    .where(eq(usersTable.id, id))
    .returning();

  // Fire-and-forget: fulfills the promise made in the pending-review email sent at signup.
  sendEmail(
    updated.email,
    "Your DesiPartyVibes vendor account has been approved!",
    `<p>Hi ${updated.firstName || updated.name},</p><p>Good news — your vendor account has been <strong>approved</strong>! Your business listing is now live on DesiPartyVibes and visible to couples planning their celebrations.</p><p><a href="https://www.desipartyvibes.com/vendor-dashboard">Visit your dashboard</a></p><p>— The DesiPartyVibes Team</p>`
  ).catch((err) => logger.error({ err, userId: updated.id }, "Failed to send vendor approval email"));

  res.json({ id: updated.id, isVerified: updated.isVerified, isRejected: !!updated.rejectedAt });
});

router.patch("/users/:id/reject", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role !== "vendor") {
    res.status(400).json({ error: "Only vendor accounts can be rejected" });
    return;
  }
  if (user.isVerified) {
    res.status(400).json({ error: "This vendor account is already verified" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ rejectedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  // Fire-and-forget: let the applicant know their vendor application wasn't approved.
  sendEmail(
    updated.email,
    "Update on your DesiPartyVibes vendor application",
    `<p>Hi ${updated.firstName || updated.name},</p><p>Thanks for your interest in listing your business on DesiPartyVibes. After review, we're not able to approve your vendor account at this time.</p><p>If you believe this was a mistake or have questions, please reach out to our support team.</p><p>— The DesiPartyVibes Team</p>`
  ).catch((err) => logger.error({ err, userId: updated.id }, "Failed to send vendor rejection email"));

  res.json({ id: updated.id, isVerified: updated.isVerified, isRejected: !!updated.rejectedAt });
});

router.get("/stats", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const [totalVendors] = await db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable);
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [totalBookings] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable);
  const [pendingBookings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(eq(bookingsTable.status, "pending"));
  const [totalReviews] = await db.select({ count: sql<number>`count(*)::int` }).from(reviewsTable);

  const vendorsByCategory = await db
    .select({
      category: categoriesTable.name,
      count: sql<number>`count(${vendorsTable.id})::int`,
    })
    .from(categoriesTable)
    .leftJoin(vendorsTable, eq(vendorsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.name)
    .orderBy(sql`count(${vendorsTable.id}) desc`);

  res.json({
    totalVendors: totalVendors.count,
    totalUsers: totalUsers.count,
    totalBookings: totalBookings.count,
    pendingBookings: pendingBookings.count,
    totalReviews: totalReviews.count,
    vendorsByCategory,
  });
});

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

router.get("/vendor-claims", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const claims = await db.select().from(vendorClaimsTable).orderBy(desc(vendorClaimsTable.createdAt));

  const vendorIds = [...new Set(claims.map((c) => c.vendorId))];
  const userIds = [...new Set(claims.map((c) => c.userId))];

  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
    : [];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;
  const userMap: Record<number, { name: string; email: string }> = {};
  for (const u of users) userMap[u.id] = { name: u.name, email: u.email };

  res.json(
    claims.map((c) =>
      formatClaim(c, vendorMap[c.vendorId] ?? "", userMap[c.userId]?.name ?? "", userMap[c.userId]?.email ?? "")
    )
  );
});

router.patch("/vendor-claims/:id/approve", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [claim] = await db.select().from(vendorClaimsTable).where(eq(vendorClaimsTable.id, id)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  if (claim.status !== "pending") {
    res.status(400).json({ error: "Claim has already been reviewed" });
    return;
  }

  await db.update(vendorsTable).set({ userId: claim.userId }).where(eq(vendorsTable.id, claim.vendorId));

  const [updated] = await db
    .update(vendorClaimsTable)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(vendorClaimsTable.id, id))
    .returning();

  // Any other pending claims on the same listing are no longer valid once one is approved.
  await db
    .update(vendorClaimsTable)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(vendorClaimsTable.vendorId, claim.vendorId), eq(vendorClaimsTable.status, "pending")));

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, updated.vendorId)).limit(1);
  const [claimUser] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);

  if (claimUser) {
    // Fire-and-forget: let the vendor know their listing is now linked to their account.
    sendEmail(
      claimUser.email,
      "Your business claim has been approved",
      `<p>Hi ${claimUser.firstName || claimUser.name},</p><p>Your claim on <strong>${vendor?.name ?? "your listing"}</strong> has been approved! This listing is now linked to your account — manage it anytime from <a href="https://www.desipartyvibes.com/vendor-dashboard">My Business</a>.</p><p>— The DesiPartyVibes Team</p>`
    ).catch((err) => logger.error({ err, claimId: updated.id }, "Failed to send claim approval email"));
  }

  res.json(formatClaim(updated, vendor?.name ?? "", claimUser?.name ?? "", claimUser?.email ?? ""));
});

router.patch("/vendor-claims/:id/reject", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [claim] = await db.select().from(vendorClaimsTable).where(eq(vendorClaimsTable.id, id)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  const [updated] = await db
    .update(vendorClaimsTable)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(eq(vendorClaimsTable.id, id))
    .returning();

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, updated.vendorId)).limit(1);
  const [claimUser] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);

  if (claimUser) {
    // Fire-and-forget: let the vendor know their claim wasn't approved, so they aren't left wondering.
    sendEmail(
      claimUser.email,
      "Your business claim was not approved",
      `<p>Hi ${claimUser.firstName || claimUser.name},</p><p>Your claim on <strong>${vendor?.name ?? "that listing"}</strong> was not approved. If you believe this was a mistake or have questions, please reach out to our support team.</p><p>— The DesiPartyVibes Team</p>`
    ).catch((err) => logger.error({ err, claimId: updated.id }, "Failed to send claim rejection email"));
  }

  res.json(formatClaim(updated, vendor?.name ?? "", claimUser?.name ?? "", claimUser?.email ?? ""));
});

export default router;
