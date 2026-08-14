import { CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import type { Invoice } from "@workspace/db";
import { getPaypalClient } from "./client";
import { applyFiscalInvoice } from "../payment-schedule/generate";

export interface CreatedOrder {
  paypalOrderId: string;
  totalAmount: number;
  ivaAmount: number;
  currency: string;
}

// Creates a PayPal order for one invoice (cuota). The amount charged is
// computed entirely server-side from the invoice's own `amount` +
// `currency` plus the client's fiscal-invoice choice for THIS charge — a
// client-supplied amount is never trusted. `requiresFiscalInvoice` is
// applied here (not read from the invoice row) because it's the value the
// client is choosing right now, on this specific payment attempt; the
// caller is responsible for persisting it via
// payment-schedule/repository.ts's setRequiresFiscalInvoice before calling
// this, so the invoice row and the actual PayPal charge always agree.
export async function createOrder(invoice: Invoice, requiresFiscalInvoice: boolean): Promise<CreatedOrder> {
  const { totalAmount, ivaAmount } = applyFiscalInvoice(parseFloat(invoice.amount), requiresFiscalInvoice);
  const { orders } = getPaypalClient();

  const { result } = await orders.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          referenceId: String(invoice.id),
          invoiceId: invoice.number,
          amount: { currencyCode: invoice.currency, value: totalAmount.toFixed(2) },
        },
      ],
    },
    prefer: "return=minimal",
  });

  if (!result.id) {
    throw new Error("PayPal no devolvió un order id al crear la orden");
  }

  return { paypalOrderId: result.id, totalAmount, ivaAmount, currency: invoice.currency };
}

export interface CaptureResult {
  status: string;
  captureId: string | null;
}

// Synchronous capture call — used only for optimistic UI feedback on the
// public page. It deliberately does NOT touch invoices.status or
// invoice_payments.status itself; the webhook handler
// (routes/webhooks-paypal.ts) is the only place that does, using
// PAYMENT.CAPTURE.COMPLETED as the durable source of truth. See that
// file's comment for why (PayPal's capture response can succeed even if
// this process crashes immediately after, before it could act on it).
export async function captureOrder(paypalOrderId: string): Promise<CaptureResult> {
  const { orders } = getPaypalClient();
  const { result } = await orders.captureOrder({ id: paypalOrderId, prefer: "return=minimal" });
  const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
  return { status: result.status ?? "UNKNOWN", captureId: capture?.id ?? null };
}
