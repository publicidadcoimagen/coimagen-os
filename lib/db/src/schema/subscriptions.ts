import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { proposalsTable } from "./proposals";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  // The proposal whose final installment payment triggered this
  // subscription — precise, unlike falling back to "most recent
  // subscription for this client", which breaks if a client ever has more
  // than one proposal/subscription over time. Null for subscriptions
  // created the old manual/staff way, unrelated to a proposal.
  proposalId: integer("proposal_id").references(() => proposalsTable.id, { onDelete: "set null" }),
  plan: text("plan").notNull(),
  amount: numeric("amount").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  // Gains "pending_authorization" alongside the pre-existing values (active
  // etc.) — set the moment a proposal's final installment is paid, before
  // the client has clicked through PayPal's own approval link for the
  // recurring billing agreement. Flips to "active" only on the
  // BILLING.SUBSCRIPTION.ACTIVATED webhook. See lib/subscription-alerts for
  // the staff alert on subscriptions stuck here too long.
  status: text("status").notNull().default("active"),
  startDate: text("start_date"),
  nextBillingDate: text("next_billing_date"),
  notes: text("notes"),
  // PayPal's own subscription id (from POST /v1/billing/subscriptions) —
  // null until the subscription is created with PayPal, set alongside the
  // pending_authorization transition. Unique once populated.
  paypalSubscriptionId: text("paypal_subscription_id").unique(),
  // The one-time HATEOAS "approve" link PayPal returned when the
  // subscription was created — stored rather than re-fetched later, since
  // it's simplest to serve the same link every time the client reloads the
  // /factura page rather than depending on PayPal's GET-subscription
  // response still including a fresh one post-creation.
  paypalApproveUrl: text("paypal_approve_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
