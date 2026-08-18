import { and, eq, gte, ilike, desc } from "drizzle-orm";
import { db, aiExecutionsTable, configTable } from "@workspace/db";

const CONFIG_KEY = "anthropic_balance_alert_last_sent_at";
export const COOLDOWN_HOURS = 6;
// Cron runs hourly (see scheduler.ts) — a 65-minute lookback gives a small
// overlap buffer so a signal landing right at the edge of a run is never
// missed between two consecutive checks.
const DETECTION_WINDOW_MINUTES = 65;

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
  const hoursSince = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60);
  return hoursSince < COOLDOWN_HOURS;
}

export type LowBalanceSignal = "fallback_used" | "execution_failed";

export interface LowBalanceDetection {
  signal: LowBalanceSignal;
  count: number;
  mostRecentAt: Date;
}

// Señal A: Digital Diagnosis silently fell back to Gemini — the only code
// path that ever writes provider="google" is generateDigitalDiagnosis's
// catch block in lib/digital-diagnosis/analyze.ts, reached only after
// Anthropic threw isInsufficientCreditError. The diagnosis itself still
// succeeded (200 to the client), which is exactly why this needs its own
// alert — nothing else would ever surface it.
async function detectFallbackUsed(since: Date): Promise<LowBalanceDetection | null> {
  const rows = await db
    .select({ createdAt: aiExecutionsTable.createdAt })
    .from(aiExecutionsTable)
    .where(and(eq(aiExecutionsTable.provider, "google"), gte(aiExecutionsTable.createdAt, since)))
    .orderBy(desc(aiExecutionsTable.createdAt));
  if (rows.length === 0) return null;
  return { signal: "fallback_used", count: rows.length, mostRecentAt: rows[0]!.createdAt };
}

// Señal B: an execution failed outright carrying Anthropic's own "credit
// balance is too low" message — same substring isInsufficientCreditError
// matches in analyze.ts, for whatever path recorded status="failed" with
// that error text (e.g. the Gemini fallback also failing).
async function detectExecutionFailed(since: Date): Promise<LowBalanceDetection | null> {
  const rows = await db
    .select({ createdAt: aiExecutionsTable.createdAt })
    .from(aiExecutionsTable)
    .where(and(
      eq(aiExecutionsTable.status, "failed"),
      ilike(aiExecutionsTable.errors, "%credit balance%"),
      gte(aiExecutionsTable.createdAt, since),
    ))
    .orderBy(desc(aiExecutionsTable.createdAt));
  if (rows.length === 0) return null;
  return { signal: "execution_failed", count: rows.length, mostRecentAt: rows[0]!.createdAt };
}

// Checks Señal A first — it's the path that actually happens today (silent
// fallback, diagnosis still delivered); Señal B is checked only if A found
// nothing, as a second, less common way the same underlying problem shows up.
export async function detectLowBalanceSignal(now = new Date()): Promise<LowBalanceDetection | null> {
  const since = new Date(now.getTime() - DETECTION_WINDOW_MINUTES * 60 * 1000);
  return (await detectFallbackUsed(since)) ?? (await detectExecutionFailed(since));
}
