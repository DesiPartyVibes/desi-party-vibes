import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  task: text("task").notNull(),
  category: text("category").notNull(),
  dueDate: text("due_date"),
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChecklistItemSchema = createInsertSchema(checklistItemsTable).omit({ id: true, createdAt: true, isDone: true });
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
