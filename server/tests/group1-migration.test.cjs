const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("money migration refuses historical sub-cent data without truncating or deleting it", async () => {
  const db = new PGlite();
  try {
    await db.waitReady;
    await db.exec(
      readFileSync(path.join(__dirname, "fixtures/legacy-schema.sql"), "utf8"),
    );
    await db.exec(
      readFileSync(
        path.join(
          __dirname,
          "../prisma/migrations/202611070001_company_basic_login/migration.sql",
        ),
        "utf8",
      ),
    );
    await db.exec(`INSERT INTO "Customer" (id,"companyId",name,"updatedAt") VALUES ('migration-customer','legacy-company','Migration customer',NOW());
      INSERT INTO "Payment" (id,"companyId","customerId",amount) VALUES ('migration-payment','legacy-company','migration-customer',0.001);`);
    const migration = readFileSync(
      path.join(
        __dirname,
        "../prisma/migrations/202611100001_group1_financials/migration.sql",
      ),
      "utf8",
    );
    await assert.rejects(
      db.exec(migration),
      /Existing invalid or sub-cent money/,
    );
    await db.exec("ROLLBACK");
    assert.equal(
      (
        await db.query('SELECT amount FROM "Payment" WHERE id=$1', [
          "migration-payment",
        ])
      ).rows[0].amount,
      0.001,
    );
    assert.equal(
      (
        await db.query(
          `SELECT to_regclass('public."OperationRequest"') AS relation`,
        )
      ).rows[0].relation,
      null,
    );
    // A reviewed, explicit correction enables a rerun; the migration never chooses a replacement amount.
    await db.exec(
      `UPDATE "Payment" SET amount=1.25 WHERE id='migration-payment'`,
    );
    await db.exec(migration);
    assert.equal(
      Number((await db.query('SELECT amount FROM "Payment"')).rows[0].amount),
      1.25,
    );
  } finally {
    await db.close();
  }
});
