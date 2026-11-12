const F = require("./financial-core");

const currencies = Object.freeze(["USD", "EUR", "AZN", "TRY", "RUB", "GBP", "PLN", "GEL", "UAH", "CAD", "AUD", "CHF"]);
function phone(value) {
  const input = F.text(value, 80);
  if (!input) return null;
  if (!/^\+?[0-9\s().-]+$/.test(input)) throw F.fail(400, "Enter a valid phone number (7–15 digits).", "INVALID_PHONE");
  const normalized = input.replace(/[\s().-]/g, "").replace(/^00/, "+");
  if (!/^\+?\d{7,15}$/.test(normalized)) throw F.fail(400, "Enter a valid phone number (7–15 digits).", "INVALID_PHONE");
  return normalized;
}
function coordinates(lat, lng) {
  if (lat == null && lng == null) return { lat: null, lng: null };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw F.fail(400, "Choose valid coordinates for both latitude and longitude.", "INVALID_LOCATION");
  return { lat, lng };
}
function customerData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw F.fail(400, "Check the customer details.");
  const name = F.text(input.name, 150);
  if (!name || name.length < 2) throw F.fail(400, "Customer name must contain at least two characters.", "INVALID_CUSTOMER_NAME");
  return { name, phone: phone(input.phone), salon: F.text(input.salon, 150), address: F.text(input.address, 500), areaId: input.areaId ? F.id(input.areaId) : null, ...coordinates(input.lat, input.lng) };
}
async function checkArea(tx, areaId) {
  if (areaId && !await tx.area.findFirst({ where: { id: areaId, isActive: true }, select: { id: true } })) throw F.fail(400, "Choose an active area belonging to this company.", "INVALID_AREA");
}
function validTimezone(value) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return typeof value === "string" && value.length < 100; } catch { return false; }
}
function calendar(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw F.fail(400, "Enter a valid calendar date.", "INVALID_DATE");
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw F.fail(400, "Enter a valid calendar date.", "INVALID_DATE");
  return d;
}
function localDay(value, zone = "UTC") {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = type => p.find(x => x.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
// Find a local day's first instant rather than assuming every day has 24 hours.
function zonedDay(value, zone = "UTC", next = false) {
  const target = calendar(value);
  if (next) target.setUTCDate(target.getUTCDate() + 1);
  const key = target.toISOString().slice(0, 10);
  let lo = target.getTime() - 48 * 3600000, hi = target.getTime() + 48 * 3600000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (localDay(mid, zone) < key) lo = mid + 1; else hi = mid; }
  return new Date(lo);
}
function dateRange(start, end, zone = "UTC") {
  if (!start && !end) return undefined;
  if (start) calendar(start);
  if (end) calendar(end);
  if (start && end && start > end) throw F.fail(400, "The end date must follow the start date.", "INVALID_DATE_RANGE");
  return { ...(start ? { gte: zonedDay(start, zone) } : {}), ...(end ? { lt: zonedDay(end, zone, true) } : {}) };
}
module.exports = { currencies, phone, coordinates, customerData, checkArea, validTimezone, calendar, localDay, zonedDay, dateRange };
