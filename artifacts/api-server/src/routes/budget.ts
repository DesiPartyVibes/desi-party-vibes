import { Router } from "express";
import { db } from "@workspace/db";
import { budgetPlansTable, budgetItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

async function getBudgetWithItems(planId: number) {
  const [plan] = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.id, planId)).limit(1);
  if (!plan) return null;
  const items = await db.select().from(budgetItemsTable).where(eq(budgetItemsTable.budgetPlanId, planId));
  return {
    id: plan.id,
    userId: plan.userId,
    totalBudget: plan.totalBudget,
    eventDate: plan.eventDate,
    eventName: plan.eventName,
    items: items.map((i) => ({
      id: i.id,
      budgetPlanId: i.budgetPlanId,
      category: i.category,
      name: i.name,
      estimatedCost: i.estimatedCost,
      actualCost: i.actualCost,
      isPaid: i.isPaid,
      notes: i.notes,
    })),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [plan] = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.userId, user.id)).limit(1);
  if (!plan) {
    res.status(404).json({ error: "No budget plan found" });
    return;
  }

  const result = await getBudgetWithItems(plan.id);
  res.json(result);
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const schema = z.object({
    totalBudget: z.number().int().min(0),
    eventDate: z.string().optional(),
    eventName: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const existing = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.userId, user.id)).limit(1);

  let planId: number;
  if (existing.length > 0) {
    const [updated] = await db
      .update(budgetPlansTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(budgetPlansTable.userId, user.id))
      .returning();
    planId = updated.id;
  } else {
    const [plan] = await db.insert(budgetPlansTable).values({ ...parsed.data, userId: user.id }).returning();
    planId = plan.id;
  }

  const result = await getBudgetWithItems(planId);
  res.json(result);
});

router.post("/items", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

      let [plan] = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.userId, user.id)).limit(1);
      if (!plan) {
              // Auto-create a default plan so adding an item never dead-ends behind a separate "set your budget first" step the UI doesn't clearly prompt for.
              [plan] = await db.insert(budgetPlansTable).values({ totalBudget: 0, eventName: "My Event", userId: user.id }).returning();
      }

  const schema = z.object({
    category: z.string().min(1),
    name: z.string().min(1),
    estimatedCost: z.number().int().min(0),
    actualCost: z.number().int().optional(),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [item] = await db.insert(budgetItemsTable).values({
    ...parsed.data,
    budgetPlanId: plan.id,
  }).returning();

  res.status(201).json({
    id: item.id,
    budgetPlanId: item.budgetPlanId,
    category: item.category,
    name: item.name,
    estimatedCost: item.estimatedCost,
    actualCost: item.actualCost,
    isPaid: item.isPaid,
    notes: item.notes,
  });
});

router.patch("/items/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [plan] = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.userId, user.id)).limit(1);
  if (!plan) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const schema = z.object({
    category: z.string().optional(),
    name: z.string().optional(),
    estimatedCost: z.number().int().optional(),
    actualCost: z.number().int().optional(),
    isPaid: z.boolean().optional(),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [item] = await db
    .update(budgetItemsTable)
    .set(parsed.data)
    .where(and(eq(budgetItemsTable.id, id), eq(budgetItemsTable.budgetPlanId, plan.id)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json({
    id: item.id,
    budgetPlanId: item.budgetPlanId,
    category: item.category,
    name: item.name,
    estimatedCost: item.estimatedCost,
    actualCost: item.actualCost,
    isPaid: item.isPaid,
    notes: item.notes,
  });
});

router.delete("/items/:id", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [plan] = await db.select().from(budgetPlansTable).where(eq(budgetPlansTable.userId, user.id)).limit(1);
  if (!plan) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .delete(budgetItemsTable)
    .where(and(eq(budgetItemsTable.id, id), eq(budgetItemsTable.budgetPlanId, plan.id)));

  res.json({ message: "Item deleted" });
});

export default router;
