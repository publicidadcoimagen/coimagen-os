export interface RenderServiceInfo {
  id: string;
  name: string;
  plan: string;
  type: string;
  suspended: string;
}

export interface RenderCostInfo {
  ok: boolean;
  error: string | null;
  services: RenderServiceInfo[] | null;
}

interface RenderServiceRow {
  service: {
    id: string;
    name: string;
    type: string;
    suspended: string;
    serviceDetails?: { plan?: string; buildPlan?: string };
  };
}

// Render's public API (verified against api-docs.render.com) exposes zero
// billing/cost/invoice endpoints — this only reports real service inventory
// and each service's plan tier name. No dollar figure is fabricated; check
// the Render dashboard directly for the actual billed amount.
export async function fetchRenderServices(): Promise<RenderCostInfo> {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    return { ok: false, error: "RENDER_API_KEY no configurado", services: null };
  }
  try {
    const res = await fetch("https://api.render.com/v1/services?limit=100", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `Render API error: ${res.status}`, services: null };
    }
    const rows = (await res.json()) as RenderServiceRow[];
    return {
      ok: true,
      error: null,
      services: rows.map((r) => ({
        id: r.service.id,
        name: r.service.name,
        plan: r.service.serviceDetails?.plan ?? r.service.serviceDetails?.buildPlan ?? "unknown",
        type: r.service.type,
        suspended: r.service.suspended,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), services: null };
  }
}
