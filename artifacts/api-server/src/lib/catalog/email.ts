import { Resend } from "resend";
import type { OversoldItem } from "./repository";

const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";

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

// Internal ops alert only — never client-facing. Fired once per order, from
// the PAYMENT.CAPTURE.COMPLETED webhook handler, only when
// markOrderPaidAndDecrementStock's conditional decrement didn't apply for
// one or more items (see repository.ts). The charge already went through
// and can't be undone here — this exists so staff finds out and resolves
// it manually with the client (partial refund, backorder, substitution),
// instead of the oversell going unnoticed until the client complains.
export async function sendOversoldAlertEmail(orderId: number, items: OversoldItem[]): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const rows = items
    .map((item) => `<li style="margin-bottom:6px;"><strong>${escapeHtml(item.nameSnapshot)}</strong> — pedidas ${item.quantityOrdered}, sin inventario suficiente al momento de confirmar el pago (producto <code>${escapeHtml(item.productId)}</code>)</li>`)
    .join("");

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">⚠️ Sobreventa detectada — orden #${orderId}</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Esta orden ya fue pagada (el cargo en PayPal no se puede revertir desde aquí), pero el inventario no alcanzó para uno o más productos al momento de confirmar el pago — normalmente dos compradores compitiendo por las últimas unidades. Necesita resolverse a mano con el cliente final: reembolso parcial, backorder, o sustitución.</p>
            <ul style="color:#c8c3dd; font-size:15px; line-height:1.6; margin:0 0 18px 0; padding-left:20px;">${rows}</ul>
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
    subject: `⚠️ Sobreventa — orden #${orderId}`,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}
