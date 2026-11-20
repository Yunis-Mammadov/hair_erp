const fs = require("node:fs/promises");
const path = require("node:path");
module.exports = async function applyCurrentMigrations(db, after) {
  const root = path.resolve(__dirname, "../../prisma/migrations");
  const names = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name > after)
    .map(entry => entry.name).sort();
  for (const name of names) {
    const sql = await fs.readFile(path.join(root, name, "migration.sql"), "utf8");
    if (typeof db.exec === "function") await db.exec(sql);
    else await db.query(sql);
  }
};
