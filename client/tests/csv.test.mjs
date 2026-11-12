import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV } from "../src/lib/csv.mjs";
test("CSV preserves BOM, leading-zero barcode, quoted commas, quotes and multiline cells", () => {
  const rows = parseCSV(
    '\uFEFFname,barcode,note\r\n"Shampoo, red",00123,"line 1\nline ""2"""\r\n',
  );
  assert.deepEqual(rows, [
    { name: "Shampoo, red", barcode: "00123", note: 'line 1\nline "2"' },
  ]);
});
test("CSV rejects malformed quotes, duplicate headers and wrong column counts", () => {
  for (const text of [
    'name,note\n"missing,quote',
    'name,note\n"ok"bad,note',
    "name,name\na,b",
    "name,note\na,b,c",
    "__proto__,name\na,b",
  ])
    assert.throws(() => parseCSV(text));
});
test("CSV import preview enforces file and 200-row limits", () => {
  assert.equal(
    parseCSV(
      "name\n" +
        Array.from({ length: 200 }, (_, i) => `Product ${i}`).join("\n"),
    ).length,
    200,
  );
  assert.throws(() =>
    parseCSV(
      "name\n" +
        Array.from({ length: 201 }, (_, i) => `Product ${i}`).join("\n"),
    ),
  );
  assert.throws(() => parseCSV("name\n" + "x".repeat(1000001)));
});
