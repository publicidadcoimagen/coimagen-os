import { Resend } from "resend";

const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";
const PORTAL_LOGIN_URL = "https://os.coimagenmedia.com/";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

// Credentials shown in plaintext exactly once, in this one email — never
// logged, never persisted anywhere but the hashed account row. The client
// is forced to change it on first login (forcePasswordReset, enforced
// server-side by authMiddleware.ts), so this value stops being valid the
// moment they do.
export async function sendPortalCredentialsEmail(
  clientEmail: string,
  clientName: string,
  temporaryPassword: string,
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const name = escapeHtml(clientName);
  const email = escapeHtml(clientEmail);
  const password = escapeHtml(temporaryPassword);

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${name}, ya tienes acceso a tu portal</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${name},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Creamos tu cuenta en el portal de Coimagen. Estas son tus credenciales temporales — te pediremos cambiar la contraseña la primera vez que inicies sesión.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 24px 0; background-color:rgba(255,255,255,0.05); border-radius:10px;">
              <tr><td style="padding:16px 20px;">
                <p style="color:#8a84a5; font-size:12px; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:0.5px;">Correo</p>
                <p style="color:#ffffff; font-size:15px; margin:0 0 14px 0; font-family:monospace;">${email}</p>
                <p style="color:#8a84a5; font-size:12px; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:0.5px;">Contraseña temporal</p>
                <p style="color:#ffffff; font-size:15px; margin:0; font-family:monospace;">${password}</p>
              </td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr><td style="border-radius:8px; background-color:#00cfff;"><a href="${PORTAL_LOGIN_URL}" style="display:inline-block; padding:12px 24px; color:#06060f; font-size:14px; font-weight:700; text-decoration:none;">Entrar a tu portal →</a></td></tr>
            </table>
            <p style="color:#8a84a5; font-size:13px; line-height:1.6; margin:0;">Si no esperabas este correo o tienes dudas, contáctanos y con gusto te ayudamos.</p>
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
    subject: "Ya tienes acceso a tu portal Coimagen",
    html: wrapEmailHtml(html),
  });
  if (error) {
    throw new Error(error.message);
  }
  return data?.id ?? "(sin id)";
}
