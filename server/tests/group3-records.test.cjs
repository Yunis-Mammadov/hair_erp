const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Group 3: invoices, inventory, pagination and CSV", async (t) => {
  const uploads = await fs.mkdtemp(path.join(os.tmpdir(), "z-index-group2-"));
  process.env.UPLOADS_DIR = uploads;
  const db = new PGlite();
  await db.waitReady;
  let wire, raw, server;
  try {
    await db.exec(
      await fs.readFile(
        path.join(__dirname, "fixtures/legacy-schema.sql"),
        "utf8",
      ),
    );
    for (const migration of [
      "202611070001_company_basic_login",
      "202611100001_group1_financials",
      "202611100002_group3_records",
      "202611100003_group4_global_setup",
      "202611110001_group5_workflows",
      "202611120001_group6_operations",
    ])
      await db.exec(
        await fs.readFile(
          path.join(
            __dirname,
            "../prisma/migrations",
            migration,
            "migration.sql",
          ),
          "utf8",
        ),
      );
    wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
    await wire.start();
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:" +
      wire.getServerConn().split(":")[1] +
      "/postgres?connection_limit=1";
    process.env.JWT_SECRET = "group2-test-only-secret-with-at-least-32-bytes";
    ({ platformPrisma: raw } = require("../src/prismaClient"));
    const { app } = require("../src/index"),
      { signToken } = require("../src/auth-security");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    async function api(url, method = "GET", body, token, headers = {}) {
      const res = await fetch(base + "/api" + url, {
        method,
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          "Idempotency-Key": randomUUID(),
          ...headers,
        },
        ...(body
          ? { body: typeof body === "string" ? body : JSON.stringify(body) }
          : {}),
      });
      return {
        status: res.status,
        headers: res.headers,
        body: res.headers.get("content-type")?.includes("json")
          ? await res.json()
          : await res.text(),
      };
    }
    function token(company, user, expires = "1h") {
      return signToken(
        {
          companyId: company.id,
          userId: user.id,
          companyVersion: company.authVersion,
          userVersion: user.authVersion,
        },
        "session",
        expires,
      );
    }
    async function fixture(plan = "BASIC") {
      const company = await raw.company.create({
        data: {
          name: "Group3",
          loginEmail: randomUUID() + "@zindex.invalid",
          passwordHash: "fixture",
          plan,
          isActive: true,
          endsAt: new Date(Date.now() + 86400000),
        },
      });
      const admin = await raw.user.create({
        data: { companyId: company.id, fullName: "Admin", role: "ADMIN" },
      });
      const rep = await raw.user.create({
        data: { companyId: company.id, fullName: "Rep", role: "EXPEDITOR" },
      });
      const warehouse = await raw.user.create({
        data: {
          companyId: company.id,
          fullName: "Warehouse",
          role: "WAREHOUSE",
        },
      });
      const category = await raw.category.create({
        data: { companyId: company.id, name: "Products" },
      });
      const product = await raw.product.create({
        data: {
          companyId: company.id,
          name: "Product",
          categoryId: category.id,
          salePrice: 10,
        },
      });
      await raw.stock.create({
        data: { companyId: company.id, productId: product.id, quantity: 10 },
      });
      const customer = await raw.customer.create({
        data: {
          companyId: company.id,
          name: "Customer",
          assignedExpeditorId: rep.id,
        },
      });
      return {
        company,
        admin,
        rep,
        warehouse,
        product,
        category,
        customer,
        token: token(company, admin),
        repToken: token(company, rep),
        warehouseToken: token(company, warehouse),
        sale: (price = 10, gift = false) => ({
          customerId: customer.id,
          paymentType: "NAĞD",
          items: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: price,
              isGift: gift,
            },
          ],
        }),
      };
    }

    const stock = async (f) =>
      (await raw.stock.findUnique({ where: { productId: f.product.id } }))
        .quantity;
    function ok(response, status = 200) {
      assert.equal(response.status, status, JSON.stringify(response.body));
      return response.body;
    }
    await t.test(
      "invoice labels and amount survive customer, product, category, company and seller edits",
      async () => {
        const f = await fixture();
        const sale = ok(
          await api("/orders", "POST", f.sale(), f.token),
          201,
        ).order;
        await raw.customer.update({
          where: { id: f.customer.id },
          data: { name: "Changed customer", phone: "999" },
        });
        await raw.product.update({
          where: { id: f.product.id },
          data: { name: "Changed product", salePrice: 99, sku: "NEW" },
        });
        await raw.category.update({
          where: { id: f.category.id },
          data: { name: "Changed category" },
        });
        await raw.company.update({
          where: { id: f.company.id },
          data: { name: "Changed company" },
        });
        await raw.user.update({
          where: { id: f.admin.id },
          data: { fullName: "Changed seller" },
        });
        const saved = ok(
          await api("/orders/" + sale.id, "GET", null, f.token),
        ).order;
        assert.equal(saved.customer.name, "Customer");
        assert.equal(saved.items[0].product.name, "Product");
        assert.equal(saved.items[0].product.category.name, "Products");
        assert.equal(saved.items[0].product.sku, null);
        assert.equal(saved.createdBy.fullName, "Admin");
        assert.equal(saved.companySnapshot.name, "Group3");
        assert.equal(Number(saved.totalAmount), 10);
        assert.equal(saved.invoiceNumber, "00001");
      },
    );
    await t.test(
      "each company starts its own counter and replay consumes no number",
      async () => {
        const a = await fixture(),
          b = await fixture(),
          key = randomUUID();
        const first = ok(
          await api("/orders", "POST", a.sale(), a.token, {
            "Idempotency-Key": key,
          }),
          201,
        );
        const replay = ok(
          await api("/orders", "POST", a.sale(), a.token, {
            "Idempotency-Key": key,
          }),
        );
        assert.equal(replay.order.id, first.order.id);
        assert.equal(first.order.orderNumber, 1);
        assert.equal(
          ok(await api("/orders", "POST", b.sale(), b.token), 201).order
            .orderNumber,
          1,
        );
        assert.equal(
          ok(await api("/orders", "POST", a.sale(), a.token), 201).order
            .orderNumber,
          2,
        );
      },
    );
    await t.test(
      "sale and return ledger records carry actor, document, delta and balances",
      async () => {
        const f = await fixture();
        const order = ok(
          await api("/orders", "POST", f.sale(), f.token),
          201,
        ).order;
        ok(
          await api(
            "/returns",
            "POST",
            {
              customerId: f.customer.id,
              items: [{ productId: f.product.id, quantity: 1 }],
              note: "Damaged",
            },
            f.token,
          ),
          201,
        );
        const result = ok(
          await api(`/stock/${f.product.id}/movements`, "GET", null, f.token),
        );
        assert.equal(result.pagination.total, 2);
        const moves = [...result.movements].reverse();
        assert.deepEqual(
          moves.map((m) => [m.kind, m.before, m.delta, m.after]),
          [
            ["SALE", 10, -1, 9],
            ["RETURN", 9, 1, 10],
          ],
        );
        assert.equal(moves[0].userId, f.admin.id);
        assert.equal(moves[0].documentId, order.id);
        assert.equal(moves[1].reason, "Damaged");
      },
    );
    await t.test(
      "failed sale writes no invoice, counter, stock movement or orphan customer",
      async () => {
        const f = await fixture();
        const body = {
          ...f.sale(),
          items: [{ productId: f.product.id, quantity: 11, unitPrice: 10 }],
        };
        assert.equal((await api("/orders", "POST", body, f.token)).status, 409);
        assert.equal(
          await raw.stockMovement.count({ where: { companyId: f.company.id } }),
          0,
        );
        assert.equal(
          await raw.invoiceCounter.count({
            where: { companyId: f.company.id },
          }),
          0,
        );
        assert.equal(await stock(f), 10);
      },
    );
    await t.test(
      "count requires reason and version; retries are once; stale counts cannot overwrite a sale",
      async () => {
        const f = await fixture(),
          url = `/stock/${f.product.id}`,
          key = randomUUID(),
          body = { quantity: 12, expectedVersion: 0, reason: "Physical count" };
        assert.equal(
          (await api(url, "PATCH", { ...body, reason: "" }, f.token)).status,
          400,
        );
        assert.equal((await api(url, "PATCH", body, f.repToken)).status, 403);
        ok(await api(url, "PATCH", body, f.token, { "Idempotency-Key": key }));
        ok(await api(url, "PATCH", body, f.token, { "Idempotency-Key": key }));
        assert.equal(await stock(f), 12);
        assert.equal(
          await raw.stockMovement.count({ where: { companyId: f.company.id } }),
          1,
        );
        ok(await api("/orders", "POST", f.sale(), f.token), 201);
        assert.equal(
          (await api(url, "PATCH", { ...body, quantity: 20 }, f.token)).status,
          409,
        );
        assert.equal(await stock(f), 11);
      },
    );
    await t.test(
      "product opening balance and edits are atomic and tenant SKU/barcode unique",
      async () => {
        const f = await fixture(),
          body = {
            name: "Coded",
            categoryId: f.category.id,
            sku: "SKU-01",
            barcode: "000123",
            salePrice: "2.45",
            quantity: 4,
          };
        const p = ok(
          await api("/catalog/admin/products", "POST", body, f.token),
        ).product;
        assert.equal(p.stock.quantity, 4);
        assert.equal(
          (await raw.stockMovement.findFirst({ where: { productId: p.id } }))
            .kind,
          "OPENING",
        );
        assert.equal(
          (
            await api(
              "/catalog/admin/products",
              "POST",
              { ...body, name: "Duplicate" },
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          await raw.product.count({
            where: { companyId: f.company.id, name: "Duplicate" },
          }),
          0,
        );
        for (const search of ["SKU-01", "000123"]) {
          const list = ok(
            await api(
              "/catalog/products?search=" + search,
              "GET",
              null,
              f.token,
            ),
          );
          assert.equal(list.products[0].id, p.id);
        }
        const other = await fixture();
        assert.equal(
          (
            await api(
              `/catalog/admin/products/${p.id}`,
              "PATCH",
              { ...body, categoryId: other.category.id },
              f.token,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "archive requires zero stock, hides new-sale choices, preserves history, and restores",
      async () => {
        const f = await fixture();
        const sale = ok(
          await api(
            "/orders",
            "POST",
            {
              ...f.sale(),
              items: [{ productId: f.product.id, quantity: 10, unitPrice: 10 }],
            },
            f.token,
          ),
          201,
        ).order;
        ok(
          await api(
            `/catalog/admin/products/${f.product.id}`,
            "PATCH",
            { archived: true },
            f.token,
          ),
        );
        assert.equal(
          ok(await api("/catalog/products", "GET", null, f.token)).products
            .length,
          0,
        );
        assert.equal(
          (await api("/orders", "POST", f.sale(), f.token)).status,
          400,
        );
        assert.equal(
          ok(await api(`/orders/${sale.id}`, "GET", null, f.token)).order
            .items[0].product.name,
          "Product",
        );
        ok(
          await api(
            `/catalog/admin/products/${f.product.id}`,
            "PATCH",
            { archived: false },
            f.token,
          ),
        );
        assert.equal(
          ok(await api("/catalog/products", "GET", null, f.token)).products
            .length,
          1,
        );
        assert.equal(
          (
            await api(
              `/stock/${f.product.id}`,
              "PATCH",
              { quantity: 2, expectedVersion: 1, reason: "Count" },
              f.token,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await api(
              `/catalog/admin/products/${f.product.id}`,
              "PATCH",
              { archived: true },
              f.token,
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "returning archived goods restores visibility and stock",
      async () => {
        const f = await fixture();
        ok(
          await api(
            "/orders",
            "POST",
            {
              ...f.sale(),
              items: [{ productId: f.product.id, quantity: 10, unitPrice: 10 }],
            },
            f.token,
          ),
          201,
        );
        ok(
          await api(
            `/catalog/admin/products/${f.product.id}`,
            "PATCH",
            { archived: true },
            f.token,
          ),
        );
        ok(
          await api(
            "/returns",
            "POST",
            {
              customerId: f.customer.id,
              items: [{ productId: f.product.id, quantity: 1 }],
            },
            f.token,
          ),
          201,
        );
        assert.equal(
          (await raw.product.findUnique({ where: { id: f.product.id } }))
            .archivedAt,
          null,
        );
        assert.equal(await stock(f), 1);
      },
    );
    await t.test(
      "customer list is bounded and thin while summary and later history pages stay complete",
      async () => {
        const f = await fixture();
        for (let i = 0; i < 3; i++)
          ok(await api("/orders", "POST", f.sale(), f.token), 201);
        const list = ok(await api("/customers?limit=1", "GET", null, f.token));
        assert.equal(list.customers.length, 1);
        assert.equal(list.customers[0].orders, undefined);
        assert.equal(list.customers[0].summary.debt, 30);
        const detail = ok(
          await api(
            `/customers/${f.customer.id}?limit=1`,
            "GET",
            null,
            f.token,
          ),
        );
        assert.equal(detail.customer.orders.length, 1);
        assert.equal(detail.summary.ordersCount, 3);
        assert.equal(detail.summary.debt, 30);
        const second = ok(
          await api(
            `/customers/${f.customer.id}/orders?limit=1&page=2`,
            "GET",
            null,
            f.token,
          ),
        );
        assert.notEqual(second.orders[0].id, detail.customer.orders[0].id);
        assert.equal(second.pagination.total, 3);
        for (const query of ["page=0", "limit=1000", "page=nope"])
          assert.equal(
            (await api("/customers?" + query, "GET", null, f.token)).status,
            400,
          );
      },
    );
    await t.test(
      "returnable-products includes sales beyond the first history page and subtracts reservations",
      async () => {
        const f = await fixture();
        for (let i = 0; i < 3; i++)
          ok(await api("/orders", "POST", f.sale(), f.token), 201);
        ok(
          await api(
            "/payments",
            "POST",
            {
              customerId: f.customer.id,
              amount: 5,
              soldItems: [{ productId: f.product.id, quantity: 1 }],
            },
            f.token,
          ),
          201,
        );
        const result = ok(
          await api(
            `/customers/${f.customer.id}/returnable-products?limit=1`,
            "GET",
            null,
            f.token,
          ),
        );
        assert.equal(result.products[0].totalQty, 3);
        assert.equal(result.products[0].returnableQty, 2);
        assert.equal(result.summary.debt, 25);
      },
    );
    await t.test(
      "CSV product import is all-or-nothing and replay safe, with coded opening stock",
      async () => {
        const f = await fixture(),
          key = randomUUID(),
          rows = [
            {
              name: "Imported",
              category: "New category",
              sku: "CSV01",
              barcode: "00111",
              salePrice: "1.25",
              quantity: "4",
            },
          ];
        ok(
          await api("/records/imports/products", "POST", { rows }, f.token, {
            "Idempotency-Key": key,
          }),
          201,
        );
        const replay = ok(
          await api("/records/imports/products", "POST", { rows }, f.token, {
            "Idempotency-Key": key,
          }),
          201,
        );
        assert.equal(replay.replayed, true);
        assert.equal(
          await raw.product.count({
            where: { companyId: f.company.id, sku: "CSV01" },
          }),
          1,
        );
        assert.equal(
          (
            await api(
              "/records/imports/products",
              "POST",
              {
                rows: [
                  {
                    ...rows[0],
                    name: "Should rollback",
                    sku: "new",
                    barcode: "new",
                  },
                  rows[0],
                ],
              },
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          await raw.product.count({
            where: { companyId: f.company.id, name: "Should rollback" },
          }),
          0,
        );
        assert.equal(
          (
            await api(
              "/records/imports/products",
              "POST",
              { rows: [{ ...rows[0], quantity: "1.2" }] },
              f.token,
            )
          ).status,
          400,
        );
        assert.equal(
          (await api("/records/imports/products", "POST", { rows }, f.repToken))
            .status,
          403,
        );
      },
    );
    await t.test(
      "CSV customer validation and duplicates roll back the complete file",
      async () => {
        const f = await fixture();
        const rows = [
          {
            name: "Global name",
            phone: "+48123456789",
            salon: "Salon",
            address: "Street",
          },
        ];
        ok(
          await api("/records/imports/customers", "POST", { rows }, f.token),
          201,
        );
        assert.equal(
          (
            await api(
              "/records/imports/customers",
              "POST",
              { rows: [{ name: "Rollback customer" }, ...rows] },
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          await raw.customer.count({
            where: { companyId: f.company.id, name: "Rollback customer" },
          }),
          0,
        );
        assert.equal(
          (
            await api(
              "/records/imports/customers",
              "POST",
              { rows: [{ name: "Bad coordinates", lat: "999", lng: "2" }] },
              f.token,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "CSV export excludes another tenant and neutralizes formulas and quotes",
      async () => {
        const a = await fixture(),
          b = await fixture();
        await raw.customer.update({
          where: { id: a.customer.id },
          data: { name: '=HYPERLINK("evil")', phone: "+1234567" },
        });
        await raw.customer.update({
          where: { id: b.customer.id },
          data: { name: "Secret other tenant" },
        });
        const csv = ok(
          await api("/records/exports/customers", "GET", null, a.token),
        );
        assert.ok(csv.includes(`"'=HYPERLINK(""evil"")"`));
        assert.ok(csv.includes(`"'+1234567"`));
        assert.equal(csv.includes("Secret other tenant"), false);
        assert.equal(
          (await api("/records/exports/customers", "GET", null, a.repToken))
            .status,
          403,
        );
      },
    );
    await t.test(
      "foreign customer history, movements and counts are not accessible",
      async () => {
        const a = await fixture(),
          b = await fixture();
        for (const url of [
          `/stock/${b.product.id}/movements`,
          `/customers/${b.customer.id}/orders`,
          `/customers/${b.customer.id}/returnable-products`,
        ])
          assert.equal((await api(url, "GET", null, a.token)).status, 404);
      },
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    if (raw) await raw.$disconnect();
    if (wire) await wire.stop();
    await db.close();
    await fs.rm(uploads, { recursive: true, force: true });
  }
});
