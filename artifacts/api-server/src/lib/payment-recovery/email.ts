import { Resend } from "resend";
import type { Invoice } from "@workspace/db";

// Same branding/encoding pattern as invoice-reminders/email.ts and
// commercial-followup/email.ts — reused deliberately, not reinvented here.
const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";
const INVOICE_PAGE_BASE_URL = "https://www.coimagenmedia.com/factura";

function wrapEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0;">
    ${bodyHtml}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function shell(heading: string, bodyParagraphs: string[], ctas: Array<{ href: string; label: string; primary: boolean }>, accentColor: string): string {
  const ctaHtml = ctas.map(({ href, label, primary }) => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
      <tr><td style="border-radius:8px; ${primary ? `background-color:${accentColor};` : "border:1px solid rgba(255,255,255,0.15);"}">
        <a href="${href}" style="display:inline-block; padding:12px 24px; color:${primary ? "#06060f" : "#c8c3dd"}; font-size:14px; font-weight:${primary ? "700" : "500"}; text-decoration:none;">${label}</a>
      </td></tr>
    </table>`).join("");
  const paragraphs = bodyParagraphs.map((p) => `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">${p}</p>`).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0a1e; padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1235 0%, #241a42 100%); border-radius:16px; overflow:hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <tr><td style="padding:32px 40px 24px 40px; border-bottom:1px solid rgba(255,255,255,0.08);">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:10px;"><img src="https://www.coimagenmedia.com/logo-coimagen.png" alt="Coimagen Media" width="28" height="28" style="display:block; border-radius:6px;"></td>
              <td><span style="color:#ffffff; font-size:18px; font-weight:700; letter-spacing:0.5px;">COIMAGEN <span style="color:#00cfff;">MEDIA</span></span></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:36px 40px;">
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${heading}</h1>
            ${paragraphs}
            ${ctaHtml}
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

async function send(to: string, subject: string, html: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({ from: FROM_ADDRESS, to, replyTo: TEAM_ADDRESS, subject, html: wrapEmailHtml(html) });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}

// Stage 1 (24h) — amable, no de cobranza. The decline link is secondary
// (outlined, not the filled primary button) and goes to a confirmation
// PAGE, never acts directly from this email link itself — a security
// scanner pre-fetching links in transit must never be able to record a
// decline nobody actually clicked (same reasoning as public-proposals.ts's
// approve flow needing an explicit page action, not a bare GET).
export async function sendPaymentReminderEmail(invoice: Invoice, clientName: string, clientEmail: string): Promise<string> {
  const name = escapeHtml(clientName);
  const amount = formatAmount(parseFloat(invoice.amount));
  const payUrl = `${INVOICE_PAGE_BASE_URL}/${invoice.publicToken}`;
  const declineUrl = `${INVOICE_PAGE_BASE_URL}/${invoice.publicToken}/declinar`;

  const heading = `${name}, tu pago sigue pendiente`;
  const bodyParagraphs = [
    `Hola ${name},`,
    `Notamos que tu anticipo de <strong>${amount}</strong> todavía no se ha completado — seguro se te pasó. Aquí puedes retomarlo cuando quieras.`,
  ];
  const html = shell(heading, bodyParagraphs, [
    { href: payUrl, label: "Completar mi pago →", primary: true },
    { href: declineUrl, label: "Ya no quiero continuar", primary: false },
  ], "#00cfff");

  return send(clientEmail, `${name}, tu pago sigue pendiente`, html);
}

// Stages 2/3 (30d/60d) — same /factura/:token link as always. No separate
// "accept the discount" click needed: the page itself shows the
// already-discounted price (InvoicePublicView.discountApplied), computed
// server-side, the moment this email's stage gets recorded — see
// lib/payment-recovery/repository.ts's invoiceHasActiveDiscount.
export async function sendReactivationOfferEmail(invoice: Invoice, clientName: string, clientEmail: string, discountedAmount: number): Promise<string> {
  const name = escapeHtml(clientName);
  const amount = formatAmount(discountedAmount);
  const payUrl = `${INVOICE_PAGE_BASE_URL}/${invoice.publicToken}`;

  const heading = `${name}, tu propuesta con 10% de descuento`;
  const bodyParagraphs = [
    `Hola ${name},`,
    `Nos encantaría retomar tu proyecto. Como agradecimiento, te dejamos un <strong>10% de descuento</strong> — tu anticipo queda en <strong>${amount}</strong>.`,
  ];
  const html = shell(heading, bodyParagraphs, [{ href: payUrl, label: "Ver mi propuesta con descuento →", primary: true }], "#a3e635");

  return send(clientEmail, `${name}, tu propuesta con 10% de descuento`, html);
}

// Internal — fires when the client clicks "ya no quiero continuar".
// Informational only; nothing in PayPal to cancel (see decline route).
export async function sendDeclineNotifiedStaffEmail(invoice: Invoice, clientName: string): Promise<string> {
  const number = escapeHtml(invoice.number);
  const name = escapeHtml(clientName);
  const amount = formatAmount(parseFloat(invoice.amount));

  const heading = `${name} decidió no continuar — factura ${number}`;
  const bodyParagraphs = [
    `<strong>${name}</strong> hizo clic en "ya no quiero continuar" para la factura <strong>${number}</strong> (${amount}). No se canceló nada en PayPal — no había nada que cobrar todavía. Es solo aviso.`,
  ];
  const html = shell(heading, bodyParagraphs, [], "#f87171");

  return send(TEAM_ADDRESS, `${name} decidió no continuar — factura ${number}`, html);
}
