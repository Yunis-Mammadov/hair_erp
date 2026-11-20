const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const tests = path.join(root, "tests");
const marker = 'await require("./helpers/current-migrations.cjs")';
const changes = [];

for (const name of fs.readdirSync(tests)) {
  if (!name.endsWith(".cjs")) continue;
  const file = path.join(tests, name);
  const old = fs.readFileSync(file, "utf8");
  let text = old;
  if (text.includes("202611130001_group7_extras") && !text.includes(marker)) {
    if (name === "group1-native.cjs") {
      const start = text.indexOf("for (const migration of migrations.filter(");
      const end = text.indexOf("await client.query(", start);
      if (start < 0 || end < 0) throw Error("Native fixture format changed; no files written.");
      text = text.slice(0, start) +
        'for (const migration of migrations.filter(m => m < "202611100001_group1_financials"))\n        ' + text.slice(end);
      const line = /await client\.query\(await fs\.readFile\(path\.join\(root,\s*"202611130001_group7_extras\/migration\.sql"\),"utf8"\)\);/;
      if (!line.test(text)) throw Error("Native migration anchor not found; no files written.");
      text = text.replace(line, match => match + '\n      ' + marker + '(client, "202611130001_group7_extras");');
    } else if (name === "group6-backup-native.cjs") {
      const line = /for\(const name of \[[^\n]+\]\)await client\.query\([^\n]+\);/;
      if (!line.test(text)) throw Error("Backup fixture anchor not found; no files written.");
      text = text.replace(line, match => match + '\n  ' + marker + '(client, "202611130001_group7_extras");');
    } else if (text.includes("new PGLiteSocketServer")) {
      const line = /^(\s*)(?:const )?wire = new PGLiteSocketServer/m;
      if (!line.test(text)) throw Error(name + ": fixture anchor not found; no files written.");
      text = text.replace(line, (match, space) =>
        space + marker + '(db, "202611130001_group7_extras");\n' + match);
    }
  }
  if (name === "group1-native.cjs") {
    text = text.replace("29 real migrations preserve legacy IDs, money, PIN and stock", "Current migrations preserve legacy IDs, money, PIN and stock");
    text = text.replace('assert.equal(migrations.length, 29);',
      'assert.equal((await client.query("SELECT data_type FROM information_schema.columns WHERE table_name = \'Purchase\' AND column_name = \'purchaseDate\'")).rows[0].data_type, "date");\n          assert.ok((await raw.company.findUnique({where:{id:"legacy-company"}})).authVersion >= 1);');
  }
  // Update actual purchase payloads; do not change expected status codes.
  text = text.replace(
    /(["']\/purchases["']\s*,\s*["']POST["']\s*,\s*\{)\s*(?=items\s*:)/g,
    '$1 supplier: "Fixture Supplier", purchaseDate: "2026-11-01", ',
  );
  if (name === "group2-security.test.cjs") {
    text = text.replace(/(payload = \{\s*)(?=items\s*:)/,
      '$1supplier: "Fixture Supplier", purchaseDate: "2026-11-01",\n            ');
  }
  if (text !== old) changes.push({ file, text });
}

// Validate all transforms before writing any file.
for (const change of changes) fs.writeFileSync(change.file, change.text);
console.log(`${changes.length} test faylı yeniləndi. Təkrar işlətmək təhlükəsizdir.`);
