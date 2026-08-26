import { eq } from "drizzle-orm";
import { db, configTable, incidentsTable } from "@workspace/db";

const CONFIG_KEY = "client_room_crash_alert_last_sent_at";
// A crash blocks a client from doing anything on that page, so staff should
// hear about a *new* occurrence fast — but the same broken page reloaded
// repeatedly (or several tabs) would otherwise send one email per reload.
// Every occurrence still gets its own incident row regardless of cooldown;
// only the email is throttled, same split as anthropic-balance-alert.
export const COOLDOWN_MINUTES = 15;

export async function getLastAlertSentAt(): Promise<Date | null> {
  const [row] = await db.select({ value: configTable.value }).from(configTable).where(eq(configTable.key, CONFIG_KEY));
  if (!row?.value) return null;
  const parsed = new Date(row.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function recordAlertSent(now: Date): Promise<void> {
  const value = now.toISOString();
  const existing = await db.select({ id: configTable.id }).from(configTable).where(eq(configTable.key, CONFIG_KEY));
  if (existing.length > 0) {
    await db.update(configTable).set({ value, updatedAt: now }).where(eq(configTable.key, CONFIG_KEY));
  } else {
    await db.insert(configTable).values({ key: CONFIG_KEY, value });
  }
}

export function cooldownActive(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return false;
  const minutesSince = (now.getTime() - lastSentAt.getTime()) / (1000 * 60);
  return minutesSince < COOLDOWN_MINUTES;
}

export interface ClientRoomCrashReport {
  slug: string;
  path: string;
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent?: string;
  userId: string;
  userEmail: string | null;
  userRole: string;
  clientId: number | null;
}

export async function recordCrashIncident(report: ClientRoomCrashReport): Promise<number> {
  const logs = [
    `Usuario: ${report.userEmail ?? report.userId} (rol: ${report.userRole}${report.clientId != null ? `, clientId: ${report.clientId}` : ""})`,
    `Ruta: ${report.path}`,
    `User agent: ${report.userAgent ?? "(no disponible)"}`,
    "",
    "Stack:",
    report.stack ?? "(no disponible)",
    "",
    "Component stack:",
    report.componentStack ?? "(no disponible)",
  ].join("\n");

  const [row] = await db.insert(incidentsTable).values({
    type: "bug",
    title: `Client Room caído — /client/${report.slug}: ${report.message}`.slice(0, 500),
    description: `Un error de React tumbó por completo el Client Room de la organización "${report.slug}" — pantalla en negro para quien lo haya visto, sin nada visible del error.`,
    severity: "critical",
    priority: "high",
    module: "Client Room",
    clientId: report.clientId,
    logs,
    status: "open",
  }).returning({ id: incidentsTable.id });

  return row!.id;
}
