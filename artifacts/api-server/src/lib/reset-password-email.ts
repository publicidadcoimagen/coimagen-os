import { Resend } from "resend";
import { logger } from "./logger";

// coimagenmedia.com is verified in Resend — same sender as the digital
// diagnosis emails, see digital-diagnosis/email.ts.
const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";

// Email clients don't reliably infer encoding from transport headers alone
// for HTML bodies — without an explicit <meta charset>, accented characters
// render as "�" in some inboxes. Every email HTML body must be a full
// document with this meta tag, not a bare fragment.
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

// Deliberately plain — this is an account-security email, not a marketing
// one. No brand colors or imagery: the less it looks like a promo email,
// the less it looks like phishing.
function buildResetPasswordEmailHtml(url: string): string {
  return wrapEmailHtml(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en Coimagen OS.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        <a href="${url}" style="color: #0066cc;">Restablecer mi contraseña</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #666; margin: 0 0 8px;">
        Este enlace vence en 1 hora. Si no solicitaste este cambio, podés ignorar este correo — tu contraseña actual seguirá siendo válida.
      </p>
    </div>
  `);
}

// Best-effort by design, same as sendDigitalDiagnosisEmail: Better Auth
// already returns its generic "check your email" response to the client
// before this resolves, so a Resend outage here should never surface as a
// 500 on /request-password-reset — just log it and move on.
export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.error("RESEND_API_KEY no está configurada — no se pudo enviar el correo de restablecimiento");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Restablecer tu contraseña — Coimagen OS",
      html: buildResetPasswordEmailHtml(url),
    });
    if (error) {
      throw new Error(error.message);
    }
    logger.info({ resendId: data?.id }, "Correo de restablecimiento de contraseña enviado");
  } catch (err) {
    logger.error({ err }, "No se pudo enviar el correo de restablecimiento de contraseña");
  }
}
