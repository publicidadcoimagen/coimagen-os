// Pure date-math — no DB, no network. PayPal's own Orders v2 API
// auto-expires an unconfirmed order 3 hours after creation
// (https://developer.paypal.com/docs/api/orders/v2/#definition-order_status)
// — an invoice_payments row stuck at "created"/"approved" past that window
// is PayPal's own order having already died on their end, not a live
// in-flight payment, so it must stop blocking a retry. Below the window, it
// IS still live and a second create-paypal-order call must be blocked —
// otherwise a client whose webhook confirmation is just slow (see
// PaymentBox.tsx's ~20s pollUntilPaid) could end up paying twice for the
// same cuota.
//
// Lowered from 3h to 15min (2026-09-23, Camila's call): the 3h backstop was
// meant only for the "client closes the whole tab" case (see PR #84's
// onCancel/cancel-paypal-order, which already releases the guard
// immediately for a normal cancel) — 3h of no recourse for that one edge
// case was too long a real client could be stuck with no way to pay by any
// method. 15min stays comfortably above pollUntilPaid's ~20s and any normal
// webhook delay, while capping the worst case to something a client would
// plausibly just wait out or a staff member can now release directly (see
// routes/invoices.ts's release-payment-attempt endpoint) instead of relying
// on this window alone.
const ORDER_EXPIRY_MS = 15 * 60 * 1000;

export function isPaymentAttemptStillActive(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < ORDER_EXPIRY_MS;
}
