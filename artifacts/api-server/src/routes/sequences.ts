import { Router, type IRouter } from "express";
import { eq, and, or, isNull, isNotNull, inArray } from "drizzle-orm";
import {
  db,
  prospectsTable,
  commercialFollowupsTable,
  proposalsTable,
  invoicesTable,
  clientsTable,
  invoiceRemindersTable,
  subscriptionsTable,
  subscriptionAlertsTable,
  paymentRecoveryAlertsTable,
} from "@workspace/db";
import { STAGE_MIN_DAYS, LAST_STAGE, PROSPECTING_FUNNEL_SOURCES } from "../lib/commercial-followup/eligibility";
import { eligibleClientIds } from "../lib/commercial-followup/repository";
import { stageForDueDate } from "../lib/invoice-reminders/eligibility";
import { STAFF_WINDOW_DAYS, CLIENT_WINDOW_DAYS } from "../lib/invoice-reminders/repository";
import { isStalePendingAuthorization } from "../lib/subscription-alerts/eligibility";
import { RECOVERY_STAGES, STAGE_MIN_DAYS as RECOVERY_STAGE_MIN_DAYS, upcomingRecoveryStage, type RecoveryStage } from "../lib/payment-recovery/eligibility";

const router: IRouter = Router();

// Read-only status view for P-80 — reuses the same STAGE_MIN_DAYS/LAST_DAY
// constants the cron itself uses, so "next eligible date" here can never
// drift from what the cron will actually do. Scope matches
// findDueFollowups: Coimagen's own internal funnel (PROSPECTING_FUNNEL_
// SOURCES — diagnostico_digital + agente_prospectador as of P-82) plus any
// client with the agent assigned (P-81 Fase A). Shown regardless of
// "due right now": a prospect still on status=lead is in-sequence even if
// its next stage isn't due for a few more days; one already converted
// keeps showing only if it has follow-up history (so the record doesn't
// vanish the moment it converts).
router.get("/sequences/commercial-followups", async (req, res): Promise<void> => {
  const includeTest = req.query.includeTest === "true";
  const clientIds = await eligibleClientIds();
  const scopeConditions = [and(isNull(prospectsTable.clientId), inArray(prospectsTable.source, PROSPECTING_FUNNEL_SOURCES))];
  if (clientIds.length > 0) scopeConditions.push(inArray(prospectsTable.clientId, clientIds));

  // Excludes real is_test rows (deploy/i18n verification leads, e.g. "Claude
  // Deploy Verify", "Prueba Idioma ES") from this operational worklist by
  // default — pass ?includeTest=true to see them.
  const baseConditions = [isNotNull(prospectsTable.email), or(...scopeConditions)];
  if (!includeTest) baseConditions.push(eq(prospectsTable.isTest, false));

  const prospects = await db.select().from(prospectsTable).where(and(...baseConditions));

  const followupRows = await db.select().from(commercialFollowupsTable);
  const followupsByProspect = new Map<number, typeof followupRows>();
  for (const row of followupRows) {
    const list = followupsByProspect.get(row.prospectId) ?? [];
    list.push(row);
    followupsByProspect.set(row.prospectId, list);
  }

  const proposalRows = await db.select({ prospectId: proposalsTable.prospectId }).from(proposalsTable);
  const prospectsWithProposal = new Set(proposalRows.map((p) => p.prospectId));

  const result = prospects
    .filter((p) => p.status === "lead" || followupsByProspect.has(p.id))
    .map((p) => {
      const sent = followupsByProspect.get(p.id) ?? [];
      const sentStages = sent.map((s) => s.stage).sort((a, b) => a - b);
      const lastSentAt = sent.length > 0
        ? sent.reduce((a, b) => (a.sentAt > b.sentAt ? a : b)).sentAt.toISOString()
        : null;

      const nextStage = sentStages.length === 0 ? 2 : Math.max(...sentStages) + 1;
      const isComplete = nextStage > LAST_STAGE;
      const minDays = isComplete ? null : (STAGE_MIN_DAYS[nextStage] ?? null);
      const nextEligibleAt = isComplete || minDays === null
        ? null
        : new Date(p.createdAt.getTime() + minDays * 24 * 60 * 60 * 1000).toISOString();

      return {
        prospectId: p.id,
        prospectName: p.name,
        prospectEmail: p.email,
        company: p.company,
        prospectStatus: p.status,
        createdAt: p.createdAt.toISOString(),
        sentStages,
        lastSentAt,
        nextStage: isComplete ? null : nextStage,
        nextEligibleAt,
        hasProposal: prospectsWithProposal.has(p.id),
      };
    });

  res.json(result);
});

// Read-only status view for P-69. Shows any "sent" (billed, unpaid) invoice
// plus any invoice with reminder history even if it's since moved to
// paid/cancelled — so a resolved invoice doesn't just disappear from the
// record. staffWindowStage/clientWindowStage reuse stageForDueDate with the
// same two window sizes the cron itself uses (7d staff, 3d client) — the
// windows differ per audience, so an invoice can be "upcoming" for staff
// while not yet in the client's shorter window at all.
router.get("/sequences/invoice-reminders", async (_req, res): Promise<void> => {
  const invoiceRows = await db.select({ invoice: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
    .from(invoicesTable)
    .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id));

  const reminderRows = await db.select().from(invoiceRemindersTable);
  const remindersByInvoice = new Map<number, typeof reminderRows>();
  for (const row of reminderRows) {
    const list = remindersByInvoice.get(row.invoiceId) ?? [];
    list.push(row);
    remindersByInvoice.set(row.invoiceId, list);
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = invoiceRows
    .filter((row) => row.invoice.status === "sent" || (remindersByInvoice.get(row.invoice.id)?.length ?? 0) > 0)
    .map((row) => {
      const reminders = remindersByInvoice.get(row.invoice.id) ?? [];
      const staffReminders = reminders.filter((r) => r.audience === "staff");
      const clientReminders = reminders.filter((r) => r.audience === "client");
      const lastSentAt = (rows: typeof reminders) =>
        rows.length > 0 ? rows.reduce((a, b) => (a.sentAt > b.sentAt ? a : b)).sentAt.toISOString() : null;

      const eligibleForWindow = row.invoice.status === "sent" && row.invoice.dueDate !== null;
      const staffWindowStage = eligibleForWindow ? stageForDueDate(row.invoice.dueDate!, today, STAFF_WINDOW_DAYS) : null;
      const clientWindowStage = eligibleForWindow ? stageForDueDate(row.invoice.dueDate!, today, CLIENT_WINDOW_DAYS) : null;

      return {
        invoiceId: row.invoice.id,
        invoiceNumber: row.invoice.number,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        dueDate: row.invoice.dueDate,
        invoiceStatus: row.invoice.status,
        staffWindowStage,
        staffSentStages: staffReminders.map((r) => r.stage),
        staffLastSentAt: lastSentAt(staffReminders),
        clientWindowStage,
        clientSentStages: clientReminders.map((r) => r.stage),
        clientLastSentAt: lastSentAt(clientReminders),
      };
    });

  res.json(result);
});

// Read-only view for the subscription-alerts cron: every subscription still
// waiting on the client's PayPal authorization, plus any that ever got an
// alert (so a resolved one doesn't vanish from the record). `stale` reuses
// the cron's own isStalePendingAuthorization, so it can never disagree with
// what the cron would do.
router.get("/sequences/subscription-alerts", async (_req, res): Promise<void> => {
  const rows = await db.select({ subscription: subscriptionsTable, clientName: clientsTable.name })
    .from(subscriptionsTable)
    .innerJoin(clientsTable, eq(subscriptionsTable.clientId, clientsTable.id));
  const alerts = await db.select().from(subscriptionAlertsTable);
  const alertBySubscription = new Map(alerts.map((a) => [a.subscriptionId, a]));
  const now = new Date();

  res.json(rows
    .filter((r) => r.subscription.status === "pending_authorization" || alertBySubscription.has(r.subscription.id))
    .map((r) => ({
      subscriptionId: r.subscription.id,
      clientName: r.clientName,
      status: r.subscription.status,
      amount: parseFloat(r.subscription.amount),
      currency: r.subscription.currency,
      createdAt: r.subscription.createdAt.toISOString(),
      stale: r.subscription.status === "pending_authorization" && isStalePendingAuthorization(r.subscription.createdAt, now),
      alertSentAt: alertBySubscription.get(r.subscription.id)?.sentAt.toISOString() ?? null,
    })));
});

// Read-only view for the payment-recovery cron. Same scope as
// findDueRecoveries: only a proposal's FIRST installment (lowest invoice id
// per proposal — the deposit) takes part, while it's still "sent"; plus any
// invoice with recovery history. nextStage/nextEligibleAt use the cron's own
// RECOVERY_STAGES + STAGE_MIN_DAYS.
router.get("/sequences/payment-recovery", async (_req, res): Promise<void> => {
  const invoiceRows = await db.select({ invoice: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
    .from(invoicesTable)
    .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(isNotNull(invoicesTable.proposalId));

  const depositIdByProposal = new Map<number, number>();
  for (const { invoice } of invoiceRows) {
    const current = depositIdByProposal.get(invoice.proposalId!);
    if (current === undefined || invoice.id < current) depositIdByProposal.set(invoice.proposalId!, invoice.id);
  }

  const alerts = await db.select().from(paymentRecoveryAlertsTable);
  const alertsByInvoice = new Map<number, typeof alerts>();
  for (const a of alerts) alertsByInvoice.set(a.invoiceId, [...(alertsByInvoice.get(a.invoiceId) ?? []), a]);

  const result = invoiceRows
    .filter(({ invoice }) => {
      const isDeposit = depositIdByProposal.get(invoice.proposalId!) === invoice.id;
      return (isDeposit && invoice.status === "sent") || alertsByInvoice.has(invoice.id);
    })
    .map(({ invoice, clientName, clientEmail }) => {
      const history = alertsByInvoice.get(invoice.id) ?? [];
      const sent = new Set(history.map((a) => a.stage).filter((s): s is RecoveryStage => (RECOVERY_STAGES as readonly string[]).includes(s)));
      const nextStage = invoice.status === "sent" ? upcomingRecoveryStage(sent) : null;
      const nextEligibleAt = nextStage ? new Date(invoice.createdAt.getTime() + RECOVERY_STAGE_MIN_DAYS[nextStage] * 24 * 60 * 60 * 1000).toISOString() : null;
      const lastSent = history.reduce<Date | null>((latest, a) => (latest && latest > a.sentAt ? latest : a.sentAt), null);
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        clientName,
        clientEmail,
        invoiceStatus: invoice.status,
        createdAt: invoice.createdAt.toISOString(),
        sentStages: [...sent],
        declined: history.some((a) => a.stage === "declined"),
        lastSentAt: lastSent ? lastSent.toISOString() : null,
        nextStage,
        nextEligibleAt,
      };
    });

  res.json(result);
});

export default router;
