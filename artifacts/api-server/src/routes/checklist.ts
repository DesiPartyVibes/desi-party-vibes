import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItemsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const items = await db
    .select()
    .from(checklistItemsTable)
    .where(eq(checklistItemsTable.userId, user.id))
    .orderBy(desc(checklistItemsTable.createdAt));

  res.json(
    items.map((i) => ({
      id: i.id,
      userId: i.userId,
      task: i.task,
      category: i.category,
      dueDate: i.dueDate,
      isDone: i.isDone,
      createdAt: i.createdAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const schema = z.object({
    task: z.string().min(1),
    category: z.string().min(1),
    dueDate: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [item] = await db.insert(checklistItemsTable).values({
    ...parsed.data,
    userId: user.id,
  }).returning();

  res.status(201).json({
    id: item.id,
    userId: item.userId,
    task: item.task,
    category: item.category,
    dueDate: item.dueDate,
    isDone: item.isDone,
    createdAt: item.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res): Promise<void> => {
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

  const schema = z.object({
    task: z.string().optional(),
    category: z.string().optional(),
    dueDate: z.string().optional(),
    isDone: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [item] = await db
    .update(checklistItemsTable)
    .set(parsed.data)
    .where(and(eq(checklistItemsTable.id, id), eq(checklistItemsTable.userId, user.id)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json({
    id: item.id,
    userId: item.userId,
    task: item.task,
    category: item.category,
    dueDate: item.dueDate,
    isDone: item.isDone,
    createdAt: item.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res): Promise<void> => {
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

  await db
    .delete(checklistItemsTable)
    .where(and(eq(checklistItemsTable.id, id), eq(checklistItemsTable.userId, user.id)));

  res.json({ message: "Item deleted" });
});

export default router;
