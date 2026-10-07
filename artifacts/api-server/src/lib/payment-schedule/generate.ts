// Pure money math for P-payments — no DB, no network, unit-testable in
// isolation. Splits a proposal's total project amount into the invoice
// installments defined by Contrato Maestro V2, cláusula 4.

export type PaymentPlan = "standard" | "large";

export interface InstallmentSpec {
  label: string;
  percentage: number;
  amount: number;
}

// [label, percentage] pairs per plan, in the order they're invoiced.
const PLAN_INSTALLMENTS: Record<PaymentPlan, Array<[string, number]>> = {
  standard: [
    ["Anticipo (50%)", 0.5],
    ["Pago final (50%)", 0.5],
  ],
  large: [
    ["Anticipo (50%)", 0.5],
    ["Hito intermedio (25%)", 0.25],
    ["Lanzamiento (25%)", 0.25],
  ],
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Splits totalAmount across the plan's installments. Every installment
// except the last is rounded independently to 2 decimals; the last one
// absorbs whatever rounding remainder is left, so the installments always
// sum to exactly totalAmount — no $0.01 discrepancy vs. the proposal total
// (and nothing to reconcile later against proposals.amount).
export function generateInstallments(totalAmount: number, paymentPlan: PaymentPlan): InstallmentSpec[] {
  const plan = PLAN_INSTALLMENTS[paymentPlan];
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error(`Monto de proyecto inválido para generar cuotas: ${totalAmount}`);
  }
  // Explicit zero path (pro-bono / setup $0): every cuota is exactly 0, never
  // a rounding artifact. Downstream, zero cuotas are never sent to PayPal —
  // see isZeroAmount below and advanceNextInstallment.
  if (totalAmount === 0) return plan.map(([label, percentage]) => ({ label, percentage, amount: 0 }));
  const installments: InstallmentSpec[] = [];
  let allocated = 0;

  plan.forEach(([label, percentage], i) => {
    const isLast = i === plan.length - 1;
    const amount = isLast ? round2(totalAmount - allocated) : round2(totalAmount * percentage);
    allocated += amount;
    installments.push({ label, percentage, amount });
  });

  return installments;
}

// Founders (P-79/routes/clients.ts mark-founder) never get a separate setup
// fee — but there's no special branch needed here to enforce that: this
// function only ever generates the deposit/milestone/final cuotas derived
// from proposals.amount, never an additional line item. "No setup fee for
// founders" is satisfied by construction, as long as staff never enters a
// separate setup charge into proposals.amount for a founder's proposal —
// that's a process discipline, not something this function can check.

const IVA_RATE = 0.16;

export interface FiscalCharge {
  baseAmount: number;
  ivaAmount: number;
  totalAmount: number;
}

// Client's explicit choice (invoices.requiresFiscalInvoice), never automatic.
// IVA is always 16% flat — Coimagen only ever issues Mexican fiscal
// invoices, regardless of the client's own country or the invoice's
// currency (MXN or USD) — no currency conversion happens here, `baseAmount`
// and the result are in whatever currency the invoice already uses.
export function applyFiscalInvoice(baseAmount: number, requiresFiscalInvoice: boolean): FiscalCharge {
  if (!requiresFiscalInvoice) {
    return { baseAmount, ivaAmount: 0, totalAmount: baseAmount };
  }
  const ivaAmount = round2(baseAmount * IVA_RATE);
  return { baseAmount, ivaAmount, totalAmount: round2(baseAmount + ivaAmount) };
}

// Payment-recovery win-back discount (lib/payment-recovery/) — a flat 10%
// off once a 30d/60d reactivation email has ever gone out for this invoice.
// Applied to the BASE amount, before applyFiscalInvoice — a client who also
// wants a fiscal invoice pays 16% IVA on the already-discounted price, not
// on the original one. Deliberately takes a plain boolean, not a DB lookup:
// the caller (lib/payment-recovery/repository.ts's invoiceHasActiveDiscount)
// resolves whether the discount applies, this function only ever does the
// arithmetic — same separation as applyFiscalInvoice above.
const RECOVERY_DISCOUNT_RATE = 0.10;

export function applyRecoveryDiscount(baseAmount: number, discountApplied: boolean): number {
  return discountApplied ? round2(baseAmount * (1 - RECOVERY_DISCOUNT_RATE)) : baseAmount;
}

// Numeric money checks for values stored as Postgres numeric (strings like
// "0", "0.00", "1499.50"). A non-empty string is truthy in JS, so
// `!proposal.monthlyAmount` treated "0" as a real recurring fee — always
// compare numerically.
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isZeroAmount(value: string | number | null | undefined): boolean {
  return toNumber(value) === 0;
}

// What happens once every cuota of a proposal is paid:
// - "none": no monthly fee on the proposal (one-off project) → nothing.
// - "internal_zero": monthly fee is exactly 0 (pro-bono) → an internal
//   active $0 subscription, no PayPal, no fiscal question.
// - "paypal": a real monthly fee → pending_authorization + PayPal flow.
export type RecurringPlan = "none" | "internal_zero" | "paypal";

export function recurringPlanFor(monthlyAmount: string | number | null | undefined): RecurringPlan {
  const n = toNumber(monthlyAmount);
  if (n === null) return "none";
  if (n === 0) return "internal_zero";
  if (n < 0) throw new Error(`Mensualidad inválida: ${monthlyAmount}`);
  return "paypal";
}
