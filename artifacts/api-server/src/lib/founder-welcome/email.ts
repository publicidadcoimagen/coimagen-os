import { Resend } from "resend";
import { logger } from "../logger";

// Same branding/encoding pattern as lib/commercial-followup/email.ts and
// lib/digital-diagnosis/email.ts — reused deliberately, not reinvented here.
const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";
const TEAM_ADDRESS = "info@coimagenmedia.com";

function wrapEmailHtml(bodyHtml: string, lang: "es" | "en"): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
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

// Text approved by Camila 2026-08-10 (correo-bienvenida-fundador-texto-final-ES-EN.md).
// Do not reword — this copy is final.
function founderWelcomeBody(name: string, founderNumber: number, packageName: string, lang: "es" | "en"): string {
  const n = escapeHtml(name);
  const pkg = escapeHtml(packageName);

  if (lang === "en") {
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">🎉 Welcome, Founder #${founderNumber} of Coimagen!</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hi ${n},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Congratulations and thank you for trusting us as one of our first founding clients! Being Founder #${founderNumber} means you're part of the group helping us build Coimagen from the ground up — and that comes with terms you won't see again later.</p>
            <p style="color:#ffffff; font-size:15px; line-height:1.65; margin:0 0 12px 0; font-weight:600;">What this means for you:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(0,207,255,0.08); border-left:3px solid #00cfff; border-radius:8px; margin:0 0 24px 0;">
              <tr><td style="padding:18px 20px;">
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0 0 12px 0;">✅ No setup fee — normally there's a cost, for you it's <strong style="color:#00cfff;">$0</strong>.</p>
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0 0 12px 0;">✅ Your first payment is split in two: a deposit now, and the final payment once we approve the finished work together.</p>
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0;">✅ Starting month two, you pay your full monthly rate for the <strong style="color:#00cfff;">${pkg}</strong> plan, as normal.</p>
              </td></tr>
            </table>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">In return, we just ask for one simple thing: once you have results to show, we'd love your feedback/testimonial to share with future clients — no pressure, no deadline.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 28px 0;">Any questions, we're here.</p>
            <p style="color:#8f89a8; font-size:14px; margin:0;">Welcome to Coimagen,<br><span style="color:#c8c3dd;">The team</span></p>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
  }

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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">🎉 ¡Bienvenido, Fundador #${founderNumber} de Coimagen!</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${n},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">¡Felicidades y gracias por confiar en nosotros como uno de nuestros primeros clientes fundadores! Ser Fundador #${founderNumber} significa que formas parte del grupo que nos ayuda a construir Coimagen desde el inicio — y por eso tienes condiciones que no se repiten después.</p>
            <p style="color:#ffffff; font-size:15px; line-height:1.65; margin:0 0 12px 0; font-weight:600;">Lo que esto significa para ti:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(0,207,255,0.08); border-left:3px solid #00cfff; border-radius:8px; margin:0 0 24px 0;">
              <tr><td style="padding:18px 20px;">
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0 0 12px 0;">✅ No pagas configuración inicial — normalmente tiene costo, para ti es <strong style="color:#00cfff;">$0</strong>.</p>
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0 0 12px 0;">✅ Tu primer pago se divide en dos partes: un anticipo ahora, y el pago final cuando aprobemos juntos el trabajo terminado.</p>
                <p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0;">✅ A partir del segundo mes, pagas tu mensualidad completa del plan <strong style="color:#00cfff;">${pkg}</strong>, normal.</p>
              </td></tr>
            </table>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">A cambio, solo te pedimos algo sencillo: cuando tengas resultados que mostrar, nos encantaría contar con tu opinión/testimonio para compartir con futuros clientes — sin presión ni fecha límite.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 28px 0;">Cualquier duda, aquí estamos.</p>
            <p style="color:#8f89a8; font-size:14px; margin:0;">Bienvenido a Coimagen,<br><span style="color:#c8c3dd;">El equipo</span></p>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

const SUBJECTS: Record<"es" | "en", (n: number) => string> = {
  es: (n) => `🎉 ¡Bienvenido, Fundador #${n} de Coimagen!`,
  en: (n) => `🎉 Welcome, Founder #${n} of Coimagen!`,
};

export async function sendFounderWelcomeEmail(
  name: string,
  email: string,
  founderNumber: number,
  packageName: string,
  lang: "es" | "en",
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const subject = SUBJECTS[lang](founderNumber);
  const html = wrapEmailHtml(founderWelcomeBody(name, founderNumber, packageName, lang), lang);
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    replyTo: TEAM_ADDRESS,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  const emailId = data?.id ?? "(sin id)";
  logger.info({ email, founderNumber, emailId }, "Correo de bienvenida de Fundador enviado");
  return emailId;
}
