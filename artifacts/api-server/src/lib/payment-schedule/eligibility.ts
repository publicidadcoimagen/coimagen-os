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
const ORDER_EXPIRY_MS = 3 * 60 * 60 * 1000;

export function isPaymentAttemptStillActive(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < ORDER_EXPIRY_MS;
}
