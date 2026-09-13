import { Resend } from "resend";

const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";
// Same public /factura/:token page every other payable invoice in this
// codebase links to (see payment-recovery/email.ts) — the surcharge is a
// real invoices row with its own publicToken, not a special page.
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

// Internal alert to Coimagen staff — a client paid their full project but
// never clicked through PayPal's recurring-billing approval link. First
// draft copy, functional not final marketing copy.
export async function sendStaleSubscriptionAlertEmail(clientName: string, subscriptionId: number): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const name = escapeHtml(clientName);
  const html = `
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">Suscripción sin autorizar — ${name}</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;"><strong>${name}</strong> completó el pago del proyecto hace 3 días o más, pero todavía no autorizó el cobro mensual recurrente en PayPal (suscripción #${subscriptionId}, estado <code>pending_authorization</code>). Necesita seguimiento para que confirme el link de PayPal y active la mensualidad.</p>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: TEAM_ADDRESS,
    replyTo: TEAM_ADDRESS,
    subject: `⚠️ Suscripción sin autorizar — ${clientName}`,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}

function formatAmount(amount: string): string {
  return `$${parseFloat(amount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

// Día 0 of the escalera de pago tardío (Cláusula 9) — the client's own
// notice that their recurring charge failed, sent from
// handleRecurringPaymentFailed alongside (not instead of) the staff alert
// above. Links to the Client Room login rather than a wa.me CTA (unlike
// invoice-reminders' client email) — Camila's instruction: the client
// already has a portal credential, use it, and the overdue invoice this
// same webhook creates (see webhooks-paypal.ts) is what they'll find once
// they log in and open Facturas.
export async function sendPaymentFailedClientEmail(clientEmail: string, clientName: string, plan: string, amount: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const name = escapeHtml(clientName);
  const planLabel = escapeHtml(plan);
  const amountLabel = formatAmount(amount);
  const html = `
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${name}, no pudimos procesar tu pago mensual</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${name},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">El cobro mensual de tu plan <strong>${planLabel}</strong> por <strong>${amountLabel}</strong> no se pudo procesar. Puedes revisar el detalle iniciando sesión en tu portal con tu cuenta de siempre.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Si el problema no se resuelve, tu cuenta pasa a acceso restringido a partir del quinto día sin pago. Si ya resolviste esto o tienes dudas, contáctanos y con gusto te ayudamos.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr><td style="border-radius:8px; background-color:#f87171;"><a href="https://os.coimagenmedia.com/" style="display:inline-block; padding:12px 24px; color:#06060f; font-size:14px; font-weight:700; text-decoration:none;">Iniciar sesión →</a></td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: clientEmail,
    replyTo: TEAM_ADDRESS,
    subject: `No pudimos procesar tu pago mensual — ${planLabel}`,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}

// Día 3 of the escalera de pago tardío (Cláusula 9) — a one-time 5%
// surcharge, separate from the mensualidad itself and from the recurring
// billing agreement (never touched here). Unlike Día 0's email (which just
// points at the Client Room login, since the overdue mensualidad shows up
// there automatically), this one links straight to the surcharge's own
// /factura/:token page — a fresh invoice/PayPal Orders API charge the
// client must explicitly approve, not something PayPal can auto-retry.
export async function sendLatePaymentSurchargeEmail(
  clientEmail: string, clientName: string, plan: string, surchargeAmount: number, currency: string, publicToken: string,
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const name = escapeHtml(clientName);
  const planLabel = escapeHtml(plan);
  const amountLabel = `$${surchargeAmount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const payUrl = `${INVOICE_PAGE_BASE_URL}/${publicToken}`;
  const html = `
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${name}, se aplicó un recargo por pago tardío</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${name},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Tu plan <strong>${planLabel}</strong> lleva 3 días o más sin que se procese el pago mensual. Conforme a los términos de tu contrato, se aplicó un recargo del 5% por <strong>${amountLabel}</strong>, independiente de la mensualidad y de cualquier reintento automático de cobro.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Puedes pagar este recargo directamente aquí:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr><td style="border-radius:8px; background-color:#f87171;"><a href="${payUrl}" style="display:inline-block; padding:12px 24px; color:#06060f; font-size:14px; font-weight:700; text-decoration:none;">Pagar recargo →</a></td></tr>
            </table>
            <p style="color:#8a84a5; font-size:13px; line-height:1.6; margin:0;">Si tu cuenta sigue sin pago después de 5 días, el acceso a tu portal se restringe automáticamente. Si ya resolviste esto o tienes dudas, contáctanos y con gusto te ayudamos.</p>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: clientEmail,
    replyTo: TEAM_ADDRESS,
    subject: `Recargo por pago tardío — ${planLabel}`,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}
