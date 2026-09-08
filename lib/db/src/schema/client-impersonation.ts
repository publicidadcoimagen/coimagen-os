import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { clientsTable } from "./clients";

// "Ver como cliente" — a ceo/admin session enters a read-only, time-boxed
// view of a specific client's Client Room (see impersonationMiddleware).
// One row per session; endedAt is set either by an explicit exit or left
// null until expiresAt passes (the middleware itself treats an expired,
// unended row the same as an ended one).
export const clientImpersonationSessionsTable = pgTable("client_impersonation_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token").notNull().unique(),
  staffUserId: varchar("staff_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  endedAt: timestamp("ended_at"),
});

export type ClientImpersonationSession = typeof clientImpersonationSessionsTable.$inferSelect;
