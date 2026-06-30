import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import {
  db,
  smartOnboardingsTable,
  clientsTable,
  projectsTable,
  backlogItemsTable,
  clientBrandTable,
  clientAccessTable,
  clientTimelineTable,
} from "@workspace/db";
import {
  GetSmartOnboardingParams,
  UpdateSmartOnboardingParams,
  UpdateSmartOnboardingBody,
  DeleteSmartOnboardingParams,
  CompleteSmartOnboardingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ALGO = "aes-256-gcm";
function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET ?? "coimagen-default-secret-key-!!";
  return Buffer.from(secret.slice(0, 32).padEnd(32, "0"));
}

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = (cipher as ReturnType<typeof createCipheriv> & { getAuthTag(): Buffer }).getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(data: string): string {
  try {
    const [ivHex, tagHex, encHex] = data.split(":");
    if (!ivHex || !tagHex || !encHex) return "";
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
    (decipher as ReturnType<typeof createDecipheriv> & { setAuthTag(b: Buffer): void }).setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

const SENTINEL = "••••••••";

type AccessEntry = { platform: string; loginUrl?: string; username?: string; password?: string; apiKey?: string; notes?: string };

function encryptStep4(incoming: Record<string, unknown>, existing: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const inEntries = (incoming.entries as AccessEntry[] ?? []);
  const exEntries = ((existing?.entries ?? []) as AccessEntry[]);

  const entries = inEntries.map((entry) => {
    const ex: Partial<AccessEntry> = exEntries.find((e) => e.platform === entry.platform) ?? {};
    const pw = entry.password;
    const ak = entry.apiKey;
    return {
      platform: entry.platform,
      loginUrl: entry.loginUrl ?? "",
      username: entry.username ?? "",
      password: pw && pw !== SENTINEL ? encrypt(pw) : (ex.password ?? ""),
      apiKey: ak && ak !== SENTINEL ? encrypt(ak) : (ex.apiKey ?? ""),
      notes: entry.notes ?? "",
    };
  });
  return { entries };
}

function maskStep4(step4: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined {
  if (!step4) return step4;
  const entries = ((step4.entries ?? []) as AccessEntry[]).map((e) => ({
    platform: e.platform,
    loginUrl: e.loginUrl ?? "",
    username: e.username ?? "",
    password: e.password ? SENTINEL : "",
    apiKey: e.apiKey ? SENTINEL : "",
    notes: e.notes ?? "",
  }));
  return { entries };
}

function serializeOnboarding(ob: typeof smartOnboardingsTable.$inferSelect) {
  return {
    ...ob,
    step4: maskStep4(ob.step4),
    completedAt: ob.completedAt ? ob.completedAt.toISOString() : null,
    createdAt: ob.createdAt.toISOString(),
    updatedAt: ob.updatedAt ? ob.updatedAt.toISOString() : null,
  };
}

router.get("/onboardings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(smartOnboardingsTable).orderBy(desc(smartOnboardingsTable.createdAt));
  res.json(rows.map(serializeOnboarding));
});

router.post("/onboardings", async (_req, res): Promise<void> => {
  const [ob] = await db.insert(smartOnboardingsTable).values({ status: "draft", currentStep: 1 }).returning();
  res.status(201).json(serializeOnboarding(ob));
});

router.get("/onboardings/:id", async (req, res): Promise<void> => {
  const params = GetSmartOnboardingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [ob] = await db.select().from(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  if (!ob) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeOnboarding(ob));
});

router.patch("/onboardings/:id", async (req, res): Promise<void> => {
  const params = UpdateSmartOnboardingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateSmartOnboardingBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [existing] = await db.select().from(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  const d = body.data;
  if (d.currentStep !== undefined) update.currentStep = d.currentStep;
  if (d.status !== undefined) update.status = d.status;
  if (d.step1 !== undefined) update.step1 = d.step1;
  if (d.step2 !== undefined) update.step2 = d.step2;
  if (d.step3 !== undefined) update.step3 = d.step3;
  if (d.step4 !== undefined) update.step4 = encryptStep4(d.step4 as Record<string, unknown>, existing.step4);
  if (d.step5 !== undefined) update.step5 = d.step5;
  if (d.step6 !== undefined) update.step6 = d.step6;
  if (d.step7 !== undefined) update.step7 = d.step7;

  await db.update(smartOnboardingsTable).set(update).where(eq(smartOnboardingsTable.id, params.data.id));
  const [updated] = await db.select().from(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  res.json(serializeOnboarding(updated));
});

router.delete("/onboardings/:id", async (req, res): Promise<void> => {
  const params = DeleteSmartOnboardingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/onboardings/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteSmartOnboardingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ob] = await db.select().from(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  if (!ob) { res.status(404).json({ error: "Not found" }); return; }

  const s1 = (ob.step1 ?? {}) as Record<string, unknown>;
  const s2 = (ob.step2 ?? {}) as Record<string, unknown>;
  const s3 = (ob.step3 ?? {}) as Record<string, unknown>;
  const s5 = (ob.step5 ?? {}) as Record<string, unknown>;

  const clientName = (s1.contactName as string) || (s1.companyName as string) || "Cliente sin nombre";
  const services = (s2.services as string[] | undefined) ?? [];

  const [client] = await db.insert(clientsTable).values({
    name: clientName,
    email: (s1.email as string) || null,
    phone: (s1.whatsapp as string) || null,
    company: (s1.companyName as string) || null,
    industry: (s1.industry as string) || null,
    status: "active",
    notes: services.length > 0 ? `Servicios: ${services.join(", ")}` : null,
  }).returning();

  const [project] = await db.insert(projectsTable).values({
    name: `${(s1.companyName as string) || clientName} — Onboarding`,
    description: [
      services.length > 0 ? `Servicios: ${services.join(", ")}` : null,
      (s3.objectives as string) ? `Objetivos: ${s3.objectives}` : null,
    ].filter(Boolean).join("\n\n") || null,
    clientId: client.id,
    status: "planning",
    priority: (s3.priority as string) || "high",
  }).returning();

  const onboardingTasks = [
    "Reunión de bienvenida y briefing inicial",
    "Configurar accesos y credenciales",
    "Configurar identidad de marca en el sistema",
    "Crear carpeta documental del cliente",
    "Asignar equipo y agentes IA",
    "Definir KPIs y métricas de seguimiento",
    "Primer entregable — revisión interna",
  ];

  const backlogItemIds: number[] = [];
  for (const title of onboardingTasks) {
    const [item] = await db.insert(backlogItemsTable).values({
      title,
      clientId: client.id,
      projectId: project.id,
      status: "backlog",
      priority: "medium",
      epic: "Onboarding",
    }).returning();
    backlogItemIds.push(item.id);
  }

  if (s5.logoUrl || s5.colors || s5.typography) {
    const sm = (s1.socialMedia ?? {}) as Record<string, string>;
    await db.insert(clientBrandTable).values({
      clientId: client.id,
      logoUrl: (s5.logoUrl as string) || null,
      brandColors: (s5.colors as string) || null,
      fonts: (s5.typography as string) || null,
      brandNotes: (s5.notes as string) || null,
      websiteUrl: (s1.website as string) || null,
      facebookUrl: sm.facebook || null,
      instagramUrl: sm.instagram || null,
      youtubeUrl: sm.youtube || null,
    }).onConflictDoNothing();
  }

  const accessEntries = ((ob.step4?.entries ?? []) as AccessEntry[]).filter((e) => e.username || e.password);
  for (const entry of accessEntries) {
    await db.insert(clientAccessTable).values({
      clientId: client.id,
      platform: entry.platform,
      usernameEmail: entry.username || null,
      loginUrl: entry.loginUrl || null,
      passwordPlaceholder: entry.password ? "[cifrado]" : null,
      accessType: "credential",
      permissionStatus: "granted",
      accessStatus: "active",
    });
  }

  await db.insert(clientTimelineTable).values({
    clientId: client.id,
    eventType: "onboarding_completed",
    title: "Onboarding completado",
    description: `Smart Onboarding finalizado. ${services.length > 0 ? `Servicios: ${services.join(", ")}.` : ""}`,
  });

  const completedEntities = {
    clientId: client.id,
    clientName: client.name,
    projectId: project.id,
    projectName: project.name,
    backlogItemIds,
  };

  await db.update(smartOnboardingsTable).set({
    status: "completed",
    clientId: client.id,
    completedAt: new Date(),
    completedEntities,
    updatedAt: new Date(),
  }).where(eq(smartOnboardingsTable.id, params.data.id));

  const [final] = await db.select().from(smartOnboardingsTable).where(eq(smartOnboardingsTable.id, params.data.id));
  res.json(serializeOnboarding(final));
});

export default router;
