import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, prospectsTable, aiExecutionsTable, diagnosesTable, incidentsTable } from "@workspace/db";
import { SubmitDigitalDiagnosisBody, GetPublicDigitalDiagnosisParams } from "@workspace/api-zod";
import { scrapeUrl, DigitalDiagnosisScrapeError } from "../lib/digital-diagnosis/scrape";
import { generateDigitalDiagnosis } from "../lib/digital-diagnosis/analyze";
import { sendDigitalDiagnosisEmail } from "../lib/digital-diagnosis/email";

const router: IRouter = Router();

// Captures every own top-level property of an unclassified error (e.g. an
// AI SDK APICallError's statusCode/data/isRetryable) for staff-facing logs.
// Only err.message was ever persisted before, which meant a real production
// miss in isInsufficientCreditError (2026-07-26 — the check didn't catch a
// genuine "credit balance too low" error) left no way to recover the real
// statusCode/data afterward; this exists so the next such miss has the
// actual shape to inspect instead of guessing against provider docs.
function extractErrorDetails(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const details: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(err)) {
    if (key === "message" || key === "stack" || key === "name") continue;
    const value = (err as unknown as Record<string, unknown>)[key];
    try {
      JSON.stringify(value);
      details[key] = value;
    } catch {
      details[key] = String(value);
    }
  }
  return Object.keys(details).length > 0 ? JSON.stringify(details) : undefined;
}

// This endpoint is public and unauthenticated by design (no session to gate
// on), and now calls a real, billed LLM provider — without a limit, a
// script could hit it in a loop and run up a real Anthropic bill with no
// warning before the invoice. 5 requests/hour/IP comfortably covers a
// real visitor retrying a typo'd URL, while capping worst-case abuse cost.
const digitalDiagnosisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes desde tu conexión. Intenta de nuevo en un rato o contáctanos por WhatsApp." },
});

// Public, unauthenticated — powers the "URL de tu sitio web" step of the
// /diagnostico quiz on coimagen-media-web. No session required.
router.post("/public/digital-diagnosis", digitalDiagnosisLimiter, async (req, res): Promise<void> => {
  const parsed = SubmitDigitalDiagnosisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { url, name, email, lang } = parsed.data;
  const language = lang ?? "es";

  // 1. Create or update the prospect by email
  const [existingProspect] = await db.select().from(prospectsTable).where(eq(prospectsTable.email, email)).limit(1);
  const [prospect] = existingProspect
    ? await db.update(prospectsTable).set({
        name,
        source: "diagnostico_digital",
        language,
        updatedAt: new Date(),
      }).where(eq(prospectsTable.id, existingProspect.id)).returning()
    : await db.insert(prospectsTable).values({
        name,
        email,
        source: "diagnostico_digital",
        status: "lead",
        language,
      }).returning();

  // 2. Create the ai_execution record up front, so a mid-flow crash still leaves a trace
  const [execution] = await db.insert(aiExecutionsTable).values({
    agentName: "Digital Diagnosis Agent",
    prompt: url,
    status: "running",
    result: "pending",
    isSimulated: false,
  }).returning();

  const startedAt = Date.now();

  try {
    // 3. Fetch + extract signals from the target site
    const signals = await scrapeUrl(url);

    // 4. Structured analysis — tries Anthropic first, falls back to Gemini
    // only if Anthropic has no credit loaded (see analyze.ts)
    const { analysis, provider } = await generateDigitalDiagnosis(url, signals, language);
    const storedResult = { ...analysis, _meta: { aiProvider: provider } };

    // 5. Persist the diagnosis
    const hostname = new URL(url).hostname;
    const diagnosisTitle = language === "en" ? `Digital Diagnostic — ${hostname}` : `Diagnóstico Digital — ${hostname}`;
    const [diagnosis] = await db.insert(diagnosesTable).values({
      title: diagnosisTitle,
      prospectId: prospect.id,
      status: "completed",
      type: "digital_diagnosis",
      executionId: execution.id,
      sourceUrl: url,
      result: storedResult,
    }).returning();

    await db.update(aiExecutionsTable).set({
      status: "completed",
      result: "success",
      outputData: JSON.stringify(storedResult),
      provider,
      durationMs: Date.now() - startedAt,
      updatedAt: new Date(),
    }).where(eq(aiExecutionsTable.id, execution.id));

    // Best-effort — the diagnosis is already saved and viewable via the
    // results page regardless of whether the email goes out, so a delivery
    // failure is logged as a warning and must not affect the response.
    if (diagnosis.publicToken) {
      try {
        const emailId = await sendDigitalDiagnosisEmail(name, email, url, diagnosis.publicToken, language);
        // Lets the /api/webhooks/resend handler correlate later delivery/
        // bounce/complaint events back to this diagnosis (see email-events
        // schema) — without this, a successful send here was indistinguishable
        // from the recipient actually receiving it.
        await db.update(diagnosesTable).set({ leadEmailId: emailId }).where(eq(diagnosesTable.id, diagnosis.id));
        req.log.info({ emailId, diagnosisId: diagnosis.id }, "Correo de diagnóstico digital enviado");
      } catch (err) {
        req.log.warn({ err, diagnosisId: diagnosis.id }, "No se pudo enviar el correo de diagnóstico digital");
      }
    }

    res.json({ diagnosisId: diagnosis.id, status: "completed", publicToken: diagnosis.publicToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    // Kept alongside the friendly message for staff-facing logs (incidents,
    // ai_executions.errors) — e.g. the raw "getaddrinfo ENOTFOUND ..." behind
    // a DigitalDiagnosisScrapeError's user-facing "verifica el dominio".
    const causeDetail = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    // A DigitalDiagnosisScrapeError's message is already the full, vetted
    // story (see scrape.ts) — everything else is unclassified (AI provider
    // errors, DB errors, etc.) and is exactly where the raw shape matters
    // for debugging later.
    const rawDetails = err instanceof DigitalDiagnosisScrapeError ? undefined : extractErrorDetails(err);
    const logMessage = [message, causeDetail && `(${causeDetail})`, rawDetails && `[details: ${rawDetails}]`]
      .filter(Boolean)
      .join(" ");
    // A DigitalDiagnosisScrapeError is a known, expected failure mode (bad
    // domain, slow site, HTTP error) — the prospect already got an
    // actionable message for it, so it doesn't need "high" severity
    // triage like a genuine unclassified failure (AI provider error, DB
    // error) does.
    const severity = err instanceof DigitalDiagnosisScrapeError ? "low" : "high";

    await db.insert(incidentsTable).values({
      type: "ai_error",
      title: `Fallo del Agente de Diagnóstico Digital: ${url}`,
      description: `Prospecto: ${name} <${email}>\nURL analizada: ${url}\n\nError: ${logMessage}`,
      severity,
      priority: "high",
      status: "open",
      module: "Digital Diagnosis Agent",
    });

    await db.update(aiExecutionsTable).set({
      status: "failed",
      result: "error",
      errors: logMessage,
      durationMs: Date.now() - startedAt,
      updatedAt: new Date(),
    }).where(eq(aiExecutionsTable.id, execution.id));

    // A DigitalDiagnosisScrapeError's message is itself the vetted,
    // user-safe text (see scrape.ts) — anything else (AI provider errors, DB
    // errors) stays generic so internal detail never reaches this public,
    // unauthenticated endpoint.
    const responseMessage = err instanceof DigitalDiagnosisScrapeError
      ? err.message
      : "No pudimos generar tu diagnóstico en este momento. Intenta de nuevo o contáctanos por WhatsApp.";

    res.status(502).json({ error: responseMessage });
  }
});

// Public, unauthenticated — powers the results page and the emailed link.
// Looked up by an opaque UUID token rather than the sequential diagnoses.id
// so results can't be browsed by guessing consecutive IDs.
router.get("/public/digital-diagnosis/:token", async (req, res): Promise<void> => {
  const parsed = GetPublicDigitalDiagnosisParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Left-joined to prospects for prospect.language — the results page needs
  // to know which language this specific diagnosis was generated in (see
  // P-diagnosis-lang) so it can lock its own chrome to that language instead
  // of following the site-wide ES/EN toggle, which would otherwise mismatch
  // already-generated, non-regenerable AI content.
  const [row] = await db
    .select({
      title: diagnosesTable.title,
      status: diagnosesTable.status,
      sourceUrl: diagnosesTable.sourceUrl,
      result: diagnosesTable.result,
      createdAt: diagnosesTable.createdAt,
      prospectLanguage: prospectsTable.language,
    })
    .from(diagnosesTable)
    .leftJoin(prospectsTable, eq(prospectsTable.id, diagnosesTable.prospectId))
    .where(eq(diagnosesTable.publicToken, parsed.data.token))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Diagnóstico no encontrado" });
    return;
  }

  res.json({
    title: row.title,
    status: row.status,
    sourceUrl: row.sourceUrl,
    result: row.result,
    createdAt: row.createdAt.toISOString(),
    language: row.prospectLanguage ?? "es",
  });
});

export default router;
