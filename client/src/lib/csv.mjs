import { t } from "../i18n/runtime.js";
export function parseCSV(input) {
  const text = String(input).replace(/^\uFEFF/, "");
  if (text.length > 1000000) throw new Error(t("Fayl 1 MB-dan kiçik olmalıdır."));
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    afterQuote = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === undefined) throw new Error(t("CSV-də bağlanmayan dırnaq var."));
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || afterQuote) throw new Error(t("CSV dırnaqlarını yoxla."));
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r" || c === undefined) {
      row.push(field);
      field = "";
      afterQuote = false;
      if (c !== ",") {
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
      continue;
    }
    if (afterQuote)
      throw new Error(
        t("Dırnaqdan sonra yalnız vergül və ya yeni sətir ola bilər."),
      );
    field += c;
  }
  if (rows.length < 2)
    throw new Error(t("Başlıqdan sonra ən azı bir sətir lazımdır."));
  if (rows.length > 201)
    throw new Error(t("Bir faylda ən çox 200 məlumat sətri ola bilər."));
  const headers = rows.shift().map((h) => h.trim());
  if (
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => ["__proto__", "constructor", "prototype"].includes(h))
  )
    throw new Error(t("CSV başlıqları yanlışdır."));
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(t("Sətir {value0}: sütun sayı başlığa uyğun deyil.", {value0:index+2}));
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
