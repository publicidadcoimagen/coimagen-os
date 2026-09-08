import { and, eq, gte, sql } from "drizzle-orm";
import { db, configTable, incidentsTable } from "@workspace/db";

// Pure — split out from isOnCooldown() below so the actual cooldown math
// (the part worth getting right and worth testing) doesn't require a DB
// connection, same separation anthropic-balance-alert/repository.ts uses
// between cooldownActive() and getLastAlertSentAt().
export function cooldownActive(lastFired: Date | null, minutes: number, now: Date): boolean {
  if (!lastFired || Number.isNaN(lastFired.getTime())) return false;
  const minutesSince = (now.getTime() - lastFired.getTime()) / (1000 * 60);
  return minutesSince < minutes;
}

// Generalizes the cooldown trio copied verbatim across
// anthropic-balance-alert, client-room-error-alert, invoice-reminders, and
// subscription-alerts (each with its own hardcoded CONFIG_KEY constant) —
// same config[key,value] mechanism, but "key" is now an argument instead of
// a per-file constant, so any agent/category/alert-type combination gets
// its own cooldown without a new file. Config keys used by this module:
// "failure:{agentName}:{category}" and "spike:{agentName}".
export async function isOnCooldown(key: string, minutes: number, now = new Date()): Promise<boolean> {
  const [row] = await db.select({ value: configTable.value }).from(configTable).where(eq(configTable.key, key));
  const lastFired = row?.value ? new Date(row.value) : null;
  return cooldownActive(lastFired, minutes, now);
}

export async function recordFired(key: string, now = new Date()): Promise<void> {
  const value = now.toISOString();
  const existing = await db.select({ id: configTable.id }).from(configTable).where(eq(configTable.key, key));
  if (existing.length > 0) {
    await db.update(configTable).set({ value, updatedAt: now }).where(eq(configTable.key, key));
  } else {
    await db.insert(configTable).values({ key, value });
  }
}

export interface IncidentInput {
  agentName: string;
  category: string;
  severity: "low" | "high";
  title: string;
  description: string;
}

// Same shape already used by public-digital-diagnosis.ts's inline insert —
// this doesn't change what Quality Center sees, just gives a second caller
// (Autopublicador Social, today) a shared function instead of a copy of
// this same db.insert().
export async function insertIncident(input: IncidentInput): Promise<number> {
  const [row] = await db.insert(incidentsTable).values({
    type: "ai_error",
    title: input.title,
    description: input.description,
    severity: input.severity,
    priority: input.severity === "high" ? "high" : "medium",
    status: "open",
    module: input.agentName,
  }).returning({ id: incidentsTable.id });
  return row!.id;
}

// Backs checkVolumeAnomaly() — counts by module (agentName) regardless of
// category, so a burst of mixed failure types for the same agent still
// trips the spike alert, not just repeats of one category.
export async function countRecentIncidents(agentName: string, sinceMinutesAgo: number): Promise<number> {
  const since = new Date(Date.now() - sinceMinutesAgo * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidentsTable)
    .where(and(eq(incidentsTable.module, agentName), gte(incidentsTable.createdAt, since)));
  return row?.count ?? 0;
}
