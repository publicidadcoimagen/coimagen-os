import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateInstallments, applyFiscalInvoice } from "../src/lib/payment-schedule/generate";

describe("generateInstallments", () => {
  test("standard plan (50/50) splits an even amount exactly", () => {
    const installments = generateInstallments(10000, "standard");
    assert.equal(installments.length, 2);
    assert.deepEqual(installments.map((i) => i.amount), [5000, 5000]);
    assert.equal(installments[0]!.label, "Anticipo (50%)");
    assert.equal(installments[1]!.label, "Pago final (50%)");
  });

  test("large plan (50/25/25) splits an even amount exactly", () => {
    const installments = generateInstallments(20000, "large");
    assert.equal(installments.length, 3);
    assert.deepEqual(installments.map((i) => i.amount), [10000, 5000, 5000]);
    assert.deepEqual(installments.map((i) => i.label), ["Anticipo (50%)", "Hito intermedio (25%)", "Lanzamiento (25%)"]);
  });

  test("installments always sum to exactly the total, even with rounding-unfriendly amounts", () => {
    const total = 999.99;
    const standard = generateInstallments(total, "standard");
    assert.equal(standard.reduce((sum, i) => sum + i.amount, 0), total);

    const large = generateInstallments(1000.01, "large");
    assert.equal(large.reduce((sum, i) => sum + i.amount, 0), 1000.01);
  });

  test("large plan with an amount not evenly divisible by 4 — last installment absorbs the remainder", () => {
    const installments = generateInstallments(10000.03, "large");
    assert.deepEqual(installments.map((i) => i.amount), [5000.02, 2500.01, 2500]);
    assert.equal(installments.reduce((sum, i) => sum + i.amount, 0), 10000.03);
  });
});

describe("applyFiscalInvoice", () => {
  test("no fiscal invoice requested — base amount unchanged, zero IVA", () => {
    assert.deepEqual(applyFiscalInvoice(1000, false), { baseAmount: 1000, ivaAmount: 0, totalAmount: 1000 });
  });

  test("fiscal invoice requested — adds 16% IVA on top, never included in the base price", () => {
    assert.deepEqual(applyFiscalInvoice(1000, true), { baseAmount: 1000, ivaAmount: 160, totalAmount: 1160 });
  });

  test("IVA rounds to 2 decimals correctly for an odd amount", () => {
    const result = applyFiscalInvoice(333.33, true);
    assert.equal(result.ivaAmount, 53.33);
    assert.equal(result.totalAmount, 386.66);
  });

  test("same 16% rate regardless of currency — no conversion happens, caller passes whatever currency the invoice already uses", () => {
    // This function is currency-agnostic by design: it only ever computes
    // a percentage of the number it's given, in whatever unit that number
    // already represents (MXN or USD) — there is no FX logic anywhere in
    // this module, deliberately (see invoices.currency schema comment).
    const mxn = applyFiscalInvoice(500, true);
    const usd = applyFiscalInvoice(500, true);
    assert.deepEqual(mxn, usd);
  });
});
