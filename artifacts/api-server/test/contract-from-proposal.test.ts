import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contractFromProposalError, contractValuesFromProposal, contractFeeText, type ProposalForContract } from "../src/lib/contracts/from-proposal";

const base: ProposalForContract = {
  id: 6, title: "Ecommerce", clientId: 25, status: "accepted", amount: "99", monthlyAmount: null, currency: "MXN",
};

describe("contract from proposal", () => {
  test("only an accepted, converted proposal with an amount can generate a contract", () => {
    assert.equal(contractFromProposalError(base), null);
    assert.equal(contractFromProposalError({ ...base, clientId: null }), "proposal_not_converted");
    assert.equal(contractFromProposalError({ ...base, status: "sent" }), "proposal_not_accepted");
    assert.equal(contractFromProposalError({ ...base, amount: null, monthlyAmount: null }), "proposal_has_no_amount");
  });

  test("draft linked to client + proposal, amount in cents, monthly fee wins", () => {
    assert.deepEqual(contractValuesFromProposal(base, "ecommerce", "Camila"), {
      type: "ecommerce", title: "Contrato — Ecommerce", service: "Ecommerce", clientId: 25, proposalId: 6,
      amount: 9900, currency: "MXN", createdBy: "Camila", status: "draft",
    });
    assert.equal(contractValuesFromProposal({ ...base, monthlyAmount: "1499.5" }, "growth", "x").amount, 149950);
  });
});

describe("contractFeeText — DocuSeal fee field", () => {
  const norm = (t: string) => t.replace(/\s/g, " ");

  test("one-time proposal says 'pago único', never '/mes'", () => {
    const text = norm(contractFeeText({ contractAmountCents: 9900, currency: "MXN", isEn: false, proposal: { amount: "99", monthlyAmount: null } }));
    assert.match(text, /pago único/);
    assert.doesNotMatch(text, /\/mes/);
  });

  test("monthly-only proposal says '/mes'", () => {
    assert.match(norm(contractFeeText({ contractAmountCents: 150000, currency: "MXN", isEn: false, proposal: { amount: null, monthlyAmount: "1500" } })), /\/mes$/);
  });

  test("setup + monthly states both", () => {
    const text = norm(contractFeeText({ contractAmountCents: 150000, currency: "USD", isEn: true, proposal: { amount: "500", monthlyAmount: "1500" } }));
    assert.match(text, /\/mo \+ .*\(setup\)$/);
  });

  test("legacy contract without a proposal keeps the old amount/mes wording", () => {
    assert.match(norm(contractFeeText({ contractAmountCents: 300000, currency: "MXN", isEn: false, proposal: null })), /\/mes$/);
    assert.equal(contractFeeText({ contractAmountCents: null, currency: "MXN", isEn: false, proposal: null }), "");
  });
});
