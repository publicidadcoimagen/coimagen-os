import { Resend } from "resend";
import { logger } from "../logger";

const RESULTS_PAGE_BASE_URL = "https://www.coimagenmedia.com/diagnostico/resultado";

// No verified sending domain yet — onboarding@resend.dev is Resend's shared
// testing address, usable without domain verification. Swap once a domain
// (e.g. coimagenmedia.com) is verified in Resend.
const FROM_ADDRESS = "Coimagen Media Agency <onboarding@resend.dev>";

// Replies from the lead should reach the team's real inbox, not the shared
// Resend testing address. Also where the internal new-lead notification goes.
const TEAM_ADDRESS = "info@coimagenmedia.com";

function buildLeadEmailHtml(name: string, resultUrl: string): string {
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

function buildInternalNotificationHtml(name: string, email: string, url: string, resultUrl: string): string {
  return `
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
  `;
}

// Best-effort — the caller decides how to handle a thrown error (the
// diagnosis itself is already saved and viewable regardless of email
// delivery, so a failure here should never fail the API response). Returns
// the Resend message id of the lead email on success, useful for log
// correlation. The internal new-lead notification is sent afterward and its
// own failure is swallowed here (logged, not thrown) — it must never affect
// whether the lead's email is considered sent.
export async function sendDigitalDiagnosisEmail(name: string, email: string, url: string, publicToken: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const resultUrl = `${RESULTS_PAGE_BASE_URL}/${publicToken}`;
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    replyTo: TEAM_ADDRESS,
    subject: "Tu diagnóstico digital de Coimagen está listo",
    html: buildLeadEmailHtml(name, resultUrl),
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
