import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, diagnosesTable } from "@workspace/db";
import {
  CreateDiagnosisBody,
  GetDiagnosisParams,
  UpdateDiagnosisParams,
  UpdateDiagnosisBody,
  DeleteDiagnosisParams,
  ListDiagnosesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const fmt = (d: typeof diagnosesTable.$inferSelect) => ({
  ...d,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
});

router.get("/diagnoses", async (req, res): Promise<void> => {
  const qp = ListDiagnosesQueryParams.safeParse(req.query);
  let rows = await db.select().from(diagnosesTable).orderBy(diagnosesTable.createdAt);
  if (qp.success && qp.data.status) rows = rows.filter((r) => r.status === qp.data.status);
  if (qp.success && qp.data.prospectId) rows = rows.filter((r) => r.prospectId === qp.data.prospectId);
  if (qp.success && qp.data.clientId) rows = rows.filter((r) => r.clientId === qp.data.clientId);
  res.json(rows.map(fmt));
});

router.post("/diagnoses", async (req, res): Promise<void> => {
  const parsed = CreateDiagnosisBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(diagnosesTable).values({
    title: parsed.data.title,
    prospectId: parsed.data.prospectId ?? null,
    clientId: parsed.data.clientId ?? null,
    content: parsed.data.content ?? null,
    status: parsed.data.status ?? "draft",
    type: parsed.data.type ?? "diagnosis",
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/diagnoses/:id", async (req, res): Promise<void> => {
  const params = GetDiagnosisParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(diagnosesTable).where(eq(diagnosesTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Diagnosis not found" }); return; }
  res.json(fmt(row));
});

router.patch("/diagnoses/:id", async (req, res): Promise<void> => {
  const params = UpdateDiagnosisParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateDiagnosisBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(diagnosesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(diagnosesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Diagnosis not found" }); return; }
  res.json(fmt(row));
});

router.delete("/diagnoses/:id", async (req, res): Promise<void> => {
  const params = DeleteDiagnosisParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(diagnosesTable).where(eq(diagnosesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Diagnosis not found" }); return; }
  res.sendStatus(204);
});

export default router;
