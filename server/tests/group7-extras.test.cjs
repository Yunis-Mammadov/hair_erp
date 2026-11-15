const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Group 7: fractional stock, taxed invoices, statements, PDF, reminders and isolated demo", async (t) => {
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
      "202611130001_group7_extras",
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
    process.env.APP_URL = "https://audit-app.example.invalid";
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
          currencyConfigured: true,
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
    async function account(f) {
      return ok(
        await api(
          "/customers/" + f.customer.id + "/profile",
          "GET",
          null,
          f.token,
        ),
      ).summary;
    }
    async function createCredit(f) {
      ok(await api("/orders", "POST", f.sale(), f.token), 201);
      ok(
        await api(
          "/payments",
          "POST",
          { customerId: f.customer.id, amount: 10, paymentType: "CASH" },
          f.token,
        ),
        201,
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
      assert.equal((await account(f)).credit, 10);
    }

    const png = async (color) =>
      "data:image/png;base64," +
      (
        await require("sharp")({
          create: { width: 40, height: 15, channels: 4, background: color },
        })
          .png()
          .toBuffer()
      ).toString("base64");
    const Q = require("../src/quantity");
    async function kg(f) {
      await raw.product.update({
        where: { id: f.product.id },
        data: { unit: "KG" },
      });
    }
    await t.test(
      "KG purchase, sale, count and fractional reservations remain exact; pieces reject fractions",
      async () => {
        const f = await fixture();
        assert.equal(
          (
            await api(
              "/orders",
              "POST",
              {
                ...f.sale(),
                items: [
                  { productId: f.product.id, quantity: 0.125, unitPrice: 10 },
                ],
              },
              f.token,
            )
          ).status,
          400,
        );
        await kg(f);
        ok(
          await api(
            "/purchases",
            "POST",
            {
              items: [
                {
                  productId: f.product.id,
                  quantity: 0.125,
                  unitCost: 1,
                  salePrice: 10,
                },
              ],
            },
            f.token,
          ),
          201,
        );
        assert.equal(await stock(f), 10.125);
        const order = ok(
          await api(
            "/orders",
            "POST",
            {
              ...f.sale(),
              items: [
                { productId: f.product.id, quantity: 0.375, unitPrice: 10 },
              ],
            },
            f.token,
          ),
          201,
        ).order;
        assert.equal(Number(order.totalAmount), 3.75);
        assert.equal(await stock(f), 9.75);
        ok(
          await api(
            "/payments",
            "POST",
            {
              customerId: f.customer.id,
              amount: 1,
              soldItems: [{ productId: f.product.id, quantity: 0.125 }],
            },
            f.token,
          ),
          201,
        );
        assert.equal(
          (
            await api(
              "/returns",
              "POST",
              {
                customerId: f.customer.id,
                items: [{ productId: f.product.id, quantity: 0.251 }],
              },
              f.token,
            )
          ).status,
          409,
        );
        const ret = ok(
          await api(
            "/returns",
            "POST",
            {
              customerId: f.customer.id,
              items: [{ productId: f.product.id, quantity: 0.25 }],
            },
            f.token,
          ),
          201,
        );
        assert.equal(Number(ret.returnDoc.totalAmount), 2.5);
        assert.equal(await stock(f), 10);
        const current = await raw.stock.findUnique({
          where: { productId: f.product.id },
        });
        ok(
          await api(
            "/stock/" + f.product.id,
            "PATCH",
            {
              quantity: 10.333,
              expectedVersion: current.version,
              reason: "Fractional count",
            },
            f.token,
          ),
        );
        assert.equal(await stock(f), 10.333);
        assert.equal(
          (
            await api(
              "/catalog/admin/products/" + f.product.id,
              "PATCH",
              {
                name: f.product.name,
                categoryId: f.category.id,
                unit: "PIECE",
                salePrice: 10,
              },
              f.token,
            )
          ).status,
          409,
        );
        for (const q of [".5", "1e-3", "0.0001", "1x", null, -1])
          assert.equal(
            (
              await api(
                "/orders",
                "POST",
                {
                  ...f.sale(),
                  items: [
                    { productId: f.product.id, quantity: q, unitPrice: 10 },
                  ],
                },
                f.token,
              )
            ).status,
            400,
          );
      },
    );
    await t.test(
      "discount then tax reconciles across lines; partial returns restore original gross cents once",
      async () => {
        const f = await fixture();
        await kg(f);
        const key = randomUUID(),
          body = {
            ...f.sale(),
            discountPercent: 7.5,
            taxPercent: 18,
            items: [
              { productId: f.product.id, quantity: 0.333, unitPrice: 10 },
              { productId: f.product.id, quantity: 0.667, unitPrice: 10 },
            ],
          };
        const sale = ok(
          await api("/orders", "POST", body, f.token, {
            "Idempotency-Key": key,
          }),
          201,
        ).order;
        assert.equal(Number(sale.subtotalAmount), 10);
        assert.equal(Number(sale.discountAmount), 0.75);
        assert.equal(Number(sale.taxAmount), 1.67);
        assert.equal(Number(sale.totalAmount), 10.92);
        assert.equal(
          sale.items.reduce(
            (n, i) => n + Math.round(Number(i.lineTotalAmount) * 100),
            0,
          ),
          1092,
        );
        assert.equal(
          ok(
            await api("/orders", "POST", body, f.token, {
              "Idempotency-Key": key,
            }),
          ).replayed,
          true,
        );
        let returned = 0;
        for (const quantity of [0.111, 0.222, 0.123, 0.544]) {
          const result = ok(
            await api(
              "/returns",
              "POST",
              {
                customerId: f.customer.id,
                items: [{ productId: f.product.id, quantity }],
              },
              f.token,
            ),
            201,
          );
          returned += Math.round(Number(result.returnDoc.totalAmount) * 100);
        }
        const dashboard = ok(
          await api("/dashboard/stats", "GET", null, f.token),
        );
        assert.equal(dashboard.revenue.value, 10.92);
        assert.equal(returned, 1092);
        assert.equal(await stock(f), 10);
        const amounts = ok(
          await api(
            "/customers/" + f.customer.id + "/summary",
            "GET",
            null,
            f.token,
          ),
        ).summary;
        assert.equal(amounts.netTotal, 0);
        assert.equal(
          (
            await api(
              "/orders",
              "POST",
              { ...body, discountPercent: 101 },
              f.token,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await api(
              "/orders",
              "POST",
              { ...body, taxPercent: "1.001" },
              f.token,
            )
          ).status,
          400,
        );
        assert.equal(
          (await api("/orders", "POST", body, f.repToken)).status,
          403,
        );
      },
    );
    await t.test(
      "charged invoice edit retains rates and recalculates original line allocation",
      async () => {
        const f = await fixture();
        const sale = ok(
          await api(
            "/orders",
            "POST",
            { ...f.sale(), discountPercent: 10, taxPercent: 20 },
            f.token,
          ),
          201,
        ).order;
        const updated = ok(
          await api(
            "/orders/" + sale.id,
            "PUT",
            {
              items: [{ productId: f.product.id, quantity: 2, unitPrice: 10 }],
            },
            f.token,
          ),
        ).order;
        assert.equal(Number(updated.totalAmount), 21.6);
        assert.equal(Number(updated.items[0].lineTotalAmount), 21.6);
        const ret = ok(
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
        assert.equal(Number(ret.returnDoc.totalAmount), 10.8);
      },
    );
    await t.test(
      "aging boundaries use calendar days; paid and returned amounts leave the age buckets",
      async () => {
        const f = await fixture(),
          now = new Date("2026-11-13T12:00:00Z");
        const { runWithCompany } = require("../src/tenant-context"),
          { prisma } = require("../src/prismaClient"),
          S = require("../src/statements");
        for (const days of [0, 30, 31, 60, 61]) {
          const sale = ok(
            await api("/orders", "POST", f.sale(), f.token),
            201,
          ).order;
          await raw.order.update({
            where: { id: sale.id },
            data: { createdAt: new Date(+now - days * 86400000) },
          });
        }
        const req = { company: f.company, user: f.admin, query: {} };
        let aging = await runWithCompany(f.company.id, () =>
          S.aging(prisma, req, f.customer.id, now),
        );
        assert.equal(aging.days0to30, 20);
        assert.equal(aging.days31to60, 20);
        assert.equal(aging.days61plus, 10);
        ok(
          await api(
            "/payments",
            "POST",
            { customerId: f.customer.id, amount: 10 },
            f.token,
          ),
          201,
        );
        aging = await runWithCompany(f.company.id, () =>
          S.aging(prisma, req, f.customer.id, now),
        );
        assert.equal(aging.totalDebt, 40);
        assert.equal(aging.days61plus, 0);
        assert.equal(
          S.ageDays(
            "2026-10-14T20:30:00Z",
            "2026-11-13T19:30:00Z",
            "Asia/Baku",
          ),
          29,
        );
      },
    );
    await t.test(
      "statement includes payment void and refund events, period opening and full closing balances",
      async () => {
        const f = await fixture();
        const sale = ok(
          await api("/orders", "POST", f.sale(), f.token),
          201,
        ).order;
        await raw.order.update({
          where: { id: sale.id },
          data: { createdAt: new Date("2026-01-01T10:00:00Z") },
        });
        const pay = ok(
          await api(
            "/payments",
            "POST",
            { customerId: f.customer.id, amount: 4 },
            f.token,
          ),
          201,
        ).payment;
        await raw.payment.update({
          where: { id: pay.id },
          data: { createdAt: new Date("2026-02-01T10:00:00Z") },
        });
        ok(
          await api(
            "/payments/" + pay.id + "/void",
            "POST",
            { reason: "Correct payment" },
            f.token,
          ),
        );
        await raw.payment.update({
          where: { id: pay.id },
          data: { voidedAt: new Date("2026-03-01T10:00:00Z") },
        });
        const all = ok(
          await api(
            "/extras/customers/" + f.customer.id + "/statement",
            "GET",
            null,
            f.token,
          ),
        );
        assert.deepEqual(
          all.rows.map((r) => r.type),
          ["SALE", "PAYMENT", "PAYMENT_VOID"],
        );
        assert.equal(all.closingBalance, 10);
        assert.equal(all.summary.debt, 10);
        const filtered = ok(
          await api(
            "/extras/customers/" +
              f.customer.id +
              "/statement?startDate=2026-02-01&endDate=2026-02-28",
            "GET",
            null,
            f.token,
          ),
        );
        assert.equal(filtered.openingBalance, 10);
        assert.equal(filtered.closingBalance, 6);
        assert.equal(filtered.rows.length, 1);
        ok(
          await api(
            "/payments",
            "POST",
            { customerId: f.customer.id, amount: 10 },
            f.token,
          ),
          201,
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
        ok(
          await api(
            "/payments/refunds",
            "POST",
            {
              customerId: f.customer.id,
              amount: 3,
              note: "Customer credit refund",
            },
            f.token,
          ),
          201,
        );
        const end = ok(
          await api(
            "/extras/customers/" + f.customer.id + "/statement",
            "GET",
            null,
            f.token,
          ),
        );
        assert.equal(end.closingBalance, -7);
        assert.equal(end.summary.credit, 7);
        assert.equal(end.rows.at(-1).type, "REFUND");
        const csv = await api(
          "/extras/customers/" + f.customer.id + "/statement.csv",
          "GET",
          null,
          f.token,
        );
        assert.equal(csv.status, 200);
        assert.match(csv.body, /CLOSING/);
      },
    );
    await t.test(
      "statements, aging, invoice PDFs and reminder contacts respect tenant, assignment and role boundaries",
      async () => {
        const f = await fixture("BUSINESS"),
          other = await fixture();
        const sale = ok(
          await api("/orders", "POST", f.sale(), f.token),
          201,
        ).order;
        for (const url of [
          "/extras/customers/" + f.customer.id + "/statement",
          "/extras/customers/" + f.customer.id + "/statement.csv",
          "/extras/customers/" + f.customer.id + "/statement.pdf",
          "/extras/invoices/" + sale.id + ".pdf",
        ])
          assert.equal((await api(url, "GET", null, other.token)).status, 404);
        assert.equal(
          (await api("/extras/aging", "GET", null, f.repToken)).status,
          403,
        );
        assert.equal(
          (
            await api(
              "/extras/customers/" + f.customer.id + "/statement",
              "GET",
              null,
              f.warehouseToken,
            )
          ).status,
          403,
        );
        ok(
          await api(
            "/extras/customers/" + f.customer.id + "/statement",
            "GET",
            null,
            f.repToken,
          ),
        );
        await raw.customer.update({
          where: { id: f.customer.id },
          data: { assignedExpeditorId: null },
        });
        assert.equal(
          (
            await api(
              "/extras/customers/" + f.customer.id + "/statement",
              "GET",
              null,
              f.repToken,
            )
          ).status,
          404,
        );
        const pdf = await fetch(
          base + "/api/extras/invoices/" + sale.id + ".pdf",
          { headers: { Authorization: "Bearer " + f.token } },
        );
        assert.equal(pdf.status, 200);
        assert.equal(pdf.headers.get("content-type"), "application/pdf");
        assert.equal(
          Buffer.from(await pdf.arrayBuffer())
            .subarray(0, 4)
            .toString(),
          "%PDF",
        );
      },
    );
    await t.test(
      "SMTP disabled refuses sends; consent and recipient edits cannot bypass validation",
      async () => {
        const f = await fixture();
        ok(await api("/orders", "POST", f.sale(), f.token), 201);
        assert.equal(
          (
            await api(
              "/extras/customers/" + f.customer.id + "/reminder-preview",
              "GET",
              null,
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await api(
              "/customers/" + f.customer.id,
              "PUT",
              { email: "bad\r\nBcc:x@test.com", reminderOptIn: true },
              f.token,
            )
          ).status,
          400,
        );
        ok(
          await api(
            "/customers/" + f.customer.id,
            "PUT",
            { email: "client@example.com", reminderOptIn: true },
            f.token,
          ),
        );
        const preview = ok(
          await api(
            "/extras/customers/" +
              f.customer.id +
              "/reminder-preview?locale=ru",
            "GET",
            null,
            f.token,
          ),
        );
        assert.match(preview.subject, /Напоминание/);
        assert.equal(
          (
            await api(
              "/extras/customers/" + f.customer.id + "/reminders",
              "POST",
              { recipient: preview.recipient, debt: preview.debt },
              f.token,
            )
          ).status,
          503,
        );
        ok(
          await api(
            "/customers/" + f.customer.id,
            "PUT",
            { email: "other@example.com" },
            f.token,
          ),
        );
        assert.equal(
          (await raw.customer.findUnique({ where: { id: f.customer.id } }))
            .reminderOptIn,
          false,
        );
      },
    );
    await t.test(
      "queued reminders are idempotent and rate limited; SMTP unknown outcomes never auto-retry",
      async () => {
        const f = await fixture(),
          M = require("../src/reminders");
        ok(await api("/orders", "POST", f.sale(), f.token), 201);
        ok(
          await api(
            "/customers/" + f.customer.id,
            "PUT",
            { email: "client@example.com", reminderOptIn: true },
            f.token,
          ),
        );
        Object.assign(process.env, {
          REMINDERS_ENABLED: "true",
          SMTP_HOST: "smtp.example.invalid",
          SMTP_FROM: "sender@example.com",
          SMTP_USER: "fixture",
          SMTP_PASSWORD: "fixture",
        });
        const body = { recipient: "client@example.com", debt: 10 },
          key = randomUUID(),
          url = "/extras/customers/" + f.customer.id + "/reminders";
        const queued = ok(
          await api(url, "POST", body, f.token, { "Idempotency-Key": key }),
          201,
        );
        assert.equal(queued.job.state, "PENDING");
        assert.equal(
          ok(await api(url, "POST", body, f.token, { "Idempotency-Key": key }))
            .replayed,
          true,
        );
        assert.equal((await api(url, "POST", body, f.token)).status, 429);
        let calls = 0;
        await M.processOne(raw, async (mail) => {
          calls++;
          assert.equal(mail.to, "client@example.com");
          throw Object.assign(Error("Socket timed out"), { code: "ETIMEDOUT" });
        });
        assert.equal(calls, 1);
        assert.equal(
          (
            await raw.reminderOutbox.findUnique({
              where: { id: queued.job.id },
            })
          ).state,
          "UNKNOWN",
        );
        assert.equal(
          await M.processOne(raw, async () => {
            calls++;
          }),
          false,
        );
        assert.equal(calls, 1);
        delete process.env.REMINDERS_ENABLED;
      },
    );
    await t.test(
      "worker cancels withdrawn consent and stale debt; a valid message sends once",
      async () => {
        const f = await fixture(),
          M = require("../src/reminders");
        ok(await api("/orders", "POST", f.sale(), f.token), 201);
        await raw.customer.update({
          where: { id: f.customer.id },
          data: {
            email: "client@example.com",
            reminderOptIn: true,
            reminderConsentAt: new Date(),
          },
        });
        async function job() {
          return raw.reminderOutbox.create({
            data: {
              companyId: f.company.id,
              customerId: f.customer.id,
              recipient: "client@example.com",
              locale: "en",
              debtCents: 1000n,
              subject: "Test",
              body: "Reminder",
            },
          });
        }
        let j = await job(),
          calls = 0;
        await raw.customer.update({
          where: { id: f.customer.id },
          data: { reminderOptIn: false },
        });
        await M.processOne(raw, async () => {
          calls++;
        });
        assert.equal(
          (await raw.reminderOutbox.findUnique({ where: { id: j.id } })).state,
          "CANCELED",
        );
        await raw.customer.update({
          where: { id: f.customer.id },
          data: { reminderOptIn: true },
        });
        j = await job();
        ok(
          await api(
            "/payments",
            "POST",
            { customerId: f.customer.id, amount: 1 },
            f.token,
          ),
          201,
        );
        await M.processOne(raw, async () => {
          calls++;
        });
        assert.equal(
          (await raw.reminderOutbox.findUnique({ where: { id: j.id } })).state,
          "STALE",
        );
        j = await raw.reminderOutbox.create({
          data: {
            companyId: f.company.id,
            customerId: f.customer.id,
            recipient: "client@example.com",
            locale: "en",
            debtCents: 900n,
            subject: "Test",
            body: "Reminder",
          },
        });
        await M.processOne(raw, async () => {
          calls++;
          return { messageId: "test@example.com" };
        });
        assert.equal(calls, 1);
        assert.equal(
          (await raw.reminderOutbox.findUnique({ where: { id: j.id } })).state,
          "SENT",
        );
        assert.equal(
          await M.processOne(raw, async () => {
            calls++;
          }),
          false,
        );
        assert.equal(calls, 1);
      },
    );
    await t.test(
      "demo provisioning creates a separate seven-day tenant and never resets real data",
      async () => {
        const f = await fixture(),
          before = await stock(f),
          { createDemo } = require("../scripts/demo.cjs");
        const input = {
            email: randomUUID() + "@demo.invalid",
            password: "demo-only-password-123",
            pin: "8642",
          },
          demo = await createDemo(raw, input);
        assert.equal(demo.isDemo, true);
        assert.ok(+new Date(demo.expiresAt) > Date.now() + 6 * 86400000);
        assert.equal(await stock(f), before);
        const company = await raw.company.findUnique({
            where: { id: demo.id },
          }),
          admin = await raw.user.findFirst({
            where: { companyId: demo.id, role: "ADMIN" },
          }),
          demoToken = token(company, admin);
        assert.equal(
          (
            await api(
              "/extras/customers/" + f.customer.id + "/statement",
              "GET",
              null,
              demoToken,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await api(
              "/billing/checkout",
              "POST",
              { cycle: "MONTHLY", email: "client@example.com" },
              demoToken,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await api(
              "/extras/customers/x/reminders",
              "POST",
              { recipient: "client@example.com", debt: 1 },
              demoToken,
            )
          ).status,
          403,
        );
        await assert.rejects(() => createDemo(raw, input), /never overwrites/);
        assert.equal(
          await raw.company.count({ where: { loginEmail: input.email } }),
          1,
        );
        assert.equal(await stock(f), before);
      },
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (raw) await raw.$disconnect();
    if (wire) await wire.stop();
    await db.close();
    await fs.rm(uploads, { recursive: true, force: true });
  }
});
