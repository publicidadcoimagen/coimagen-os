export interface NeonProjectConsumption {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  computeUnitSeconds: number;
  storageBytesHour: number;
  dataTransferBytes: number;
}

export interface NeonCostInfo {
  ok: boolean;
  error: string | null;
  consumption: NeonProjectConsumption[] | null;
}

interface NeonProject {
  id: string;
  org_id?: string;
}

interface NeonMetric {
  metric_name: string;
  value: number;
}

interface NeonConsumptionEntry {
  timeframe_start: string;
  timeframe_end: string;
  metrics: NeonMetric[];
}

interface NeonPeriod {
  period_start: string;
  period_end: string;
  consumption: NeonConsumptionEntry[];
}

interface NeonProjectHistory {
  project_id: string;
  periods: NeonPeriod[];
}

function metricValue(metrics: NeonMetric[], name: string): number {
  return metrics.find((m) => m.metric_name === name)?.value ?? 0;
}

const NEON_API_BASE = "https://console.neon.tech/api/v2";

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

// Neon's consumption API (verified against the live OpenAPI schema for
// getConsumptionHistoryPerProjectV2 — the response nests
// projects[].periods[].consumption[].metrics[], not a flat top-level
// "periods" array) returns real usage units — compute-seconds, storage
// byte-hours, transfer bytes — not a dollar amount; Neon leaves cost
// conversion to the caller. Requires NEON_API_KEY (console.neon.tech >
// Account Settings > API Keys) on a Launch/Scale/Agent/Enterprise plan, and
// an org_id: NEON_ORG_ID if set, otherwise the org_id of the caller's first
// project.
export async function fetchNeonConsumption(): Promise<NeonCostInfo> {
  const key = process.env.NEON_API_KEY;
  if (!key) {
    return { ok: false, error: "NEON_API_KEY no configurado", consumption: null };
  }
  const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };

  try {
    let orgId = process.env.NEON_ORG_ID;
    if (!orgId) {
      const projectsRes = await fetch(`${NEON_API_BASE}/projects`, { headers });
      if (!projectsRes.ok) {
        return { ok: false, error: `Neon API error (projects): ${projectsRes.status}`, consumption: null };
      }
      const { projects } = (await projectsRes.json()) as { projects: NeonProject[] };
      orgId = projects.find((p) => p.org_id)?.org_id;
      if (!orgId) {
        return { ok: false, error: "No se encontró un org_id de Neon asociado a esta API key", consumption: null };
      }
    }

    const { from, to } = currentMonthRange();
    const metrics = "compute_unit_seconds,root_branch_bytes_month,public_network_transfer_bytes,private_network_transfer_bytes";
    const url = `${NEON_API_BASE}/consumption_history/v2/projects?from=${from}&to=${to}&granularity=monthly&org_id=${orgId}&metrics=${metrics}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { ok: false, error: `Neon API error (consumption): ${res.status}`, consumption: null };
    }
    const { projects: history } = (await res.json()) as { projects: NeonProjectHistory[] };
    return {
      ok: true,
      error: null,
      consumption: history.flatMap((project) =>
        project.periods.flatMap((period) =>
          period.consumption.map((entry) => ({
            projectId: project.project_id,
            periodStart: entry.timeframe_start,
            periodEnd: entry.timeframe_end,
            computeUnitSeconds: metricValue(entry.metrics, "compute_unit_seconds"),
            storageBytesHour: metricValue(entry.metrics, "root_branch_bytes_month"),
            dataTransferBytes:
              metricValue(entry.metrics, "public_network_transfer_bytes") +
              metricValue(entry.metrics, "private_network_transfer_bytes"),
          })),
        ),
      ),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), consumption: null };
  }
}
