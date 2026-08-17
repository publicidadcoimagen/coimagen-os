import { Resend } from "resend";

const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";
const ACCOUNTANT_ADDRESS = "contaapp.cdmx@gmail.com";

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

function formatAmount(amount: number, currency: string): string {
  return `$${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

interface FiscalAlertInput {
  clientName: string;
  label: string; // e.g. "Anticipo (50%)" or "Mensualidad — Plan Pro"
  rfc: string;
  razonSocial: string;
  amount: number;
  ivaAmount: number;
  currency: string;
  constanciaBuffer: Buffer;
  constanciaFileName: string;
}

// Alert sent directly to the accountant (Camila CC'd) once a payment that
// requested a Mexican fiscal invoice actually captured — carries RFC, razón
// social, monto+IVA, and the constancia attached, so the accountant can issue
// the real CFDI outside this system. Fired once per captured payment (each
// cuota independently for CASO 1, once per month for CASO 2's recurring
// charges) — never batched across payments.
export async function sendFiscalInvoiceAlertEmail(input: FiscalAlertInput): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no está configurada");

  const name = escapeHtml(input.clientName);
  const label = escapeHtml(input.label);
  const rfc = escapeHtml(input.rfc);
  const razonSocial = escapeHtml(input.razonSocial);
  const subtotal = input.amount - input.ivaAmount;

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">🧾 Factura fiscal solicitada — ${name}</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;"><strong>${name}</strong> pagó <strong>${label}</strong> y pidió factura fiscal mexicana. Datos para el contador:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
              <tr><td style="color:#8b86a3; font-size:13px; padding:4px 0;">RFC</td><td style="color:#ffffff; font-size:13px; padding:4px 0; text-align:right;">${rfc}</td></tr>
              <tr><td style="color:#8b86a3; font-size:13px; padding:4px 0;">Razón social</td><td style="color:#ffffff; font-size:13px; padding:4px 0; text-align:right;">${razonSocial}</td></tr>
              <tr><td style="color:#8b86a3; font-size:13px; padding:4px 0;">Subtotal</td><td style="color:#ffffff; font-size:13px; padding:4px 0; text-align:right;">${formatAmount(subtotal, input.currency)}</td></tr>
              <tr><td style="color:#8b86a3; font-size:13px; padding:4px 0;">IVA (16%)</td><td style="color:#ffffff; font-size:13px; padding:4px 0; text-align:right;">${formatAmount(input.ivaAmount, input.currency)}</td></tr>
              <tr><td style="color:#00cfff; font-size:14px; font-weight:700; padding:8px 0 0 0; border-top:1px solid rgba(255,255,255,0.08);">Total cobrado</td><td style="color:#00cfff; font-size:14px; font-weight:700; padding:8px 0 0 0; border-top:1px solid rgba(255,255,255,0.08); text-align:right;">${formatAmount(input.amount, input.currency)}</td></tr>
            </table>
            <p style="color:#8b86a3; font-size:13px; line-height:1.6; margin:0;">La constancia de situación fiscal va adjunta a este correo.</p>
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
    to: ACCOUNTANT_ADDRESS,
    cc: TEAM_ADDRESS,
    replyTo: TEAM_ADDRESS,
    subject: `🧾 Factura fiscal solicitada — ${input.clientName}`,
    html: wrapEmailHtml(html),
    attachments: [{ content: input.constanciaBuffer, filename: input.constanciaFileName }],
  });
  if (error) throw new Error(error.message);
  return data?.id ?? "(sin id)";
}

interface FiscalDocumentInput {
  clientEmail: string;
  clientName: string;
  invoiceLabel: string;
  documentBuffer: Buffer;
  fileName: string;
}

// The real CFDI, once staff uploads it (finance/invoices.tsx) — delivered
// straight to the client with the PDF attached, no further action needed
// from Camila beyond the upload itself.
export async function sendFiscalDocumentToClientEmail(input: FiscalDocumentInput): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no está configurada");

  const name = escapeHtml(input.clientName);
  const label = escapeHtml(input.invoiceLabel);

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">🧾 Tu factura fiscal</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola <strong>${name}</strong>, adjunta va tu factura fiscal (CFDI) correspondiente a <strong>${label}</strong>.</p>
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
    to: input.clientEmail,
    replyTo: TEAM_ADDRESS,
    subject: `🧾 Tu factura fiscal — ${input.invoiceLabel}`,
    html: wrapEmailHtml(html),
    attachments: [{ content: input.documentBuffer, filename: input.fileName }],
  });
  if (error) throw new Error(error.message);
  return data?.id ?? "(sin id)";
}
