import { Resend } from "resend";
import type { MonthlySummary } from "./aggregate";

// Same branding/encoding pattern as invoice-reminders/commercial-followup's
// email.ts — deliberately duplicated per-module, not shared, matching this
// codebase's existing convention.
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

function shell(heading: string, bodyHtmlBlocks: string[]): string {
  const blocks = bodyHtmlBlocks.join("");
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
            ${blocks}
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
  if (!apiKey) throw new Error("RESEND_API_KEY no está configurada");
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({ from: FROM_ADDRESS, to, replyTo: TEAM_ADDRESS, subject, html: wrapEmailHtml(html) });
  if (error) throw new Error(error.message);
  return data?.id ?? "(sin id)";
}

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatMonthEs(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES_ES[Number(m) - 1]} de ${year}`;
}

// Plain HTML — no PDF, no generated attachment. Matches the existing
// practice of every recurring report in this codebase (invoice-reminders,
// commercial-followup): a correo, not a document. See pendientes-5-6 design
// doc for why this isn't a new decision.
export async function sendSocialMonthlyReportEmail(clientEmail: string, clientName: string, month: string, summary: MonthlySummary): Promise<string> {
  const name = escapeHtml(clientName);
  const monthLabel = formatMonthEs(month);

  const networkRows = Object.entries(summary.byNetwork)
    .map(([network, count]) => `<li style="color:#c8c3dd; font-size:14px; margin-bottom:6px;">${escapeHtml(network)}: <strong style="color:#ffffff;">${count}</strong></li>`)
    .join("");

  const bodyBlocks = [
    `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${name}, este es el resumen de tu Autopublicador Social de <strong>${monthLabel}</strong>.</p>`,
    `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 8px 0;">Publicaciones realizadas: <strong style="color:#ffffff;">${summary.publishedCount}</strong></p>`,
    networkRows ? `<ul style="margin:0 0 18px 0; padding-left:20px;">${networkRows}</ul>` : "",
    `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Costo de IA usado este mes: <strong style="color:#ffffff;">$${summary.totalCostUsd.toFixed(4)} USD</strong></p>`,
    `<p style="color:#5c5675; font-size:13px; line-height:1.6; margin:0;">Métricas de alcance/engagement: próximamente — pendiente de activar la integración con Metricool.</p>`,
  ];

  const html = shell(`Tu resumen de ${monthLabel}`, bodyBlocks);
  return send(clientEmail, `Resumen de Autopublicador Social — ${monthLabel}`, html);
}
