import { pgTable, serial, text, timestamp, integer, numeric, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { prospectsTable } from "./prospects";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prospectId: integer("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  validUntil: text("valid_until"),
  // Opaque, non-sequential identifier for the public view/approve page
  // (/propuesta/:publicToken) — same pattern as diagnosesTable.publicToken,
  // so proposal ids can't be enumerated to browse other prospects' terms.
  // Powers P-80's correo 3/4, which link here instead of a placeholder.
  publicToken: uuid("public_token").notNull().defaultRandom().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
