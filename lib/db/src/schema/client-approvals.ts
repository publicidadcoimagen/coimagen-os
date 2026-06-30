import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const clientApprovalsTable = pgTable("client_approvals", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  comments: text("comments"),
  requestedBy: text("requested_by"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type ClientApproval = typeof clientApprovalsTable.$inferSelect;
