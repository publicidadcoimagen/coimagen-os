import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, prospectsTable, aiExecutionsTable, diagnosesTable, incidentsTable } from "@workspace/db";
import { SubmitDigitalDiagnosisBody, GetPublicDigitalDiagnosisParams } from "@workspace/api-zod";
import { scrapeUrl } from "../lib/digital-diagnosis/scrape";
import { generateDigitalDiagnosis } from "../lib/digital-diagnosis/analyze";
import { sendDigitalDiagnosisEmail } from "../lib/digital-diagnosis/email";

const router: IRouter = Router();

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
  const { url, name, email } = parsed.data;

  // 1. Create or update the prospect by email
  const [existingProspect] = await db.select().from(prospectsTable).where(eq(prospectsTable.email, email)).limit(1);
  const [prospect] = existingProspect
    ? await db.update(prospectsTable).set({
        name,
        source: "diagnostico_digital",
        updatedAt: new Date(),
      }).where(eq(prospectsTable.id, existingProspect.id)).returning()
    : await db.insert(prospectsTable).values({
        name,
        email,
        source: "diagnostico_digital",
        status: "lead",
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
    const { analysis, provider } = await generateDigitalDiagnosis(url, signals);
    const storedResult = { ...analysis, _meta: { aiProvider: provider } };

    // 5. Persist the diagnosis
    const hostname = new URL(url).hostname;
    const [diagnosis] = await db.insert(diagnosesTable).values({
      title: `Diagnóstico Digital — ${hostname}`,
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
        const emailId = await sendDigitalDiagnosisEmail(name, email, url, diagnosis.publicToken);
        req.log.info({ emailId, diagnosisId: diagnosis.id }, "Correo de diagnóstico digital enviado");
      } catch (err) {
        req.log.warn({ err, diagnosisId: diagnosis.id }, "No se pudo enviar el correo de diagnóstico digital");
      }
    }

    res.json({ diagnosisId: diagnosis.id, status: "completed", publicToken: diagnosis.publicToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    await db.insert(incidentsTable).values({
      type: "ai_error",
      title: `Fallo del Agente de Diagnóstico Digital: ${url}`,
      description: `Prospecto: ${name} <${email}>\nURL analizada: ${url}\n\nError: ${message}`,
      severity: "high",
      priority: "high",
      status: "open",
      module: "Digital Diagnosis Agent",
    });

    await db.update(aiExecutionsTable).set({
      status: "failed",
      result: "error",
      errors: message,
      durationMs: Date.now() - startedAt,
      updatedAt: new Date(),
    }).where(eq(aiExecutionsTable.id, execution.id));

    res.status(502).json({
      error: "No pudimos generar tu diagnóstico en este momento. Intenta de nuevo o contáctanos por WhatsApp.",
    });
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

  const [diagnosis] = await db.select().from(diagnosesTable).where(eq(diagnosesTable.publicToken, parsed.data.token)).limit(1);
  if (!diagnosis) {
    res.status(404).json({ error: "Diagnóstico no encontrado" });
    return;
  }

  res.json({
    title: diagnosis.title,
    status: diagnosis.status,
    sourceUrl: diagnosis.sourceUrl,
    result: diagnosis.result,
    createdAt: diagnosis.createdAt.toISOString(),
  });
});

export default router;
