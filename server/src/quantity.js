// Thousandths for stock, integer minor units for money. No binary-float accounting.
const { Decimal } = require("@prisma/client").Prisma;
const error = (message) =>
  Object.assign(new Error(message), {
    statusCode: 400,
    code: "INVALID_QUANTITY",
  });
const units = ["PIECE", "BOX", "KG", "LITER"];
function unit(value = "PIECE") {
  if (!units.includes(value)) throw error("Choose PIECE, BOX, KG or LITER.");
  return value;
}
function milli(value, min = 1, max = 1000000000) {
  if (
    !["number", "string"].includes(typeof value) ||
    !/^\d+(?:\.\d{1,3})?$/.test(String(value))
  )
    throw error("Quantity requires at most three decimal places.");
  const n = new Decimal(value).mul(1000).toNumber();
  if (!Number.isSafeInteger(n) || n < min || n > max * 1000)
    throw error("Quantity is outside the allowed range.");
  return n;
}
function quantity(value, u, min = 1, max = 1000000) {
  const n = milli(value, min, max);
  if (u && !["KG", "LITER"].includes(unit(u)) && n % 1000)
    throw error("Pieces and boxes require whole quantities.");
  return n / 1000;
}
const add = (a, b) => new Decimal(a || 0).add(b || 0).toNumber();
const sub = (a, b) => new Decimal(a || 0).sub(b || 0).toNumber();
function roundedRatio(n, m, d) {
  const v = (BigInt(n) * BigInt(m) + BigInt(d) / 2n) / BigInt(d);
  const result = Number(v);
  if (!Number.isSafeInteger(result))
    throw error("Document amount exceeds the allowed range.");
  return result;
}
const lineCents = (priceCents, qty) =>
  roundedRatio(priceCents, milli(String(qty), 0), 1000);
function rate(value = 0) {
  if (
    !["number", "string"].includes(typeof value) ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value))
  )
    throw error("Enter a percentage with up to two decimals.");
  const n = new Decimal(value).mul(100).toNumber();
  if (n < 0 || n > 10000) throw error("Percentage must be between 0 and 100.");
  return n;
}
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const parts = weights.map((w, i) => ({
    i,
    n: Number((BigInt(total) * BigInt(w)) / BigInt(sum)),
    r: (BigInt(total) * BigInt(w)) % BigInt(sum),
  }));
  let left = total - parts.reduce((n, p) => n + p.n, 0);
  for (const p of [...parts].sort((a, b) =>
    a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1,
  )) {
    if (left-- <= 0) break;
    p.n++;
  }
  return parts.map((p) => p.n);
}
function priced(items, discountPercent = 0, taxPercent = 0) {
  const F = require("./financial-core");
  const discount = rate(discountPercent),
    tax = rate(taxPercent);
  const base = items.map((i) =>
    i.isGift ? 0 : lineCents(F.minor(i.unitPrice), i.quantity),
  );
  if (base.some((n, i) => !items[i].isGift && n < 1))
    throw error("A paid line must be worth at least one minor currency unit.");
  const subtotal = base.reduce((a, b) => a + b, 0),
    discountCents = roundedRatio(subtotal, discount, 10000),
    discounts = allocate(discountCents, base),
    net = base.map((n, i) => n - discounts[i]),
    taxCents = roundedRatio(subtotal - discountCents, tax, 10000),
    taxes = allocate(taxCents, net),
    total = subtotal - discountCents + taxCents;
  if (total > 999999999999)
    throw error("Document amount exceeds the allowed range.");
  return {
    amounts: {
      subtotalAmount: subtotal / 100,
      discountPercent: discount / 100,
      taxPercent: tax / 100,
      discountAmount: discountCents / 100,
      taxAmount: taxCents / 100,
      totalAmount: total / 100,
    },
    items: items.map((i, k) => ({
      ...i,
      subtotalAmount: base[k] / 100,
      discountAmount: discounts[k] / 100,
      taxAmount: taxes[k] / 100,
      lineTotalAmount: (net[k] + taxes[k]) / 100,
    })),
  };
}
function returnCents(item, quantity) {
  const F = require("./financial-core");
  const total =
    item.lineTotalAmount == null
      ? lineCents(F.minor(item.unitPrice), item.quantity)
      : F.minor(item.lineTotalAmount);
  const before = milli(String(item.returnedQty), 0),
    after = before + milli(String(quantity));
  return (
    roundedRatio(total, after, milli(String(item.quantity))) -
    roundedRatio(total, before, milli(String(item.quantity)))
  );
}
module.exports = {
  unit,
  units,
  milli,
  quantity,
  add,
  sub,
  roundedRatio,
  lineCents,
  rate,
  priced,
  returnCents,
};
