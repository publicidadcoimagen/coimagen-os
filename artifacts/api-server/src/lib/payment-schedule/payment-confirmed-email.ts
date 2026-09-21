import { Resend } from "resend";

// Same branding/encoding pattern as invoice-reminders/email.ts and
// subscription-alerts/email.ts — reused deliberately, not reinvented here.
const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";
const PORTAL_LOGIN_URL = "https://os.coimagenmedia.com/";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatAmount(amount: string, currency: string): string {
  return `$${parseFloat(amount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

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

function shell(heading: string, bodyParagraphs: string[], accentColor: string): string {
  const paragraphs = bodyParagraphs.map((p) => `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">${p}</p>`).join("");
  const cta = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
       <tr><td style="border-radius:8px; background-color:${accentColor};"><a href="${PORTAL_LOGIN_URL}" style="display:inline-block; padding:12px 24px; color:#06060f; font-size:14px; font-weight:700; text-decoration:none;">Ir a tu portal →</a></td></tr>
     </table>`;

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
            ${cta}
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

// Client-facing "thanks, we got it" confirmation. Fires from two distinct
// places — see on-installment-paid.ts (a new proposal's deposit/milestone
// cuota) and webhooks-paypal.ts's handleRecurringPaymentCompleted (the
// monthly recurring charge) — because those are genuinely two different
// payment paths, not one. `reactivatedAccess` must only be true when the
// caller confirmed the client's subscription was actually "past_due"
// immediately before this payment — a brand-new client paying their first
// deposit was never gated, so this is always false from
// on-installment-paid.ts. This email announces the access-gate recovery
// that already happens automatically (subscriptions.status flipping back
// to "active" makes evaluateAccessGate re-read as "full" on its own) — it
// is not a second, separate unblocking mechanism.
export async function sendPaymentConfirmedEmail(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  currency: string,
  reactivatedAccess: boolean,
): Promise<string> {
  const name = escapeHtml(clientName);
  const number = escapeHtml(invoiceNumber);
  const amountLabel = formatAmount(amount, currency);

  const heading = reactivatedAccess
    ? `${name}, tu pago quedó registrado — tu acceso está reactivado`
    : `${name}, gracias por tu pago`;
  const bodyParagraphs = reactivatedAccess
    ? [
        `Hola ${name},`,
        `Recibimos tu pago de la factura <strong>${number}</strong> por <strong>${amountLabel}</strong>. Tu cuenta había quedado con acceso restringido por falta de pago — ya se reactivó automáticamente y puedes seguir usando el sistema con normalidad.`,
      ]
    : [
        `Hola ${name},`,
        `Recibimos tu pago de la factura <strong>${number}</strong> por <strong>${amountLabel}</strong>. Gracias por tu confianza.`,
      ];

  const subject = reactivatedAccess ? `Pago recibido — tu acceso está reactivado` : `Pago recibido — factura ${number}`;
  const html = shell(heading, bodyParagraphs, "#00cfff");

  return send(clientEmail, subject, html);
}
