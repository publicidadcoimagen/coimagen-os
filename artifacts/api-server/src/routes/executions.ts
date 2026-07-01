import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, aiExecutionsTable, incidentsTable } from "@workspace/db";
import {
  CreateAiExecutionBody,
  GetAiExecutionParams,
  UpdateAiExecutionParams, UpdateAiExecutionBody,
  DeleteAiExecutionParams,
  RunAiExecutionParams,
  SendExecutionToQcParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function ser(e: typeof aiExecutionsTable.$inferSelect) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
  };
}

// LIST
router.get("/executions", async (req, res): Promise<void> => {
  const items = await db.select().from(aiExecutionsTable).orderBy(desc(aiExecutionsTable.createdAt));
  res.json(items.map(ser));
});

// CREATE — CEO / Admin
router.post("/executions", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateAiExecutionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [item] = await db.insert(aiExecutionsTable).values({
    agentId:      d.agentId      ?? null,
    agentName:    d.agentName    ?? null,
    mundoId:      d.mundoId      ?? null,
    mundoName:    d.mundoName    ?? null,
    directorId:   d.directorId   ?? null,
    directorName: d.directorName ?? null,
    clientId:     d.clientId     ?? null,
    projectId:    d.projectId    ?? null,
    workflowId:   d.workflowId   ?? null,
    automationId: d.automationId ?? null,
    prompt:       d.prompt       ?? null,
    inputData:    d.inputData    ?? null,
    outputData:   d.outputData   ?? null,
    status:       d.status       ?? "completed",
    result:       d.result       ?? "simulated",
    errors:       d.errors       ?? null,
    durationMs:   d.durationMs   ?? null,
    isSimulated:  d.isSimulated  ?? true,
    sentToQc:     d.sentToQc     ?? false,
    notes:        d.notes        ?? null,
  }).returning();
  res.status(201).json(ser(item));
});

// GET ONE
router.get("/executions/:id", async (req, res): Promise<void> => {
  const parsed = GetAiExecutionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [item] = await db.select().from(aiExecutionsTable).where(eq(aiExecutionsTable.id, parsed.data.id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(ser(item));
});

// UPDATE — CEO / Admin
router.patch("/executions/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const paramsParsed = UpdateAiExecutionParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed   = UpdateAiExecutionBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const d = bodyParsed.data;
  const [item] = await db.update(aiExecutionsTable).set({
    ...(d.agentId      !== undefined && { agentId:      d.agentId }),
    ...(d.agentName    !== undefined && { agentName:    d.agentName }),
    ...(d.mundoId      !== undefined && { mundoId:      d.mundoId }),
    ...(d.mundoName    !== undefined && { mundoName:    d.mundoName }),
    ...(d.directorId   !== undefined && { directorId:   d.directorId }),
    ...(d.directorName !== undefined && { directorName: d.directorName }),
    ...(d.clientId     !== undefined && { clientId:     d.clientId }),
    ...(d.projectId    !== undefined && { projectId:    d.projectId }),
    ...(d.workflowId   !== undefined && { workflowId:   d.workflowId }),
    ...(d.automationId !== undefined && { automationId: d.automationId }),
    ...(d.prompt       !== undefined && { prompt:       d.prompt }),
    ...(d.inputData    !== undefined && { inputData:    d.inputData }),
    ...(d.outputData   !== undefined && { outputData:   d.outputData }),
    ...(d.status       !== undefined && { status:       d.status }),
    ...(d.result       !== undefined && { result:       d.result }),
    ...(d.errors       !== undefined && { errors:       d.errors }),
    ...(d.durationMs   !== undefined && { durationMs:   d.durationMs }),
    ...(d.isSimulated  !== undefined && { isSimulated:  d.isSimulated }),
    ...(d.sentToQc     !== undefined && { sentToQc:     d.sentToQc }),
    ...(d.qcIncidentId !== undefined && { qcIncidentId: d.qcIncidentId }),
    ...(d.notes        !== undefined && { notes:        d.notes }),
    updatedAt: new Date(),
  }).where(eq(aiExecutionsTable.id, paramsParsed.data.id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(ser(item));
});

// DELETE — CEO / Admin
router.delete("/executions/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = DeleteAiExecutionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(aiExecutionsTable).where(eq(aiExecutionsTable.id, parsed.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// RUN — simulate execution
router.post("/executions/:id/run", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = RunAiExecutionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(aiExecutionsTable).where(eq(aiExecutionsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const start = Date.now();
  // Simulate processing
  const simOutput = JSON.stringify({
    simulated: true,
    agent:     existing.agentName  ?? "Agente desconocido",
    mundo:     existing.mundoName  ?? "—",
    director:  existing.directorName ?? "—",
    timestamp: new Date().toISOString(),
    message:   `Ejecución simulada para: ${existing.prompt?.slice(0, 100) ?? "(sin prompt)"}`,
    steps:     ["Prompt recibido", "Contexto cargado", "Respuesta generada (simulada)", "Resultado registrado"],
  });
  const durationMs = Date.now() - start + Math.floor(Math.random() * 400 + 100);

  const [updated] = await db.update(aiExecutionsTable).set({
    status:      "completed",
    result:      "simulated",
    outputData:  simOutput,
    durationMs,
    isSimulated: true,
    errors:      null,
    updatedAt:   new Date(),
  }).where(eq(aiExecutionsTable.id, parsed.data.id)).returning();

  res.json({ execution: ser(updated), simulated: true, outputData: simOutput, durationMs, errors: null });
});

// SEND TO QC — create incident from failed execution
router.post("/executions/:id/send-to-qc", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const parsed = SendExecutionToQcParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(aiExecutionsTable).where(eq(aiExecutionsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.sentToQc && existing.qcIncidentId) {
    res.json({ incidentId: existing.qcIncidentId, message: "Ya reportado al Quality Center" });
    return;
  }

  const [incident] = await db.insert(incidentsTable).values({
    type:        "ai_error",
    title:       `Fallo de agente IA: ${existing.agentName ?? "Agente desconocido"}`,
    description: `Ejecución #${existing.id} falló.\n\nPrompt: ${existing.prompt ?? "—"}\n\nError: ${existing.errors ?? "Sin detalle"}`,
    severity:    "high",
    priority:    "high",
    status:      "open",
    module:      "AI Execution Engine",
    agentId:     existing.agentId    ?? undefined,
    clientId:    existing.clientId   ?? undefined,
    projectId:   existing.projectId  ?? undefined,
    workflowId:  existing.workflowId ?? undefined,
    mundoId:     existing.mundoId    ?? undefined,
    logs:        existing.errors     ?? undefined,
  }).returning();

  await db.update(aiExecutionsTable).set({
    sentToQc:     true,
    qcIncidentId: incident.id,
    updatedAt:    new Date(),
  }).where(eq(aiExecutionsTable.id, parsed.data.id));

  res.json({ incidentId: incident.id, message: "Incidente creado en Quality Center" });
});

export default router;
