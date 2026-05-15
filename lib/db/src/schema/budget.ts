import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetPlansTable = pgTable("budget_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  totalBudget: integer("total_budget").notNull(),
  eventDate: text("event_date"),
  eventName: text("event_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetItemsTable = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  budgetPlanId: integer("budget_plan_id").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  estimatedCost: integer("estimated_cost").notNull(),
  actualCost: integer("actual_cost"),
  isPaid: boolean("is_paid").notNull().default(false),
  notes: text("notes"),
});

export const insertBudgetPlanSchema = createInsertSchema(budgetPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBudgetItemSchema = createInsertSchema(budgetItemsTable).omit({ id: true });
export type InsertBudgetPlan = z.infer<typeof insertBudgetPlanSchema>;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type BudgetPlan = typeof budgetPlansTable.$inferSelect;
export type BudgetItem = typeof budgetItemsTable.$inferSelect;
