import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const clientAccessTable = pgTable("client_access", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  accessType: text("access_type").notNull().default("other"),
  platform: text("platform"),
  accountName: text("account_name"),
  loginUrl: text("login_url"),
  usernameEmail: text("username_email"),
  passwordPlaceholder: text("password_placeholder"),
  apiKeyPlaceholder: text("api_key_placeholder"),
  tokenPlaceholder: text("token_placeholder"),
  permissionStatus: text("permission_status").notNull().default("not_requested"),
  accessStatus: text("access_status").notNull().default("pending"),
  lastVerified: timestamp("last_verified"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertClientAccessSchema = createInsertSchema(clientAccessTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientAccess = z.infer<typeof insertClientAccessSchema>;
export type ClientAccess = typeof clientAccessTable.$inferSelect;
