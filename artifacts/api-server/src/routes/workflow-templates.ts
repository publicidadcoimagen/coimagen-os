import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, workflowTemplatesTable } from "@workspace/db";
import {
  CreateWorkflowTemplateBody,
  GetWorkflowTemplateParams,
  UpdateWorkflowTemplateParams,
  UpdateWorkflowTemplateBody,
  DeleteWorkflowTemplateParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ALL_STAGES = [
  "lead_received", "diagnosis_started", "diagnosis_completed",
  "proposal_sent", "proposal_approved", "contract_sent", "contract_signed",
  "payment_received", "onboarding_started", "onboarding_completed",
  "production_started", "design_review", "development_review",
  "qa_internal", "changes_requested", "client_approval",
  "final_delivery", "monthly_active", "support_active", "customer_success",
];

const DEFAULT_TEMPLATES = [
  { name: "AI Website", product: "AI Website", stages: ALL_STAGES, defaultPriority: "high", isDefault: true },
  { name: "SEO Growth", product: "SEO Growth", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
  { name: "Google Business", product: "Google Business", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
  { name: "AI Automation", product: "AI Automation", stages: ALL_STAGES, defaultPriority: "high", isDefault: true },
  { name: "Camila AI", product: "Camila AI", stages: ALL_STAGES, defaultPriority: "high", isDefault: true },
  { name: "COIMAGEN OS", product: "COIMAGEN OS", stages: ALL_STAGES, defaultPriority: "critical", isDefault: true },
  { name: "Medical OS", product: "Medical OS", stages: ALL_STAGES, defaultPriority: "high", isDefault: true },
  { name: "Restaurant OS", product: "Restaurant OS", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
  { name: "Law OS", product: "Law OS", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
  { name: "Real Estate OS", product: "Real Estate OS", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
  { name: "Cloud Systems", product: "Cloud Systems", stages: ALL_STAGES, defaultPriority: "high", isDefault: true },
  { name: "Consultoría", product: "Consultoría", stages: ALL_STAGES, defaultPriority: "medium", isDefault: true },
];

function serialize(t: typeof workflowTemplatesTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
  };
}

async function seedIfEmpty() {
  const [{ value }] = await db.select({ value: count() }).from(workflowTemplatesTable);
  if (Number(value) === 0) {
    await db.insert(workflowTemplatesTable).values(DEFAULT_TEMPLATES);
  }
}

router.get("/workflow-templates", async (_req, res): Promise<void> => {
  await seedIfEmpty();
  const rows = await db.select().from(workflowTemplatesTable).orderBy(workflowTemplatesTable.name);
  res.json(rows.map(serialize));
});

router.post("/workflow-templates", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const body = CreateWorkflowTemplateBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const [tmpl] = await db.insert(workflowTemplatesTable).values({
    name: d.name,
    description: d.description ?? null,
    product: d.product ?? null,
    stages: d.stages,
    defaultPriority: d.defaultPriority ?? "medium",
    isDefault: d.isDefault ?? false,
  }).returning();
  res.status(201).json(serialize(tmpl));
});

router.get("/workflow-templates/:id", async (req, res): Promise<void> => {
  const params = GetWorkflowTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [tmpl] = await db.select().from(workflowTemplatesTable).where(eq(workflowTemplatesTable.id, params.data.id));
  if (!tmpl) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(tmpl));
});

router.patch("/workflow-templates/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = UpdateWorkflowTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateWorkflowTemplateBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.product !== undefined) update.product = d.product;
  if (d.stages !== undefined) update.stages = d.stages;
  if (d.defaultPriority !== undefined) update.defaultPriority = d.defaultPriority;
  if (d.isDefault !== undefined) update.isDefault = d.isDefault;
  await db.update(workflowTemplatesTable).set(update).where(eq(workflowTemplatesTable.id, params.data.id));
  const [updated] = await db.select().from(workflowTemplatesTable).where(eq(workflowTemplatesTable.id, params.data.id));
  res.json(serialize(updated));
});

router.delete("/workflow-templates/:id", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const params = DeleteWorkflowTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(workflowTemplatesTable).where(eq(workflowTemplatesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
