import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Encrypted credentials that belong to the Coimagen account itself, not to
// any one client — e.g. the USER_TOKEN/USER_ID of Coimagen's own Metricool
// subscription, shared across every client's blogId. Distinct from
// client_social_credentials (which requires a clientId FK). Values are
// encrypted with lib/db/src/crypto.ts before being written here, same as
// client_social_credentials; nothing in this table is ever plaintext.
export const systemCredentialsTable = pgTable("system_credentials", {
  id: serial("id").primaryKey(),
  // e.g. "metricool"
  provider: text("provider").notNull(),
  // e.g. "user_token", "user_id" — kept separate from provider because a
  // single provider can need more than one secret.
  credentialType: text("credential_type").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  status: text("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  unique().on(table.provider, table.credentialType),
]);

export const insertSystemCredentialSchema = createInsertSchema(systemCredentialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSystemCredential = z.infer<typeof insertSystemCredentialSchema>;
export type SystemCredential = typeof systemCredentialsTable.$inferSelect;
