import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validQuantity,
  lineCents,
  chargeTotals,
} from "../src/lib/quantities.mjs";
import { addSaleLine, saleCartTotals } from "../src/lib/sale-cart.mjs";
import { invoiceLines } from "../src/lib/invoice.mjs";
import { restoredSaleBody } from "../src/lib/pending-draft.mjs";
import {
  prepareFinancialRequest,
  finishFinancialRequest,
} from "../src/lib/financial-retries.js";
test("KG/LITER accept thousandths, pieces/boxes keep whole-unit validation", () => {
  for (const u of ["KG", "LITER"])
    assert.equal(validQuantity("0.125", u), true);
  for (const u of ["PIECE", "BOX"])
    assert.equal(validQuantity("0.125", u), false);
  for (const value of ["1e-3", "0.0001", "-1", null, "1x"])
    assert.equal(validQuantity(value, "KG"), false);
  assert.equal(lineCents(12.5, 0.333), 416);
});
test("adding a sub-unit remainder never exceeds shared stock, including gifts", () => {
  const p = {
    id: "p",
    name: "Weight",
    unit: "KG",
    stockQty: 0.375,
    salePrice: 10,
  };
  let lines = addSaleLine([], p);
  assert.equal(lines[0].quantity, 0.375);
  assert.equal(saleCartTotals(lines).valid, true);
  assert.throws(() => addSaleLine(lines, p, true));
  lines = [{ ...lines[0], quantity: 0.125 }];
  lines = addSaleLine(lines, p, true);
  assert.equal(saleCartTotals(lines).quantity, 0.375);
  assert.equal(saleCartTotals(lines).amount, 1.25);
});
test("discount before tax matches server cents and invoice uses allocated gross line totals", () => {
  const lines = [
    { productId: "p", quantity: 0.333, unitPrice: 10 },
    { productId: "p", quantity: 0.667, unitPrice: 10 },
  ];
  const total = chargeTotals(lines, 7.5, 18);
  assert.deepEqual(total, {
    valid: true,
    subtotal: 10,
    discount: 0.75,
    tax: 1.67,
    total: 10.92,
  });
  for (const rate of [101, -1, "0.001", "abc"])
    assert.equal(chargeTotals(lines, rate, 18).valid, false);
  assert.equal(
    invoiceLines({
      items: [
        { quantity: 0.333, unitPrice: 10, lineTotalAmount: "3.64", unit: "KG" },
      ],
    })[0].total,
    3.64,
  );
});
test("a restored charged sale retains its exact body; changing rates creates a separate attempt", () => {
  const pending = {
    body: { discountPercent: 10, taxPercent: 18 },
    mode: "new",
    newCustomer: { name: "Test" },
    lines: [],
    note: "",
    discountPercent: "10",
    taxPercent: "18",
  };
  assert.equal(
    restoredSaleBody(pending, { ...pending, file: null }),
    pending.body,
  );
  assert.equal(
    restoredSaleBody(pending, { ...pending, file: null, taxPercent: "20" }),
    null,
  );
});
test("reminder retries retain an uncertain key and success permits a new attempt", async () => {
  const make = () => ({
    url: "/extras/customers/c/reminders",
    method: "post",
    headers: {},
    data: { recipient: "client@example.com", debt: 10 },
  });
  const a = await prepareFinancialRequest(make(), "session");
  finishFinancialRequest(a, 500);
  const b = await prepareFinancialRequest(make(), "session");
  assert.equal(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  finishFinancialRequest(b, 201);
  const c = await prepareFinancialRequest(make(), "session");
  assert.notEqual(c.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
});

test("pre-upgrade lost-response drafts with implicit zero rates still replay unchanged", () => {
  const body = { customerId: "c", initialPayment: { amount: 15 } },
    pending = {
      body,
      mode: "existing",
      customer: { id: "c" },
      lines: [],
      credit: 5,
      paymentMode: "full",
      note: "",
    };
  assert.equal(
    restoredSaleBody(pending, {
      ...pending,
      file: null,
      credit: 0,
      discountPercent: "0",
      taxPercent: "0",
    }),
    body,
  );
});
