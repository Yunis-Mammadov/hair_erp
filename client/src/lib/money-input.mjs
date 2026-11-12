export function decimalInput(value) { return typeof value === "string" && /^\d+,\d{1,2}$/.test(value) ? value.replace(",", ".") : value; }
export const amountValue = value => Number(decimalInput(value));
const fields = new Set(["amount", "salePrice", "unitPrice", "unitCost", "defaultPrice"]);
export function normalizeMoneyPayload(value) {
  if (Array.isArray(value)) return value.map(normalizeMoneyPayload);
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, fields.has(k) ? decimalInput(v) : normalizeMoneyPayload(v)]));
}
