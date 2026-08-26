import { Resend } from "resend";
import { COOLDOWN_MINUTES, type ClientRoomCrashReport } from "./repository";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Internal ops alert only — never client-facing. Fires the moment
// ClientRoomErrorBoundary catches a render crash, so staff hears about a
// broken Client Room before the client has to say anything (2026-08-26,
// in response to the useLang-outside-LanguageProvider incident going
// unnoticed for 9 days with no error boundary and no alert at all).
export async function sendClientRoomCrashAlertEmail(report: ClientRoomCrashReport, incidentId: number): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">🚨 Client Room caído — /client/${escapeHtml(report.slug)}</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Un error de React tumbó por completo esta página — pantalla en negro para quien la haya visto, sin nada visible del error.</p>
            <p style="color:#c8c3dd; font-size:14px; line-height:1.65; margin:0 0 8px 0;"><strong>Usuario:</strong> ${escapeHtml(report.userEmail ?? report.userId)} (${escapeHtml(report.userRole)})</p>
            <p style="color:#c8c3dd; font-size:14px; line-height:1.65; margin:0 0 8px 0;"><strong>Ruta:</strong> ${escapeHtml(report.path)}</p>
            <p style="color:#c8c3dd; font-size:14px; line-height:1.65; margin:0 0 18px 0;"><strong>Error:</strong> ${escapeHtml(report.message)}</p>
            <p style="color:#8f89a8; font-size:13px; line-height:1.6; margin:0;">Detalle completo (stack, component stack) en el incidente #${incidentId}. No recibirás otra alerta de esto por al menos ${COOLDOWN_MINUTES} minutos, aunque el problema siga ocurriendo.</p>
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
    subject: `🚨 Client Room caído — /client/${report.slug}`,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}
