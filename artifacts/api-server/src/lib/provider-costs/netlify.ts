export interface NetlifyPlanCost {
  ok: boolean;
  error: string | null;
  planName: string | null;
  monthlyDollarPrice: number | null;
  creditsIncluded: number | null;
  creditsUsed: number | null;
}

interface NetlifyAccount {
  type_name: string;
  member_monthly_dollar_price: number | null;
  plan_credits: number | null;
  capabilities?: { credits?: { used?: number } };
}

// Netlify's API has no invoice/spend endpoint (confirmed against
// docs.netlify.com — billing is UI/dashboard-only). The one real dollar
// figure it does expose is the account's flat monthly plan price; usage is
// reported in plan-included credits, not a $ amount.
export async function fetchNetlifyPlanCost(): Promise<NetlifyPlanCost> {
  const empty = { planName: null, monthlyDollarPrice: null, creditsIncluded: null, creditsUsed: null };
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    return { ok: false, error: "NETLIFY_API_TOKEN no configurado", ...empty };
  }
  try {
    const res = await fetch("https://api.netlify.com/api/v1/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Netlify API error: ${res.status}`, ...empty };
    }
    const accounts = (await res.json()) as NetlifyAccount[];
    const account = accounts[0];
    if (!account) {
      return { ok: false, error: "No se encontró ninguna cuenta de Netlify", ...empty };
    }
    return {
      ok: true,
      error: null,
      planName: account.type_name,
      monthlyDollarPrice: account.member_monthly_dollar_price ?? 0,
      creditsIncluded: account.plan_credits ?? 0,
      creditsUsed: account.capabilities?.credits?.used ?? 0,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), ...empty };
  }
}
