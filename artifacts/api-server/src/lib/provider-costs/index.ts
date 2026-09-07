import { fetchNetlifyPlanCost, type NetlifyPlanCost } from "./netlify";
import { fetchRenderServices, type RenderCostInfo } from "./render";
import { fetchNeonConsumption, type NeonCostInfo } from "./neon";

export interface ProviderCostsResponse {
  netlify: NetlifyPlanCost;
  render: RenderCostInfo;
  neon: NeonCostInfo;
}

// Each provider call is independent — one provider being unconfigured or
// erroring (e.g. a missing NEON_API_KEY) must not take down the other two.
export async function fetchProviderCosts(): Promise<ProviderCostsResponse> {
  const [netlify, render, neon] = await Promise.all([
    fetchNetlifyPlanCost(),
    fetchRenderServices(),
    fetchNeonConsumption(),
  ]);
  return { netlify, render, neon };
}

export * from "./netlify";
export * from "./render";
export * from "./neon";
