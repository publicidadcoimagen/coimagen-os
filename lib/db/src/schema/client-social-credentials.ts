import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

// Stores encrypted, programmatically-usable third-party credentials per
// client (social media tokens, API keys) — distinct from client_access,
// which only ever stores non-sensitive placeholders ("we have a password"),
// never the actual value. Values are encrypted with lib/db/src/crypto.ts
// before being written here; nothing in this table is ever plaintext.
export const clientSocialCredentialsTable = pgTable("client_social_credentials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  // e.g. "meta", "linkedin", "google_business", "tiktok"
  platform: text("platform").notNull(),
  // e.g. "access_token", "refresh_token", "api_key" — kept separate from
  // platform because OAuth flows (Meta, LinkedIn) issue both an access
  // token and a refresh token per connection.
  credentialType: text("credential_type").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  scopes: text("scopes"),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  unique().on(table.clientId, table.platform, table.credentialType),
]);

export const insertClientSocialCredentialSchema = createInsertSchema(clientSocialCredentialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientSocialCredential = z.infer<typeof insertClientSocialCredentialSchema>;
export type ClientSocialCredential = typeof clientSocialCredentialsTable.$inferSelect;
