import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  description: text("description"),
  service: text("service"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  workflowId: integer("workflow_id"),
  invoiceId: integer("invoice_id"),
  approvalId: integer("approval_id"),
  content: text("content"),
  amount: integer("amount"),
  currency: text("currency").default("MXN"),
  terms: text("terms"),
  notes: text("notes"),
  sentAt: timestamp("sent_at"),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by"),
  signedBy: text("signed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  // DocuSeal e-signature integration (Digital Contract Engine): a completed
  // submission.completed webhook is the only writer of these — real proof
  // of signature, not a staff/client-editable status flip. See
  // routes/webhooks-docuseal.ts.
  docusealSubmissionId: text("docuseal_submission_id"),
  // Should equal String(contracts.id) — set at submission-create time as a
  // redundant safety check, not the primary lookup key (docusealSubmissionId
  // is, once known).
  docusealExternalId: text("docuseal_external_id"),
  signingUrl: text("signing_url"),
  signedDocumentUrl: text("signed_document_url"),
  auditLogUrl: text("audit_log_url"),
  signerIp: text("signer_ip"),
});

export type Contract = typeof contractsTable.$inferSelect;
