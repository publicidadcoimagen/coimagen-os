import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, invoicesTable, clientsTable, paymentRecoveryAlertsTable, type Invoice } from "@workspace/db";
import { findActivePaymentAttempt } from "../payment-schedule/repository";
import { RECOVERY_STAGES, nextRecoveryStageToSend, type RecoveryStage } from "./eligibility";

const DISCOUNT_STAGES: RecoveryStage[] = ["discount_30d", "discount_60d"];

export interface DueRecovery {
  invoice: Invoice;
  clientName: string;
  clientEmail: string | null;
  stage: RecoveryStage;
}

// Only the FIRST installment (the deposit) of a proposal's payment schedule
// participates in this sequence — a client abandoning a milestone/final
// cuota mid-project is a different, more serious situation than never
// starting at all, and isn't what this flow is for. "First" means the
// lowest invoice id among every invoice ever generated for that proposal,
// not just among currently-"sent" ones — an invoice's own siblings can be
// paid/draft/cancelled and it's still not necessarily the deposit.
async function isFirstInstallment(invoice: Invoice): Promise<boolean> {
  const siblings = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.proposalId, invoice.proposalId!));
  const minId = Math.min(...siblings.map((s) => s.id));
  return invoice.id === minId;
}

async function unpaidDepositInvoicesWithClient(): Promise<Array<{ invoice: Invoice; clientName: string; clientEmail: string | null }>> {
  const candidates = await db
    .select({ invoice: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
    .from(invoicesTable)
    .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(isNotNull(invoicesTable.proposalId), eq(invoicesTable.status, "sent")));

  const deposits: Array<{ invoice: Invoice; clientName: string; clientEmail: string | null }> = [];
  for (const candidate of candidates) {
    if (await isFirstInstallment(candidate.invoice)) deposits.push(candidate);
  }
  return deposits;
}

async function sentStages(invoiceId: number): Promise<Set<RecoveryStage>> {
  const rows = await db.select({ stage: paymentRecoveryAlertsTable.stage })
    .from(paymentRecoveryAlertsTable)
    .where(and(eq(paymentRecoveryAlertsTable.invoiceId, invoiceId), inArray(paymentRecoveryAlertsTable.stage, RECOVERY_STAGES)));
  return new Set(rows.map((r) => r.stage as RecoveryStage));
}

export async function isDeclined(invoiceId: number): Promise<boolean> {
  const [row] = await db.select({ id: paymentRecoveryAlertsTable.id })
    .from(paymentRecoveryAlertsTable)
    .where(and(eq(paymentRecoveryAlertsTable.invoiceId, invoiceId), eq(paymentRecoveryAlertsTable.stage, "declined")));
  return Boolean(row);
}

// Every deposit cuota due for exactly one payment-recovery email right now,
// per nextRecoveryStageToSend's one-stage-per-run rule. Skips an invoice
// with a genuinely in-flight PayPal order (see
// payment-schedule/repository.ts's findActivePaymentAttempt) — no point
// nudging someone whose payment is just waiting on a slow webhook.
// reminder_24h additionally skips an invoice the client already declined;
// the discount stages do NOT — those fire whether the client explicitly
// declined or simply never responded, by design.
export async function findDueRecoveries(now = new Date()): Promise<DueRecovery[]> {
  const deposits = await unpaidDepositInvoicesWithClient();
  const due: DueRecovery[] = [];

  for (const { invoice, clientName, clientEmail } of deposits) {
    if (!clientEmail) continue; // no channel to reach them on

    const activePayment = await findActivePaymentAttempt(invoice.id, now);
    if (activePayment) continue;

    const sent = await sentStages(invoice.id);
    const stage = nextRecoveryStageToSend(invoice.createdAt, now, sent);
    if (stage === null) continue;

    if (stage === "reminder_24h" && (await isDeclined(invoice.id))) continue;

    due.push({ invoice, clientName, clientEmail, stage });
  }

  return due;
}

// The unique(invoiceId, stage) constraint is the real safety net against a
// duplicate send — this insert is what a concurrent/duplicate cron run
// would fail on, same pattern as every other recovery/reminder table.
export async function recordRecoverySent(invoiceId: number, stage: RecoveryStage, emailId: string | null): Promise<void> {
  await db.insert(paymentRecoveryAlertsTable).values({ invoiceId, stage, emailId });
}

// Client-triggered, not cron-driven — called from the public decline route.
// Idempotent: a second click just returns the existing record instead of
// inserting again (the unique constraint would reject a raw duplicate
// insert anyway, but checking first avoids surfacing that as an error).
export async function recordDeclineIfNew(invoiceId: number, emailId: string | null): Promise<{ alreadyDeclined: boolean }> {
  if (await isDeclined(invoiceId)) return { alreadyDeclined: true };
  await db.insert(paymentRecoveryAlertsTable).values({ invoiceId, stage: "declined", emailId });
  return { alreadyDeclined: false };
}

// True once a 30d or 60d reactivation email has ever gone out for this
// invoice — the 10% discount then applies to every future price
// computation (create-paypal-order, the public GET view), permanently,
// computed fresh each time. invoices.amount itself is never touched.
export async function invoiceHasActiveDiscount(invoiceId: number): Promise<boolean> {
  const rows = await db.select({ id: paymentRecoveryAlertsTable.id })
    .from(paymentRecoveryAlertsTable)
    .where(and(eq(paymentRecoveryAlertsTable.invoiceId, invoiceId), inArray(paymentRecoveryAlertsTable.stage, DISCOUNT_STAGES)));
  return rows.length > 0;
}
