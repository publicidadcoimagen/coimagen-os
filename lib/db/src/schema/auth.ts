import { sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().default(""),
  email: varchar("email").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("viewer"),
  status: varchar("status").notNull().default("active"),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Better Auth's own session model — replaces the old OIDC-era `sessions`
// table (sid/sess jsonb/expire). Shape mirrors Better Auth's expected
// "session" model so the Drizzle adapter can read/write it directly.
export const sessionsTable = pgTable(
  "sessions",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    token: varchar("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address"),
    userAgent: varchar("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [index("IDX_session_expires_at").on(table.expiresAt)],
);

// Better Auth's "account" model — holds the credential (email/password)
// record for each user, and would hold linked OAuth provider accounts too.
export const accountsTable = pgTable("accounts", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  password: varchar("password"),
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: varchar("scope"),
  idToken: varchar("id_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Better Auth's "verification" model — email verification / password
// reset tokens.
export const verificationsTable = pgTable("verifications", {
  id: varchar("id").primaryKey(),
  identifier: varchar("identifier").notNull(),
  value: varchar("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
