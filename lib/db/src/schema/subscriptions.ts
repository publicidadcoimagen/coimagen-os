import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  amount: numeric("amount").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  status: text("status").notNull().default("active"),
  startDate: text("start_date"),
  nextBillingDate: text("next_billing_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
