import { Resend } from "resend";
import type { Invoice } from "@workspace/db";
import type { ReminderStage } from "./eligibility";

// Same branding/encoding pattern as commercial-followup/email.ts — reused
// deliberately, not reinvented here.
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

function formatAmount(amount: string): string {
  return `$${parseFloat(amount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function shell(heading: string, bodyParagraphs: string[], ctaHref: string | undefined, ctaLabel: string | undefined, accentColor: string): string {
  const cta = ctaHref && ctaLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
         <tr><td style="border-radius:8px; background-color:${accentColor};"><a href="${ctaHref}" style="display:inline-block; padding:12px 24px; color:#06060f; font-size:14px; font-weight:700; text-decoration:none;">${ctaLabel}</a></td></tr>
       </table>`
    : "";
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

// Internal alert to Coimagen staff. First draft copy, not yet reviewed the
// way P-80's approved templates were — functional, not final marketing
// copy. WhatsApp delivery (the original P-69 ask) is deferred to a later
// phase; this is email-only for now, see invoice-reminders.ts schema comment.
export async function sendStaffAlertEmail(invoice: Invoice, clientName: string, stage: ReminderStage): Promise<string> {
  const number = escapeHtml(invoice.number);
  const name = escapeHtml(clientName);
  const amount = formatAmount(invoice.amount);
  const due = invoice.dueDate ? formatDate(invoice.dueDate) : "(sin fecha)";

  const heading = stage === "overdue"
    ? `Factura ${number} vencida`
    : `Factura ${number} vence pronto`;
  const bodyParagraphs = stage === "overdue"
    ? [`La factura <strong>${number}</strong> de <strong>${name}</strong> por <strong>${amount}</strong> venció el ${due} y sigue marcada como no pagada.`]
    : [`La factura <strong>${number}</strong> de <strong>${name}</strong> por <strong>${amount}</strong> vence el ${due}.`];

  const subject = stage === "overdue" ? `⚠️ Factura ${number} vencida — ${name}` : `⏳ Factura ${number} vence pronto — ${name}`;
  const accent = stage === "overdue" ? "#f87171" : "#facc15";
  const html = shell(heading, bodyParagraphs, "https://os.coimagenmedia.com/revenue", "Ver facturación →", accent);

  return send(TEAM_ADDRESS, subject, html);
}

// Client-facing reminder. Spanish-only for v1 — invoices/clients have no
// language field to key off (unlike prospectsTable.language, used by
// commercial-followup), so bilingual support would need a schema addition
// first. Revisit if a non-Spanish-speaking client ever needs this.
export async function sendClientReminderEmail(invoice: Invoice, clientName: string, clientEmail: string, stage: ReminderStage): Promise<string> {
  const number = escapeHtml(invoice.number);
  const name = escapeHtml(clientName);
  const amount = formatAmount(invoice.amount);
  const due = invoice.dueDate ? formatDate(invoice.dueDate) : "(sin fecha)";

  const heading = stage === "overdue"
    ? `${name}, tu factura ${number} está vencida`
    : `${name}, tu factura ${number} vence pronto`;
  const bodyParagraphs = stage === "overdue"
    ? [
        `Hola ${name},`,
        `Tu factura <strong>${number}</strong> por <strong>${amount}</strong> venció el ${due} y todavía no la tenemos registrada como pagada. Si ya la pagaste, ignora este correo — si no, te pedimos ponerte al día a la brevedad.`,
      ]
    : [
        `Hola ${name},`,
        `Te recordamos que tu factura <strong>${number}</strong> por <strong>${amount}</strong> vence el ${due}.`,
      ];

  const subject = stage === "overdue" ? `Tu factura ${number} está vencida` : `Tu factura ${number} vence pronto`;
  const accent = stage === "overdue" ? "#f87171" : "#00cfff";
  const html = shell(heading, bodyParagraphs, "https://wa.me/526644769223", "Hablar por WhatsApp →", accent);

  return send(clientEmail, subject, html);
}
