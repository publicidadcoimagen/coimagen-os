import { Resend } from "resend";

const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";

// Same wrapper/from/to as anthropic-balance-alert/email.ts and
// client-room-error-alert — generalized to take a subject and body lines
// per call instead of a fixed per-alert-type template, since this module
// serves any agent/category combination, not one fixed alert.
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

// Internal ops alert only — never client-facing. No retry loop; a failed
// send here just means the cooldown already recorded and the next
// qualifying event tries again once it elapses.
export async function notifyStaff(subject: string, bodyLines: string[]): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const paragraphs = bodyLines
    .map((line) => `<p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">${line}</p>`)
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${subject}</h1>
            ${paragraphs}
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
    subject,
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}
