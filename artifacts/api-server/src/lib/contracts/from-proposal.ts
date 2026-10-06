// Pure helpers for contracts generated from a proposal — no DB, unit-testable.
// Before this, staff created every contract by hand (re-typing the amount in
// cents, with no link to the proposal) and DocuSeal always rendered the fee
// as "/mes", even for a one-time project.

export type ProposalForContract = {
  id: number;
  title: string;
  clientId: number | null;
  status: string;
  amount: string | null;        // one-time project total
  monthlyAmount: string | null; // recurring monthly fee, if any
  currency: string;
};

export type ContractFromProposalError = "proposal_not_converted" | "proposal_not_accepted" | "proposal_has_no_amount";

export function contractFromProposalError(p: ProposalForContract): ContractFromProposalError | null {
  if (p.clientId === null) return "proposal_not_converted";
  if (p.status !== "accepted") return "proposal_not_accepted";
  if (p.amount === null && p.monthlyAmount === null) return "proposal_has_no_amount";
  return null;
}

function toCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

// contracts.amount is integer cents. The recurring fee wins when there is
// one, since that's what the contract's monthly_fee field is about; the
// full breakdown still reaches DocuSeal through contractFeeText below.
export function contractValuesFromProposal(p: ProposalForContract, type: string, createdBy: string) {
  return {
    type,
    title: `Contrato — ${p.title}`,
    service: p.title,
    clientId: p.clientId,
    proposalId: p.id,
    amount: toCents(p.monthlyAmount ?? p.amount!),
    currency: p.currency,
    createdBy,
    status: "draft" as const,
  };
}

function money(cents: number, currency: string, isEn: boolean): string {
  return new Intl.NumberFormat(isEn ? "en-US" : "es-MX", { style: "currency", currency }).format(cents / 100);
}

// Text for the DocuSeal template's single fee field (named monthly_fee in
// the template). With a linked proposal it states exactly what the client
// pays; without one (legacy hand-made contracts) it keeps the old
// "amount/mes" wording, since nothing else says how that amount recurs.
export function contractFeeText(input: {
  contractAmountCents: number | null;
  currency: string;
  isEn: boolean;
  proposal: Pick<ProposalForContract, "amount" | "monthlyAmount"> | null;
}): string {
  const { currency, isEn, proposal } = input;
  const perMonth = isEn ? "/mo" : "/mes";
  if (proposal) {
    const monthly = proposal.monthlyAmount !== null ? toCents(proposal.monthlyAmount) : null;
    const oneTime = proposal.amount !== null ? toCents(proposal.amount) : null;
    if (monthly !== null && oneTime !== null && oneTime > 0) {
      return `${money(monthly, currency, isEn)}${perMonth} + ${money(oneTime, currency, isEn)} ${isEn ? "(setup)" : "(pago inicial)"}`;
    }
    if (monthly !== null) return `${money(monthly, currency, isEn)}${perMonth}`;
    if (oneTime !== null) return `${money(oneTime, currency, isEn)} ${isEn ? "(one-time payment)" : "(pago único)"}`;
  }
  if (input.contractAmountCents == null) return "";
  return `${money(input.contractAmountCents, currency, isEn)}${perMonth}`;
}
