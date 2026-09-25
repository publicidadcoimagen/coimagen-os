import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, contractsTable, clientsTable } from "@workspace/db";
import {
  ListContractsQueryParams,
  CreateContractBody,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
  DeleteContractParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";
import { isClienteRole, ownClientId } from "../middlewares/clientScope";
import { createDocusealSubmission, DocusealApiError, DocusealNotConfiguredError } from "../lib/docuseal/client";
import { backfillSignedDocumentUrls } from "../lib/docuseal/backfill";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Both templates (id 11 "Contrato_Maestro_Coimagen_V3", id 10
// "Coimagen_Master_Agreement_V3") were created directly in DocuSeal by
// Camila for this flow — confirmed against the real DocuSeal DB, not
// guessed. No env var indirection: these are stable content templates,
// not per-environment config like DOCUSEAL_BASE_URL.
//
// Updated 2026-09-23: the old V2 templates (ids 3/4) no longer exist in
// DocuSeal at all — Camila replaced them with V3 (fixed-currency clause),
// which silently broke every real "Enviar a firma" click until this fix
// (DocuSeal rejects a submission request for a nonexistent template_id).
// Confirmed the new ids directly via GET /api/templates against the real
// instance, not assumed.
const DOCUSEAL_TEMPLATE_ID_ES = 11;
const DOCUSEAL_TEMPLATE_ID_EN = 10;
// The one submitter role both templates define — see lib/docuseal/client.ts.
const DOCUSEAL_SUBMITTER_ROLE = "Primera Parte";

function serialize(r: typeof contractsTable.$inferSelect) {
  return {
    ...r,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

router.get("/contracts", async (req, res): Promise<void> => {
  const q = ListContractsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  let query = db.select().from(contractsTable).$dynamic();
  const conditions = [];
  if (q.data.status) conditions.push(eq(contractsTable.status, q.data.status));
  if (q.data.type) conditions.push(eq(contractsTable.type, q.data.type));
  if (isClienteRole(req)) {
    conditions.push(eq(contractsTable.clientId, ownClientId(req)!));
  } else if (q.data.clientId) {
    conditions.push(eq(contractsTable.clientId, q.data.clientId));
  }
  if (q.data.projectId) conditions.push(eq(contractsTable.projectId, q.data.projectId));
  // Excludes real is_test rows (self-labeled "PRUEBA — ...") from the
  // Firmados/Activos KPI by default — pass includeTest=true to see them.
  if (!q.data.includeTest) conditions.push(eq(contractsTable.isTest, false));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await backfillSignedDocumentUrls(await query.orderBy(desc(contractsTable.createdAt)));
  res.json(rows.map(serialize));
});

router.post("/contracts", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateContractBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const [row] = await db.insert(contractsTable).values({
    type: d.type,
    title: d.title,
    description: d.description ?? null,
    service: d.service ?? null,
    clientId: d.clientId ?? null,
    projectId: d.projectId ?? null,
    workflowId: d.workflowId ?? null,
    invoiceId: d.invoiceId ?? null,
    approvalId: d.approvalId ?? null,
    content: d.content ?? null,
    amount: d.amount ?? null,
    currency: d.currency ?? "MXN",
    terms: d.terms ?? null,
    notes: d.notes ?? null,
    sentAt: d.sentAt ? new Date(d.sentAt) : null,
    signedAt: d.signedAt ? new Date(d.signedAt) : null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    createdBy: d.createdBy ?? null,
    signedBy: d.signedBy ?? null,
    status: "draft",
  }).returning();

  res.status(201).json(serialize(row));
});

router.get("/contracts/:id", async (req, res): Promise<void> => {
  const params = GetContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!row || (isClienteRole(req) && row.clientId !== ownClientId(req))) { res.status(404).json({ error: "Not found" }); return; }
  const [filled] = await backfillSignedDocumentUrls([row]);
  res.json(serialize(filled));
});

// A cliente-role caller can no longer self-mark their own contract as
// "signed" via this endpoint — that was a real legal gap (a one-click
// status flip with zero proof of signature). Real signing now happens
// exclusively through the DocuSeal webhook (see webhooks-docuseal.ts),
// which writes verifiable evidence (signer email/IP, signed document,
// audit log) that no client-facing API call can produce. Cliente-role
// PATCH access is removed entirely — clients have no legitimate field to
// edit on their own contract today. Staff (ceo/admin) keep full-edit PATCH
// access unchanged below, as an intentional manual-override path (paper
// signature, DocuSeal outage).
router.patch("/contracts/:id", async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateContractBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (isClienteRole(req)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const staffRole = (req.user as { role?: string })?.role ?? "viewer";
  if (!["ceo", "admin"].includes(staffRole)) { res.status(403).json({ error: "Insufficient permissions" }); return; }

  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.type !== undefined) update.type = d.type;
  if (d.status !== undefined) update.status = d.status;
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.service !== undefined) update.service = d.service;
  if (d.clientId !== undefined) update.clientId = d.clientId;
  if (d.projectId !== undefined) update.projectId = d.projectId;
  if (d.workflowId !== undefined) update.workflowId = d.workflowId;
  if (d.invoiceId !== undefined) update.invoiceId = d.invoiceId;
  if (d.approvalId !== undefined) update.approvalId = d.approvalId;
  if (d.content !== undefined) update.content = d.content;
  if (d.amount !== undefined) update.amount = d.amount;
  if (d.currency !== undefined) update.currency = d.currency;
  if (d.terms !== undefined) update.terms = d.terms;
  if (d.notes !== undefined) update.notes = d.notes;
  if (d.sentAt !== undefined) update.sentAt = d.sentAt ? new Date(d.sentAt) : null;
  if (d.signedAt !== undefined) update.signedAt = d.signedAt ? new Date(d.signedAt) : null;
  if (d.expiresAt !== undefined) update.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  if (d.createdBy !== undefined) update.createdBy = d.createdBy;
  if (d.signedBy !== undefined) update.signedBy = d.signedBy;

  await db.update(contractsTable).set(update).where(eq(contractsTable.id, params.data.id));
  const [updated] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

// Real send: creates the DocuSeal submission (picking the ES/EN template
// from the client's language) and moves the contract to "sent" only once
// DocuSeal confirms it — replaces the old flow where the frontend flipped
// status straight to "sent" with a plain PATCH and no signature request
// was ever actually sent. Signing itself still only happens via the
// webhook (see webhooks-docuseal.ts) — this route never sets "signed".
router.post("/contracts/:id/send", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = GetContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!contract) { res.status(404).json({ error: "Not found" }); return; }
  if (contract.status !== "draft") {
    res.status(409).json({ error: "Solo un contrato en borrador puede enviarse a firma" });
    return;
  }
  if (!contract.clientId) {
    res.status(400).json({ error: "El contrato no tiene un cliente asignado" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, contract.clientId));
  if (!client) { res.status(400).json({ error: "Cliente no encontrado" }); return; }
  if (!client.email) { res.status(400).json({ error: "El cliente no tiene email registrado" }); return; }

  const isEn = client.language === "en";
  const templateId = isEn ? DOCUSEAL_TEMPLATE_ID_EN : DOCUSEAL_TEMPLATE_ID_ES;

  // Prefill values keyed by the field names set directly in DocuSeal
  // (2026-09-23 — see the template-id comment above). No schema field
  // stores a client's country: clients.language ("es"/"en") is the only
  // signal today, and it already drives which template/jurisdiction this
  // send uses (Contrato Maestro cláusula 13) — reusing it here for
  // country_of_operation is consistent with that existing precedent, not a
  // new assumption, but it's still an inference, not a stored fact (an
  // English-speaking client outside the US/Mexico would be misclassified).
  const today = new Date();
  const contractDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const currency = contract.currency ?? "MXN";
  const monthlyFee = contract.amount != null
    ? `${new Intl.NumberFormat(isEn ? "en-US" : "es-MX", { style: "currency", currency }).format(contract.amount / 100)}/${isEn ? "mo" : "mes"}`
    : "";

  let submission;
  try {
    submission = await createDocusealSubmission(templateId, {
      email: client.email,
      name: client.name,
      role: DOCUSEAL_SUBMITTER_ROLE,
      externalId: String(contract.id),
      values: {
        client_name: client.name,
        client_company: client.company ?? "",
        client_email: client.email,
        client_phone: client.phone ?? "",
        contract_date: contractDate,
        contracted_service: contract.service ?? contract.title,
        monthly_fee: monthlyFee,
        country_of_operation: isEn ? "United States" : "México",
      },
    });
  } catch (err) {
    if (err instanceof DocusealNotConfiguredError) {
      logger.error({ err, contractId: contract.id }, "DocuSeal no está configurado — envío rechazado");
      res.status(503).json({ error: "DocuSeal no está configurado" });
      return;
    }
    if (err instanceof DocusealApiError) {
      logger.error({ err, contractId: contract.id }, "DocuSeal rechazó la creación de la submission");
      res.status(502).json({ error: err.message });
      return;
    }
    logger.error({ err, contractId: contract.id }, "Error inesperado creando la submission de DocuSeal");
    res.status(502).json({ error: "No se pudo crear la submission en DocuSeal" });
    return;
  }

  await db.update(contractsTable).set({
    status: "sent",
    sentAt: new Date(),
    docusealSubmissionId: String(submission.submissionId),
    docusealExternalId: submission.externalId ?? String(contract.id),
    signingUrl: submission.signingUrl,
    updatedAt: new Date(),
  }).where(eq(contractsTable.id, contract.id));

  const [updated] = await db.select().from(contractsTable).where(eq(contractsTable.id, contract.id));
  logger.info({ contractId: contract.id, templateId, submissionId: submission.submissionId }, "Contrato enviado a firma vía DocuSeal");
  res.json(serialize(updated!));
});

router.delete("/contracts/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteContractParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(contractsTable).where(eq(contractsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
