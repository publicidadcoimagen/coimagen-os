import { Resend } from "resend";

const RESULTS_PAGE_BASE_URL = "https://www.coimagenmedia.com/diagnostico/resultado";

// No verified sending domain yet — onboarding@resend.dev is Resend's shared
// testing address, usable without domain verification. Swap once a domain
// (e.g. coimagenmedia.com) is verified in Resend.
const FROM_ADDRESS = "Coimagen Media Agency <onboarding@resend.dev>";

function buildEmailHtml(name: string, resultUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #00cfff; margin: 0 0 16px;">
        Coimagen Media Agency
      </p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">¡Hola${name ? ` ${name}` : ""}! Tu diagnóstico digital está listo.</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0 0 24px;">
        Analizamos tu sitio web y preparamos un reporte con tu puntaje digital y un plan de acción
        priorizado para mejorar tu presencia en línea.
      </p>
      <a
        href="${resultUrl}"
        style="display: inline-block; background: #00cfff; color: #06060f; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px;"
      >
        Ver mi diagnóstico →
      </a>
      <p style="font-size: 12px; color: #999; margin: 32px 0 0;">
        Coimagen Media Agency · Tijuana / San Diego
      </p>
    </div>
  `;
}

// Best-effort — the caller decides how to handle a thrown error (the
// diagnosis itself is already saved and viewable regardless of email
// delivery, so a failure here should never fail the API response). Returns
// the Resend message id on success, useful for log correlation.
export async function sendDigitalDiagnosisEmail(name: string, email: string, publicToken: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const resultUrl = `${RESULTS_PAGE_BASE_URL}/${publicToken}`;
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Tu diagnóstico digital de Coimagen está listo",
    html: buildEmailHtml(name, resultUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? "(sin id)";
}
