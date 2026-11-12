import messages from "../../../shared/messages.json" with { type: "json" };

export const languages = [{code:"en",name:"English",locale:"en-US"},{code:"az",name:"Azərbaycanca",locale:"az-AZ"},{code:"tr",name:"Türkçe",locale:"tr-TR"},{code:"ru",name:"Русский",locale:"ru-RU"}];
let saved;
try { saved = globalThis.localStorage?.getItem("z-index-language"); } catch { /* Storage is optional. */ }
let state = { language: languages.some(l => l.code === saved) ? saved : "en", currency: "USD", timezone: "UTC" };
const listeners = new Set();
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getSnapshot = () => state;
function update(values) {
  if (Object.keys(values).every(k => state[k] === values[k])) return;
  state = { ...state, ...values }; listeners.forEach(fn => fn());
}
export function setLanguage(language) {
  if (!languages.some(l => l.code === language)) return;
  try { globalThis.localStorage?.setItem("z-index-language", language); } catch { /* Storage is optional. */ }
  update({ language });
  if (globalThis.document) document.documentElement.lang = language;
}
export function setWorkspace(company) { update({ currency: company?.currency || "USD", timezone: company?.timezone || "UTC" }); }
const aliases = new Map();
for (const [key, row] of Object.entries(messages)) for (const value of Object.values(row)) if (value && !aliases.has(value)) aliases.set(value, key);
const enums = { "NAĞD":"Nağd", "REALİZASİYA":"Realizasiya", "HİSSƏLİ":"Hissəli", "DİGƏR":"Digər", BORCLU:"Borclu", ODENIB:"Ödənib", QISMEN_ODENIB:"Qismən ödənib", ADMIN:"Administrator", EXPEDITOR:"Ekspeditor", WAREHOUSE:"Anbar əməkdaşı", DRIVER:"Sürücü", CASH:"Nağd", BANK:"Bank", CARD:"Kart", IN_WAREHOUSE:"Anbarda", ON_BOARD:"Yoldadır", DELIVERED:"Çatdırılıb" };
export function t(key, values = {}) {
  if (typeof key !== "string") return key;
  const lookup = enums[key] || key;
  const row = messages[lookup] || messages[aliases.get(lookup)];
  const value = row?.[state.language] || row?.en || key;
  return value.replace(/\{(\w+)\}/g, (match, k) => Object.hasOwn(values, k) ? String(values[k] ?? "") : match);
}
export const locale = () => languages.find(l => l.code === state.language).locale;
export function formatMoney(value, currency = state.currency) {
  return new Intl.NumberFormat(locale(), {style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value || 0));
}
export function formatDate(value, withTime = true, timezone = state.timezone) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat(locale(), {dateStyle:"medium", ...(withTime ? {timeStyle:"short"} : {}), timeZone:timezone}).format(new Date(value));
}
export function dateParts(value) { return { date: formatDate(value, false), time: !value ? "" : new Intl.DateTimeFormat(locale(), {timeStyle:"short",timeZone:state.timezone}).format(new Date(value)) }; }
export const formatNumber = value => new Intl.NumberFormat(locale()).format(Number(value || 0));
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:state.timezone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
  return ["year","month","day"].map(k => parts.find(p => p.type === k).value).join("-");
}

export function formatTime(value, timezone = state.timezone) {
 if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
 return new Intl.DateTimeFormat(locale(), {timeStyle:"short",timeZone:timezone}).format(new Date(value));
}
export function formatMonth(value) { return new Intl.DateTimeFormat(locale(), {month:"long",year:"numeric",timeZone:state.timezone}).format(new Date(value)); }
