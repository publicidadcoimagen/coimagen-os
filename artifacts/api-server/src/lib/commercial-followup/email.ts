import { Resend } from "resend";

// Same branding/encoding pattern as lib/digital-diagnosis/email.ts — reused
// deliberately per the P-80 spec ("reutilizando el patrón ya probado...
// Neon + Resend real"), not reinvented here.
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

// Escapes the only two characters that matter when interpolating plain-text
// lead data (name, company) into an HTML attribute-free text position.
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// correo-2-refuerzo / email-2-followup-EN — content approved 2026-08-08
// (2026-08-08-embudo-ventas-coimagen-media-agency-v2). No links back to a
// proposal, so this stage has no external dependency and is ready to send.
function stage2Body(name: string, lang: "es" | "en"): string {
  const n = escapeHtml(name);
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${n}, we know this can feel like a lot</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hi ${n},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">We know reviewing your digital presence diagnosis can raise more questions than answers. Maybe you're wondering where to start, whether it's worth the time and money right now, or if the process is going to be complicated.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">You don't have to figure this out alone. At Coimagen, we test everything on our own operation first before offering it — we don't hand you a theory, we hand you a system that already works.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(0,207,255,0.08); border-left:3px solid #00cfff; border-radius:8px; margin:24px 0;">
              <tr><td style="padding:18px 20px;"><p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0;">📊 <strong style="color:#00cfff;">38%</strong> of businesses in Mexico already use artificial intelligence in their operations — up from 29% last year, with adopters reporting up to <strong style="color:#00cfff;">16% higher revenue</strong> on average.</p></td></tr>
            </table>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 28px 0;">The question isn't if your business will go digital — it's when, and who helps you do it right from the start. In a few days we'll share exactly what we'd build for your business, no strings attached.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr><td style="border-radius:8px; border:1px solid #25D366;"><a href="https://wa.me/526644769223?text=Hi%2C%20I%20saw%20my%20diagnosis%20and%20want%20to%20know%20more" style="display:inline-block; padding:12px 24px; color:#25D366; font-size:14px; font-weight:600; text-decoration:none;">💬 Book a call on WhatsApp</a></td></tr>
            </table>
            <p style="color:#8f89a8; font-size:14px; margin:0;">Best,<br><span style="color:#c8c3dd;">The Coimagen Media Agency team</span></p>
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
            <h1 style="color:#ffffff; font-size:22px; line-height:1.35; margin:0 0 20px 0; font-weight:600;">${n}, sabemos que esto puede sentirse abrumador</h1>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Hola ${n},</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">Sabemos que revisar el diagnóstico de tu presencia digital puede generar más preguntas que respuestas. Tal vez te preguntas por dónde empezar, si de verdad vale la pena invertir tiempo y dinero en esto ahora, o si el proceso va a ser complicado.</p>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 18px 0;">No tienes que resolverlo solo. En Coimagen ya lo probamos primero en nuestra propia operación antes de ofrecerlo — no te entregamos una teoría, te entregamos un sistema que ya funciona.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(0,207,255,0.08); border-left:3px solid #00cfff; border-radius:8px; margin:24px 0;">
              <tr><td style="padding:18px 20px;"><p style="color:#ffffff; font-size:14px; line-height:1.6; margin:0;">📊 El <strong style="color:#00cfff;">38%</strong> de las empresas en México ya usa inteligencia artificial en su operación — creció de 29% a 38% en el último año, y quienes la adoptan reportan hasta <strong style="color:#00cfff;">16% más de ingresos</strong> en promedio.</p></td></tr>
            </table>
            <p style="color:#c8c3dd; font-size:15px; line-height:1.65; margin:0 0 28px 0;">El punto no es si tu negocio se va a digitalizar — es cuándo, y con quién lo haces bien desde el principio. En unos días te vamos a compartir exactamente qué construiríamos para tu negocio, sin compromiso.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr><td style="border-radius:8px; border:1px solid #25D366;"><a href="https://wa.me/526644769223?text=Hola%2C%20vi%20mi%20diagn%C3%B3stico%20y%20quiero%20saber%20m%C3%A1s" style="display:inline-block; padding:12px 24px; color:#25D366; font-size:14px; font-weight:600; text-decoration:none;">💬 Agendar llamada por WhatsApp</a></td></tr>
            </table>
            <p style="color:#8f89a8; font-size:14px; margin:0;">Saludos,<br><span style="color:#c8c3dd;">El equipo de Coimagen Media Agency</span></p>
          </td></tr>
          <tr><td style="padding:24px 40px; background-color:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5c5675; font-size:12px; margin:0; text-align:center;">Coimagen Media Agency · Tijuana / San Diego<br><a href="https://www.coimagenmedia.com" style="color:#00cfff; text-decoration:none;">coimagenmedia.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

const SUBJECTS: Record<number, Record<"es" | "en", string>> = {
  2: { es: "¿Por dónde empezar con tu diagnóstico?", en: "Where to start with your diagnostic?" },
  3: { es: "Tu propuesta está lista", en: "Your proposal is ready" },
  4: { es: "Tu propuesta vence pronto", en: "Your proposal expires soon" },
};

// PENDING: correo-3-propuesta / correo-4-urgencia (and their EN twins) both
// hardcode a CTA to [LINK_PROPUESTA]/[LINK_APROBAR] — a per-prospect public
// "view and approve your proposal" link. That page/token doesn't exist
// anywhere in this codebase today: proposalsTable has no publicToken (unlike
// diagnosesTable), and none of these 14 prospects has a proposal record at
// all yet — they're still "lead" status. Stage 3 isn't due for any of them
// for at least 3 more days (see eligibility.ts), so there's no time
// pressure, but this needs a real decision — build the public proposal
// link, or point the CTA somewhere else — before stage 3 can send anything
// that isn't a broken link. Throwing here on purpose rather than guessing.
function stage3Or4Body(_stage: 3 | 4, _name: string, _company: string, _lang: "es" | "en"): string {
  throw new Error(
    "correo 3/4 necesitan un link público de propuesta real ([LINK_PROPUESTA]/[LINK_APROBAR]) que hoy no existe en el backend — no se puede armar el CTA sin inventar una URL rota.",
  );
}

function buildStageEmail(stage: number, name: string, company: string | null, lang: "es" | "en"): { subject: string; html: string } {
  const subject = SUBJECTS[stage]?.[lang] ?? SUBJECTS[2][lang];

  if (stage === 2) {
    return { subject, html: stage2Body(name, lang) };
  }
  if (stage === 3 || stage === 4) {
    const fallbackCompany = lang === "es" ? "tu negocio" : "your business";
    return { subject, html: stage3Or4Body(stage, name, company ?? fallbackCompany, lang) };
  }
  throw new Error(`Unknown commercial follow-up stage: ${stage}`);
}

export async function sendFollowupEmail(stage: number, name: string, email: string, company: string | null, lang: "es" | "en"): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada");
  }

  const { subject, html } = buildStageEmail(stage, name, company, lang);
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    replyTo: TEAM_ADDRESS,
    subject,
    html: wrapEmailHtml(html, lang),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? "(sin id)";
}
