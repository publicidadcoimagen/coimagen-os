import { Resend } from "resend";
import { logger } from "../logger";

const RESULTS_PAGE_BASE_URL = "https://www.coimagenmedia.com/diagnostico/resultado";

// coimagenmedia.com is verified in Resend — no more onboarding@resend.dev
// sandbox restrictions (that address could only send to the account owner).
const FROM_ADDRESS = "Coimagen Media Agency <info@coimagenmedia.com>";

// Where the lead's reply lands, and where the internal new-lead notification
// goes. Same address as FROM_ADDRESS by choice — see PR discussion.
const TEAM_ADDRESS = "info@coimagenmedia.com";

// Email clients don't reliably infer encoding from transport headers alone
// for HTML bodies — without an explicit <meta charset>, accented characters
// (á, é, í, ó, ú, ñ) were rendering as "�" in some inboxes. Every email HTML
// body must be a full document with this meta tag, not a bare fragment.
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

// This function used to be Spanish-only, with no lang parameter at all — the
// lead's language (chosen via the ES/EN toggle on /diagnostico) was never
// sent to the backend, so every lead got the Spanish version regardless of
// which language they used on the site. Fixed alongside P-80, which needs
// the same prospect.language field to pick correo 2/3/4 consistently.
function buildLeadEmailHtml(name: string, resultUrl: string, lang: "es" | "en"): string {
  const greeting = lang === "es"
    ? `¡Hola${name ? ` ${name}` : ""}! Tu diagnóstico digital está listo.`
    : `Hi${name ? ` ${name}` : ""}! Your digital diagnostic is ready.`;
  const body = lang === "es"
    ? "Analizamos tu sitio web y preparamos un reporte con tu puntaje digital y un plan de acción priorizado para mejorar tu presencia en línea."
    : "We analyzed your website and put together a report with your digital score and a prioritized action plan to improve your online presence.";
  const cta = lang === "es" ? "Ver mi diagnóstico →" : "See my diagnostic →";

  return wrapEmailHtml(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #00cfff; margin: 0 0 16px;">
        Coimagen Media Agency
      </p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">${greeting}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0 0 24px;">
        ${body}
      </p>
      <a
        href="${resultUrl}"
        style="display: inline-block; background: #00cfff; color: #06060f; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px;"
      >
        ${cta}
      </a>
      <p style="font-size: 12px; color: #999; margin: 32px 0 0;">
        Coimagen Media Agency · Tijuana / San Diego
      </p>
    </div>
  `, lang);
}

function buildInternalNotificationHtml(name: string, email: string, url: string, resultUrl: string): string {
  return wrapEmailHtml(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #00cfff; margin: 0 0 16px;">
        Nuevo lead — Diagnóstico Digital
      </p>
      <p style="font-size: 14px; line-height: 1.8; color: #444; margin: 0 0 16px;">
        <strong>Nombre:</strong> ${name}<br>
        <strong>Correo:</strong> ${email}<br>
        <strong>Sitio web:</strong> ${url}
      </p>
      <a
        href="${resultUrl}"
        style="display: inline-block; background: #00cfff; color: #06060f; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px;"
      >
        Ver diagnóstico →
      </a>
    </div>
  `, "es");
}

// Best-effort — the caller decides how to handle a thrown error (the
// diagnosis itself is already saved and viewable regardless of email
// delivery, so a failure here should never fail the API response). Returns
// the Resend message id of the lead email on success, useful for log
// correlation. The internal new-lead notification is sent afterward and its
// own failure is swallowed here (logged, not thrown) — it must never affect
// whether the lead's email is considered sent.
export async function sendDigitalDiagnosisEmail(name: string, email: string, url: string, publicToken: string, lang: "es" | "en" = "es"): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const resultUrl = `${RESULTS_PAGE_BASE_URL}/${publicToken}`;
  const resend = new Resend(apiKey);

  const subject = lang === "es"
    ? "Tu diagnóstico digital de Coimagen está listo"
    : "Your Coimagen digital diagnostic is ready";

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    replyTo: TEAM_ADDRESS,
    subject,
    html: buildLeadEmailHtml(name, resultUrl, lang),
  });

  if (error) {
    throw new Error(error.message);
  }

  try {
    const internal = await resend.emails.send({
      from: FROM_ADDRESS,
      to: TEAM_ADDRESS,
      subject: "Nuevo lead — Diagnóstico Digital",
      html: buildInternalNotificationHtml(name, email, url, resultUrl),
    });
    if (internal.error) {
      throw new Error(internal.error.message);
    }
    logger.info({ internalEmailId: internal.data?.id }, "Notificación interna de nuevo lead enviada");
  } catch (err) {
    logger.warn({ err }, "No se pudo enviar la notificación interna de nuevo lead");
  }

  return data?.id ?? "(sin id)";
}
