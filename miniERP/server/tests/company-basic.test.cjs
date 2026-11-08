const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const bcrypt = require("bcrypt");

test("Existing ERP: migration, company/PIN login, tenant isolation and Basic restrictions", async (t) => {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    readFileSync(path.join(__dirname, "fixtures/legacy-schema.sql"), "utf8"),
  );
  const hash = await bcrypt.hash("1234", 4);
  await db.query(
    'INSERT INTO "User" (id, "fullName", "pinHash", role, "updatedAt") VALUES ($1,$2,$3,\'ADMIN\',CURRENT_TIMESTAMP)',
    ["legacy-admin", "Legacy Admin", hash],
  );
  await db.query(
    'INSERT INTO "Category" (id, name, "updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)',
    ["legacy-category", "Legacy Category"],
  );
  await db.query(
    'INSERT INTO "Product" (id, name, "categoryId", "updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)',
    ["legacy-product", "Legacy Product", "legacy-category"],
  );
  await db.query(
    'INSERT INTO "Stock" ("productId", quantity, "updatedAt") VALUES ($1,17,CURRENT_TIMESTAMP)',
    ["legacy-product"],
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
  const wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await wire.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${wire.getServerConn().split(":")[1]}/postgres?connection_limit=1`;
  process.env.JWT_SECRET = "integration-only-secret-at-least-32-bytes";
  const { app } = require("../src/index");
  const { platformPrisma: raw, prisma } = require("../src/prismaClient");
  const { runWithCompany } = require("../src/tenant-context");
  const { signToken } = require("../src/auth-security");
  const { PRICES } = require("../src/config/plans");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const password = "IntegrationPassword123!";
  const passwordHash = await bcrypt.hash(password, 4);
  const future = new Date(Date.now() + 86400000);
  let a,
    b,
    adminA,
    adminB,
    tokenA,
    tokenB,
    challengeA,
    productB,
    customerA,
    orderA,
    imagePath;
  async function call(url, method = "GET", body, token) {
    const response = await fetch(base + url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: (response.headers.get("content-type") || "").includes("json")
        ? await response.json()
        : await response.text(),
    };
  }
  async function companyLogin(company) {
    const result = await call("/api/auth/company-login", "POST", {
      email: company.loginEmail,
      password,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.loginToken;
  }
  async function pinLogin(challenge, pin = "1234") {
    const result = await call(
      "/api/auth/pin-login",
      "POST",
      { pin },
      challenge,
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.token;
  }
  try {
    await t.test("migration retains original IDs, PIN and stock", async () => {
      const user = await raw.user.findUnique({ where: { id: "legacy-admin" } });
      assert.equal(user.companyId, "legacy-company");
      assert.equal(await bcrypt.compare("1234", user.pinHash), true);
      assert.equal(
        (await raw.stock.findUnique({ where: { productId: "legacy-product" } }))
          .quantity,
        17,
      );
      assert.equal(
        (await raw.company.findUnique({ where: { id: "legacy-company" } }))
          .plan,
        "BASIC",
      );
    });
    await t.test(
      "set up two separate companies, including Global Basic",
      async () => {
        a = await raw.company.update({
          where: { id: "legacy-company" },
          data: {
            loginEmail: "a@zindex.invalid",
            passwordHash,
            isActive: true,
            endsAt: future,
          },
        });
        adminA = await raw.user.findUnique({ where: { id: "legacy-admin" } });
        b = await raw.company.create({
          data: {
            name: "Global B",
            loginEmail: "b@zindex.invalid",
            passwordHash,
            isActive: true,
            endsAt: future,
            market: "GLOBAL",
            currency: "USD",
            locale: "en",
          },
        });
        adminB = await raw.user.create({
          data: {
            companyId: b.id,
            fullName: "B Admin",
            role: "ADMIN",
            pinHash: hash,
          },
        });
        const cat = await raw.category.create({
          data: { companyId: b.id, name: "Legacy Category" },
        });
        productB = await raw.product.create({
          data: { companyId: b.id, categoryId: cat.id, name: "B Product" },
        });
        assert.equal(PRICES.AZ.PREMIUM.YEARLY, 250000);
        assert.equal(PRICES.GLOBAL.BASIC.MONTHLY, 999);
        assert.equal(PRICES.GLOBAL.BASIC.YEARLY, 9999);
      },
    );
    await t.test(
      "PIN-only and old tokens no longer access the API",
      async () => {
        assert.equal(
          (await call("/api/auth/pin-login", "POST", { pin: "1234" })).status,
          401,
        );
        assert.equal((await call("/api/stock")).status, 401);
        const jwt = require("jsonwebtoken");
        const old = jwt.sign(
          { userId: adminA.id, role: "ADMIN" },
          process.env.JWT_SECRET,
        );
        assert.equal(
          (await call("/api/stock", "GET", undefined, old)).status,
          401,
        );
        assert.equal(
          (await call("/api/auth/setup-admin", "POST", {})).status,
          410,
        );
      },
    );
    await t.test(
      "company password precedes PIN and challenges cannot access data",
      async () => {
        assert.equal(
          (
            await call("/api/auth/company-login", "POST", {
              email: a.loginEmail,
              password: "wrong",
            })
          ).status,
          401,
        );
        challengeA = await companyLogin(a);
        assert.equal(
          (await call("/api/stock", "GET", undefined, challengeA)).status,
          401,
        );
        tokenA = await pinLogin(challengeA);
        tokenB = await pinLogin(await companyLogin(b));
        const meA = await call("/api/auth/me", "GET", undefined, tokenA);
        assert.equal(meA.body.role, "ADMIN");
        assert.equal(meA.body.company.plan, "BASIC");
        assert.equal(meA.body.company.limits.maxUsers, 3);
        assert.equal(meA.body.company.features.includes("delivery"), false);
        assert.equal(meA.body.company.passwordHash, undefined);
        assert.equal(
          (await call("/api/auth/me", "GET", undefined, tokenB)).body.company
            .id,
          b.id,
        );
      },
    );
    await t.test(
      "same PIN identifies a different worker in each company",
      async () => {
        const m1 = await call("/api/auth/me", "GET", undefined, tokenA);
        const m2 = await call("/api/auth/me", "GET", undefined, tokenB);
        assert.equal(m1.body.id, adminA.id);
        assert.equal(m2.body.id, adminB.id);
      },
    );
    await t.test(
      "scoped read, count, aggregate and raw-query denial",
      async () => {
        await runWithCompany(a.id, async () => {
          assert.equal(await prisma.product.count(), 1);
          assert.equal(
            (await prisma.product.aggregate({ _count: true }))._count,
            1,
          );
          assert.equal(
            await prisma.product.findUnique({ where: { id: productB.id } }),
            null,
          );
          await assert.rejects(prisma.$queryRaw`SELECT 1`);
        });
        await assert.rejects(prisma.product.findMany());
        const stock = await call("/api/stock", "GET", undefined, tokenA);
        assert.equal(stock.status, 200, JSON.stringify(stock.body));
        assert.equal(stock.body.items[0].productId, "legacy-product");
        assert.equal(
          (await call("/api/stock", "GET", undefined, tokenB)).body.items[0]
            .productId,
          productB.id,
        );
      },
    );
    await t.test(
      "foreign IDs fail on update and on database relationships",
      async () => {
        assert.equal(
          (
            await call(
              `/api/stock/${productB.id}`,
              "PATCH",
              { quantity: 3 },
              tokenA,
            )
          ).status,
          404,
        );
        await assert.rejects(
          raw.product.create({
            data: {
              companyId: a.id,
              name: "Bad",
              categoryId: productB.categoryId,
            },
          }),
          (error) => error.code === "P2003",
        );
        await runWithCompany(a.id, async () => {
          await assert.rejects(
            prisma.product.update({
              where: { id: productB.id },
              data: { name: "Changed" },
            }),
            (error) => error.code === "P2025",
          );
          await assert.rejects(
            prisma.product.update({
              where: { id: "legacy-product" },
              data: { category: { connect: { id: productB.categoryId } } },
            }),
          );
          await assert.rejects(
            prisma.product.update({
              where: { id: "legacy-product" },
              data: { companyId: b.id },
            }),
          );
        });
        assert.equal(
          (await raw.product.findUnique({ where: { id: productB.id } })).name,
          "B Product",
        );
      },
    );
    await t.test(
      "Basic blocks premium API including signature shortcuts",
      async () => {
        for (const url of [
          "/api/delivery",
          "/api/live-location",
          "/api/orders/any/signature",
          "/api/orders/any/seller-signature",
        ]) {
          const result = await call(
            url,
            url.includes("signature") ? "POST" : "GET",
            url.includes("signature") ? { signature: "x" } : undefined,
            tokenA,
          );
          assert.equal(result.status, 403, url);
        }
        assert.equal(
          (
            await call(
              "/api/areas",
              "POST",
              { name: "Advanced", routeDay: 1 },
              tokenA,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Basic creates customer and sales with tenant-inherited nested items",
      async () => {
        const area = await call("/api/areas", "POST", { name: "Bakı" }, tokenA);
        assert.equal(area.status, 201, JSON.stringify(area.body));
        const result = await call(
          "/api/customers",
          "POST",
          {
            name: "Customer A",
            phone: "+994501234567",
            salon: "Salon A",
            address: "Street",
            lat: 40.4,
            lng: 49.8,
            areaId: area.body.area.id,
          },
          tokenA,
        );
        assert.equal(result.status, 201, JSON.stringify(result.body));
        customerA = result.body.customer;
        assert.equal(customerA.assignedExpeditorId, null);
        const sale = await call(
          "/api/orders",
          "POST",
          {
            customerId: customerA.id,
            paymentType: "NAĞD",
            items: [
              { productId: "legacy-product", quantity: 2, unitPrice: 12.5 },
            ],
          },
          tokenA,
        );
        assert.equal(sale.status, 201, JSON.stringify(sale.body));
        orderA = sale.body.order;
        assert.equal(orderA.items[0].companyId, a.id);
        assert.equal(
          (
            await raw.stock.findUnique({
              where: { productId: "legacy-product" },
            })
          ).quantity,
          15,
        );
        assert.equal(
          (await call(`/api/orders/${orderA.id}`, "GET", undefined, tokenB))
            .status,
          404,
        );
        const orders = await call("/api/orders", "GET", undefined, tokenA);
        assert.equal(orders.status, 200, JSON.stringify(orders.body));
        assert.equal(orders.body.pagination.total, 1);
      },
    );
    await t.test(
      "sale edit uses scoped createMany and correct stock",
      async () => {
        const edited = await call(
          `/api/orders/${orderA.id}`,
          "PUT",
          {
            items: [
              { productId: "legacy-product", quantity: 1, unitPrice: 12.5 },
            ],
          },
          tokenA,
        );
        assert.equal(edited.status, 200, JSON.stringify(edited.body));
        assert.equal(
          (
            await raw.stock.findUnique({
              where: { productId: "legacy-product" },
            })
          ).quantity,
          16,
        );
      },
    );
    await t.test(
      "payment and return nested data stay within the company",
      async () => {
        const pay = await call(
          "/api/payments",
          "POST",
          { customerId: customerA.id, amount: 5 },
          tokenA,
        );
        assert.equal(pay.status, 201, JSON.stringify(pay.body));
        assert.equal(
          (
            await call(
              `/api/customers/${customerA.id}`,
              "GET",
              undefined,
              tokenB,
            )
          ).status,
          404,
        );
        const returned = await call(
          "/api/returns",
          "POST",
          {
            customerId: customerA.id,
            items: [{ productId: "legacy-product", quantity: 1 }],
          },
          tokenA,
        );
        assert.equal(returned.status, 201, JSON.stringify(returned.body));
        assert.equal(returned.body.returnDoc.companyId, a.id);
        assert.equal(
          (
            await raw.stock.findUnique({
              where: { productId: "legacy-product" },
            })
          ).quantity,
          17,
        );
      },
    );
    await t.test(
      "purchase and payment children inherit company ownership",
      async () => {
        await runWithCompany(a.id, async () => {
          const purchase = await prisma.purchase.create({
            data: {
              createdById: adminA.id,
              supplier: "Supplier",
              items: {
                create: [
                  { productId: "legacy-product", quantity: 2, unitCost: 3 },
                ],
              },
            },
            include: { items: true },
          });
          assert.equal(purchase.items[0].companyId, a.id);
          const payment = await prisma.payment.create({
            data: {
              customerId: customerA.id,
              createdById: adminA.id,
              amount: 1,
              soldItems: {
                create: [{ productId: "legacy-product", quantity: 1 }],
              },
            },
            include: { soldItems: true },
          });
          assert.equal(payment.soldItems[0].companyId, a.id);
        });
      },
    );
    await t.test("existing inline receipt photos remain visible", async () => {
      const imageUrl = "data:image/png;base64,iVBORw0KGgo=";
      const payment = await raw.payment.create({
        data: {
          companyId: a.id,
          customerId: customerA.id,
          amount: 1,
          imageUrl,
        },
      });
      const result = await call("/api/payments", "GET", undefined, tokenA);
      assert.equal(result.status, 200);
      assert.equal(
        result.body.payments.find((entry) => entry.id === payment.id).imageUrl,
        imageUrl,
      );
    });
    await t.test(
      "duplicate PIN, DRIVER role and fourth active user are refused",
      async () => {
        assert.equal(
          (
            await call(
              "/api/users",
              "POST",
              { fullName: "Duplicate", pin: "1234", role: "EXPEDITOR" },
              tokenA,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              "/api/users",
              "POST",
              { fullName: "Driver", pin: "5678", role: "DRIVER" },
              tokenA,
            )
          ).status,
          403,
        );
        for (const [name, pin, role] of [
          ["Sales", "5678", "EXPEDITOR"],
          ["Warehouse", "9012", "WAREHOUSE"],
        ]) {
          const user = await call(
            "/api/users",
            "POST",
            { fullName: name, pin, role },
            tokenA,
          );
          assert.equal(user.status, 201, JSON.stringify(user.body));
        }
        assert.equal(
          (
            await call(
              "/api/users",
              "POST",
              { fullName: "Fourth", pin: "3456", role: "ADMIN" },
              tokenA,
            )
          ).status,
          409,
        );
        const expToken = await pinLogin(await companyLogin(a), "5678");
        assert.equal(
          (await call("/api/customers", "GET", undefined, expToken)).body
            .customers.length,
          1,
        );
        assert.equal(
          (
            await call(
              "/api/users",
              "POST",
              { fullName: "No", pin: "3456", role: "ADMIN" },
              expToken,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call("/api/customers", "GET", undefined, expToken)).status,
          200,
        );
        assert.equal(
          (
            await call(
              `/api/customers/${customerA.id}`,
              "PUT",
              { assignedExpeditorId: adminA.id },
              tokenA,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "plan changes apply to existing session and deactivation revokes it",
      async () => {
        await raw.company.update({
          where: { id: a.id },
          data: { plan: "PREMIUM" },
        });
        assert.equal(
          (
            await call("/api/auth/me", "GET", undefined, tokenA)
          ).body.company.features.includes("delivery"),
          true,
        );
        await raw.company.update({
          where: { id: a.id },
          data: { plan: "BASIC" },
        });
        assert.equal(
          (await call("/api/delivery", "GET", undefined, tokenA)).status,
          403,
        );
        await raw.user.update({
          where: { id: adminB.id },
          data: { isActive: false },
        });
        assert.equal(
          (await call("/api/stock", "GET", undefined, tokenB)).status,
          401,
        );
        await raw.user.update({
          where: { id: adminB.id },
          data: { isActive: true },
        });
      },
    );
    await t.test(
      "private images are signed, scoped and version checked",
      async () => {
        const form = new FormData();
        form.set(
          "file",
          new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
            type: "image/png",
          }),
          "receipt.png",
        );
        const uploaded = await fetch(base + "/api/uploads", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenA}` },
          body: form,
        });
        assert.equal(uploaded.status, 201);
        const data = await uploaded.json();
        const url = new URL(data.file.url);
        imagePath = path.join(__dirname, "../src/uploads", a.id);
        assert.equal((await call(url.pathname)).status, 401);
        assert.equal((await call(url.pathname + url.search)).status, 200);
        const bad = await call(
          "/api/payments",
          "POST",
          {
            customerId: customerA.id,
            amount: 1,
            imageUrl: `/uploads/${b.id}/receipt.png`,
          },
          tokenA,
        );
        assert.equal(bad.status, 400);
        const tokenPath = signToken(
          {
            companyId: b.id,
            userId: adminB.id,
            companyVersion: b.authVersion,
            userVersion: adminB.authVersion,
            pathname: url.pathname,
          },
          "upload",
          "1h",
        );
        assert.equal(
          (await call(url.pathname + "?token=" + tokenPath)).status,
          401,
        );
        await raw.company.update({
          where: { id: a.id },
          data: { authVersion: { increment: 1 } },
        });
        assert.equal((await call(url.pathname + url.search)).status, 401);
        assert.equal(
          (await call("/api/stock", "GET", undefined, tokenA)).status,
          401,
        );
      },
    );
    await t.test(
      "concurrent request contexts and failed transactions remain isolated",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, index) =>
            runWithCompany(index % 2 ? b.id : a.id, async () => {
              await new Promise((resolve) => setTimeout(resolve, index % 3));
              const products = await prisma.product.findMany();
              return products.every(
                (product) => product.companyId === (index % 2 ? b.id : a.id),
              );
            }),
          ),
        );
        assert.ok(results.every(Boolean));
        await runWithCompany(a.id, async () => {
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.stock.update({
                where: { productId: "legacy-product" },
                data: { quantity: { decrement: 1 } },
              });
              await tx.order.create({
                data: {
                  customerId: customerA.id,
                  createdById: adminA.id,
                  paymentType: "NAĞD",
                  items: {
                    create: [
                      { productId: productB.id, quantity: 1, unitPrice: 1 },
                    ],
                  },
                },
              });
            }),
          );
        });
        assert.equal(
          (
            await raw.stock.findUnique({
              where: { productId: "legacy-product" },
            })
          ).quantity,
          17,
        );
        assert.equal(await raw.order.count({ where: { companyId: a.id } }), 1);
      },
    );
    await t.test(
      "management commands provision credentials and Global Basic pricing",
      async () => {
        const { promisify } = require("node:util");
        const { execFile } = require("node:child_process");
        const runProcess = promisify(execFile);
        const exec = async (...args) => {
          // PGlite's wire adapter shares one backend across connections.
          await raw.$disconnect();
          await db.exec("DEALLOCATE ALL");
          try {
            return await runProcess(...args);
          } finally {
            await db.exec("DEALLOCATE ALL");
          }
        };
        await raw.$disconnect();
        const result = await exec(
          process.execPath,
          [path.join(__dirname, "../scripts/company.cjs"), "create"],
          {
            cwd: path.join(__dirname, ".."),
            env: {
              ...process.env,
              COMPANY_NAME: "CLI Global",
              COMPANY_LOGIN_EMAIL: "cli@zindex.invalid",
              COMPANY_LOGIN_PASSWORD: password,
              COMPANY_ADMIN_PIN: "4321",
              COMPANY_PLAN: "BASIC",
              COMPANY_MARKET: "GLOBAL",
              COMPANY_BILLING_CYCLE: "YEARLY",
            },
          },
        );
        assert.ok(result.stdout.includes('"amountMinor": 9999'));
        const created = await raw.company.findUnique({
          where: { loginEmail: "cli@zindex.invalid" },
        });
        assert.equal(created.currency, "USD");
        assert.equal(
          await bcrypt.compare(password, created.passwordHash),
          true,
        );
        const admins = await raw.user.findMany({
          where: { companyId: created.id },
        });
        assert.equal(admins.length, 1);
        assert.equal(admins[0].role, "ADMIN");
        await raw.$disconnect();
        const setup = await exec(
          process.execPath,
          [path.join(__dirname, "../scripts/company.cjs"), "setup"],
          {
            cwd: path.join(__dirname, ".."),
            env: {
              ...process.env,
              COMPANY_ID: a.id,
              COMPANY_NAME: "Existing A",
              COMPANY_LOGIN_EMAIL: a.loginEmail,
              COMPANY_LOGIN_PASSWORD: password,
              COMPANY_PLAN: "BASIC",
            },
          },
        );
        assert.ok(setup.stdout.includes('"plan": "BASIC"'));
        assert.equal(
          (
            await raw.stock.findUnique({
              where: { productId: "legacy-product" },
            })
          ).quantity,
          17,
        );
        assert.equal(await raw.order.count({ where: { companyId: a.id } }), 1);
      },
    );
    await t.test(
      "expired company and per-company PIN attempt limits",
      async () => {
        const challenge = await companyLogin(b);
        for (let i = 0; i < 12; i++) {
          assert.equal(
            (
              await call(
                "/api/auth/pin-login",
                "POST",
                { pin: "1234" },
                challenge,
              )
            ).status,
            200,
          );
        }
        for (let i = 0; i < 10; i++)
          await call("/api/auth/pin-login", "POST", { pin: "0000" }, challenge);
        const limited = await call(
          "/api/auth/pin-login",
          "POST",
          { pin: "0000" },
          challenge,
        );
        assert.equal(limited.status, 429);
        assert.ok(limited.headers.get("retry-after"));
        await raw.company.update({
          where: { id: b.id },
          data: { endsAt: new Date(0) },
        });
        assert.equal(
          (
            await call("/api/auth/company-login", "POST", {
              email: b.loginEmail,
              password,
            })
          ).status,
          403,
        );
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await raw.$disconnect();
    await wire.stop();
    await db.close();
    if (imagePath) rmSync(imagePath, { recursive: true, force: true });
  }
});