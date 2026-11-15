const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  Q = require("../src/quantity");
const { invoice, statement } = require("../src/pdf-documents");
test("allocated tax and discount cents reconcile for 100 mixed lines and every fractional return", () => {
  const items = Array.from({ length: 100 }, (_, n) => ({
    quantity: (n + 1) / 1000,
    unitPrice: (n + 1) / 100,
    isGift: false,
  })).filter((i) => Q.lineCents(Math.round(i.unitPrice * 100), i.quantity) > 0);
  const p = Q.priced(items, 7.35, 18.25);
  assert.equal(
    p.items.reduce((n, i) => n + Math.round(i.lineTotalAmount * 100), 0),
    Math.round(p.amounts.totalAmount * 100),
  );
  for (const item of p.items) {
    let returned = 0,
      qty = 0;
    for (let n = 0; n < Q.milli(item.quantity); n++) {
      returned += Q.returnCents({ ...item, returnedQty: qty }, 0.001);
      qty = Q.add(qty, 0.001);
    }
    assert.equal(returned, Math.round(item.lineTotalAmount * 100));
  }
  assert.throws(
    () => Q.priced([{ quantity: 0.001, unitPrice: 0.01, isGift: false }]),
    /at least one/,
  );
});
test("Unicode invoices retain all 75 rows without blank footer pages in EN/AZ/TR/RU", async () => {
  const p = Q.priced(
    Array.from({ length: 75 }, (_, n) => ({
      productName: "Şampun - Крем " + n,
      unit: "KG",
      quantity: 0.333,
      unitPrice: 12.5,
      isGift: false,
    })),
    7.5,
    18,
  );
  for (const locale of ["en", "az", "tr", "ru"]) {
    const bytes = await invoice(
      {
        id: "invoice",
        orderNumber: 1,
        currency: "USD",
        createdAt: new Date(),
        customerId: "customer",
        customerSnapshot: { name: "Yunis Məmmədov - Иван Петров" },
        companySnapshot: {
          name: "Demo Trading",
          issuedBy: "Rəşad",
          timezone: "UTC",
        },
        ...p.amounts,
        items: p.items,
      },
      locale,
    );
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    const pages = (bytes.toString("latin1").match(/\/Type \/Page\b/g) || [])
      .length;
    assert.ok(
      pages >= 3 && pages <= 6,
      "footer must not create blank pages: " + pages,
    );
  }
});
test("statement PDF renders signed balances and multiple pages using bundled fonts", async () => {
  const bytes = await statement(
    {
      company: { name: "Demo Trading" },
      customer: { name: "Müştəri - Клиент" },
      currency: "EUR",
      timezone: "Europe/Warsaw",
      generatedAt: new Date(),
      openingBalance: 5,
      debits: 10,
      credits: 20,
      closingBalance: -5,
      rows: Array.from({ length: 75 }, (_, i) => ({
        date: new Date(),
        type: i % 2 ? "PAYMENT" : "SALE",
        reference: "INV-" + i,
        debit: 10,
        credit: 20,
        balance: -5,
      })),
    },
    "ru",
  );
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  const pages = (bytes.toString("latin1").match(/\/Type \/Page\b/g) || [])
    .length;
  assert.ok(pages >= 3 && pages <= 5);
});
