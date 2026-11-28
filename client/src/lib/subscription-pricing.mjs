import { amountValue, decimalInput } from "./money-input.mjs";

export function customMonthlyPriceMinor(value) {
  const input = decimalInput(value.trim());
  const cents = Math.round(amountValue(input) * 100);
  return /^\d+(?:\.\d{1,2})?$/.test(input) && cents > 0 && cents <= 2147483647 ? cents : null;
}
