import { amountValue, decimalInput } from "./money-input.mjs";
export const fractional = (unit) => ["KG", "LITER"].includes(unit);
export const quantityStep = (unit) => (fractional(unit) ? 0.001 : 1);
export const validQuantity = (value, unit = "PIECE", zero = false) =>
  /^\d+(?:\.\d{1,3})?$/.test(String(value)) &&
  Number(value) >= (zero ? 0 : fractional(unit) ? 0.001 : 1) &&
  Number(value) <= 1000000 &&
  (fractional(unit) || Number.isInteger(Number(value)));
export function lineCents(price, qty) {
  if (!Number.isFinite(Number(price)) || !Number.isFinite(Number(qty)))
    return NaN;
  return Number(
    (BigInt(Math.round(Number(price) * 100)) *
      BigInt(Math.round(Number(qty) * 1000)) +
      500n) /
      1000n,
  );
}
export function chargeTotals(lines, discount = 0, tax = 0) {
  const subtotal = lines.reduce(
      (n, i) =>
        n + (i.isGift ? 0 : lineCents(amountValue(i.unitPrice), i.quantity)),
      0,
    ),
    validRate = (v) =>
      /^\d+(?:\.\d{1,2})?$/.test(String(decimalInput(v))) &&
      amountValue(v) >= 0 &&
      amountValue(v) <= 100;
  const valid =
    validRate(discount) && validRate(tax) && Number.isSafeInteger(subtotal);
  if (!valid)
    return { valid: false, subtotal: 0, discount: 0, tax: 0, total: 0 };
  const ratio = (n, r) =>
      Number(
        (BigInt(n) * BigInt(Math.round(amountValue(r) * 100)) + 5000n) / 10000n,
      ),
    off = ratio(subtotal, discount),
    extra = ratio(subtotal - off, tax);
  return {
    valid: true,
    subtotal: subtotal / 100,
    discount: off / 100,
    tax: extra / 100,
    total: (subtotal - off + extra) / 100,
  };
}
