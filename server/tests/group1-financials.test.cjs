const {readFileSync}=require("node:fs");
const { test } = require("node:test");
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const requireServer = createRequire(path.resolve(__dirname, "../package.json"));
const { PGlite } = requireServer("@electric-sql/pglite");
const { PGLiteSocketServer } = requireServer("@electric-sql/pglite-socket");
const bcrypt = requireServer("bcrypt");
const assert = require("node:assert/strict");
const results = [];
const ownedCompanies = [];
const expected = {
  A01: (o) => o.actual === 401,
  A02: (o) => o.statusCode === 201 && o.quantity === 5,
  A03: (o) => o.statusCode === 201 && o.quantity === 3,
  A04: (o) => o.statusCode === 409 && o.quantity === 1 && o.orders === 0,
  A05: (o) => o.statusCode === 409 && o.quantity === 3,
  A06: (o) => o.statusCode === 400,
  A07: (o) => o.statusCode === 400,
  A08: (o) => o.statusCode === 400,
  A09: (o) => o.orders === 1 && o.quantity === 8 && o.statuses[1] === 200,
  A10: (o) => o.statusCode === 403,
  A11: (o) => o.statusCode === 409 && Number(o.summary.paymentTotal) === 0,
  A12: (o) => o.count === 1 && Number(o.total) === 5,
  A13: (o) => o.statusCode === 400,
  A14: (o) => o.statusCode === 400,
  A15: (o) => o.statusCode === 400 && o.quantity === 20,
  A16: (o) => o.statusCode === 409,
  A17: (o) => o.statusCode === 201 && o.quantity === 9,
  A18: (o) => o.statusCode === 409 && o.quantity === 10,
  A19: (o) =>
    o.statusCode === 409 && o.returnedQuantity === 0 && o.finalStock === 8,
  A20: (o) => o.isProblematic === false,
  A21: (o) => o.statusCode === 200 && o.stockAuditTables.length === 1,
  A22: (o) => o.statusCode === 404 && o.paymentsCreated === 0,
  A23: (o) => o.statusCode === 400 && o.foreignStock === 20,
  A24: (o) => o.statusCode === 403,
  A25: (o) => o.statusCode === 403,
  A26: (o) => o.statusCode === 403,
  A27: (o) => o.statusCode === 400 && !o.productExists,
  A28: (o) => o.statusCode === 400,
  A29: (o) => o.statusCode === 400,
  A30: (o) => o.configuredMonthly === 14.99 && o.configuredYearly === 149.99,
  A31: (o) => o.companyBFirstInvoice === 1,
  A32: (o) => o.statusCode === 400 && o.finalStock === 10,
  A33: (o) =>
    o.statusCode === 404 &&
    o.orders === 1 &&
    o.payments === 1 &&
    o.customers === 1 &&
    o.otherCompanyOrders === 1,
  A34: (o) =>
    o.beforeCustomer === o.afterCustomer && o.beforeProduct === o.afterProduct,
};
let context;
async function probe(id, title, fn) {
  await context.test(id + " " + title, async () => {
    const out = await fn();
    assert.equal(expected[id](out), true, JSON.stringify(out));
    results.push({ id, status: "PASS" });
  });
}
test("Group 1 financial regressions", async (t) => {
  context = t;
  const uploadDirectory = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "z-index-release-tests-"),
  );
  process.env.UPLOADS_DIR = uploadDirectory;
  t.after(() => fs.rmSync(uploadDirectory, { recursive: true, force: true }));
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    fs.readFileSync(
      path.resolve(__dirname, "fixtures/legacy-schema.sql"),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../prisma/migrations/202611070001_company_basic_login/migration.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../prisma/migrations/202611100001_group1_financials/migration.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync(path.resolve(__dirname, "../prisma/migrations/202611100002_group3_records/migration.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.resolve(__dirname, "../prisma/migrations/202611100003_group4_global_setup/migration.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.resolve(__dirname, "../prisma/migrations/202611110001_group5_workflows/migration.sql"), "utf8"));
  await db.exec(readFileSync(path.resolve(__dirname,"../prisma/migrations/202611120001_group6_operations/migration.sql"),"utf8"));
  const wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await wire.start();
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:" +
    wire.getServerConn().split(":")[1] +
    "/postgres?connection_limit=1";
  process.env.JWT_SECRET = "starter-audit-only-secret-at-least-32-bytes";
  const { app } = require("../src/index");
  const { platformPrisma: raw } = require("../src/prismaClient");
  const { signToken } = require("../src/auth-security");
  const { PRICES } = require("../src/config/plans");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const pinHash = await bcrypt.hash("1234", 4);
  const passwordHash = await bcrypt.hash("AuditPassword123!", 4);
  async function api(url, method = "GET", body, token, headers = {}) {
    const response = await fetch(base + "/api" + url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(["POST", "PUT", "PATCH"].includes(method)
          ? { "Idempotency-Key": require("node:crypto").randomUUID() }
          : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const type = response.headers.get("content-type") || "";
    return {
      status: response.status,
      body: type.includes("json")
        ? await response.json()
        : await response.text(),
    };
  }
  function token(company, user) {
    return signToken(
      {
        companyId: company.id,
        userId: user.id,
        companyVersion: company.authVersion,
        userVersion: user.authVersion,
      },
      "session",
      "1h",
    );
  }
  let fixtureCounter = 0;
  async function fixture(stock = 20, market = "GLOBAL") {
    const company = await raw.company.create({
      data: {
        name: "Audit " + ++fixtureCounter,
        loginEmail: "audit-" + fixtureCounter + "@zindex.invalid",
        passwordHash,
        isActive: true,
        endsAt: new Date(Date.now() + 86400000),
        market,
        currency: market === "GLOBAL" ? "USD" : "AZN",
        locale: market === "GLOBAL" ? "en" : "az",
      },
    });
    ownedCompanies.push(company.id);
    const admin = await raw.user.create({
      data: {
        companyId: company.id,
        fullName: "Audit Admin",
        role: "ADMIN",
        pinHash,
      },
    });
    const rep = await raw.user.create({
      data: {
        companyId: company.id,
        fullName: "Audit Sales",
        role: "EXPEDITOR",
        pinHash: await bcrypt.hash("5678", 4),
      },
    });
    const warehouse = await raw.user.create({
      data: {
        companyId: company.id,
        fullName: "Audit Warehouse",
        role: "WAREHOUSE",
        pinHash: await bcrypt.hash("9012", 4),
      },
    });
    const category = await raw.category.create({
      data: { companyId: company.id, name: "Audit Category" },
    });
    const product = await raw.product.create({
      data: {
        companyId: company.id,
        categoryId: category.id,
        name: "Audit Product",
        salePrice: 10,
      },
    });
    await raw.stock.create({
      data: { companyId: company.id, productId: product.id, quantity: stock },
    });
    const customer = await raw.customer.create({
      data: {
        companyId: company.id,
        name: "Audit Customer",
        phone: "+14155552671",
      },
    });
    return {
      company,
      admin,
      rep,
      warehouse,
      category,
      product,
      customer,
      token: token(company, admin),
      repToken: token(company, rep),
      warehouseToken: token(company, warehouse),
    };
  }
  const stock = async (f) =>
    (await raw.stock.findUnique({ where: { productId: f.product.id } }))
      .quantity;
  const saleBody = (f, quantity = 2, unitPrice = 10) => ({
    customerId: f.customer.id,
    paymentType: "NAĞD",
    items: [{ productId: f.product.id, quantity, unitPrice, isGift: false }],
  });
  const sell = (f, q = 2, p = 10) =>
    api("/orders", "POST", saleBody(f, q, p), f.token);
  try {
    await probe(
      "A01",
      "unauthenticated business endpoint blocked",
      async () => {
        const r = await api("/stock");
        return { problem: r.status !== 401, actual: r.status, expected: 401 };
      },
    );
    await probe("A02", "purchase adds stock and saves document", async () => {
      const f = await fixture(0);
      const r = await api(
        "/purchases",
        "POST",
        {
          items: [
            {
              productId: f.product.id,
              quantity: 5,
              unitCost: 4,
              salePrice: 10,
            },
          ],
        },
        f.token,
      );
      const q = await stock(f);
      return {
        problem: r.status !== 201 || q !== 5,
        statusCode: r.status,
        quantity: q,
      };
    });
    await probe(
      "A03",
      "sale decrements stock; cash does not create payment",
      async () => {
        const f = await fixture(5);
        const r = await sell(f, 2);
        const q = await stock(f);
        const payments = await raw.payment.count({
          where: { companyId: f.company.id },
        });
        return {
          problem: r.status !== 201 || q !== 3,
          statusCode: r.status,
          quantity: q,
          paymentType: r.body.order?.paymentType,
          paymentCount: payments,
          note: "Cash selection is a payment type, not automatic cash collection.",
        };
      },
    );
    await probe(
      "A04",
      "insufficient stock rejects and rolls back",
      async () => {
        const f = await fixture(1);
        const r = await sell(f, 2);
        const q = await stock(f);
        const n = await raw.order.count({ where: { companyId: f.company.id } });
        return {
          problem: r.status !== 409 || q !== 1 || n !== 0,
          statusCode: r.status,
          quantity: q,
          orders: n,
        };
      },
    );
    await probe(
      "A05",
      "duplicate product sale lines share stock cap",
      async () => {
        const f = await fixture(3);
        const body = saleBody(f, 2);
        body.items.push({ ...body.items[0] });
        const r = await api("/orders", "POST", body, f.token);
        const q = await stock(f);
        return {
          problem: r.status !== 409 || q !== 3,
          statusCode: r.status,
          quantity: q,
        };
      },
    );
    await probe(
      "A06",
      "sale quantity must not silently truncate fractions",
      async () => {
        const f = await fixture(5);
        const r = await sell(f, 1.9);
        return {
          problem: r.status === 201,
          statusCode: r.status,
          sentQuantity: 1.9,
          savedQuantity: r.body.order?.items[0]?.quantity,
          quantity: await stock(f),
        };
      },
    );
    await probe(
      "A07",
      "sale quantity rejects malformed numeric strings",
      async () => {
        const f = await fixture(5);
        const r = await sell(f, "2garbage");
        return {
          problem: r.status === 201,
          statusCode: r.status,
          sentQuantity: "2garbage",
          savedQuantity: r.body.order?.items[0]?.quantity,
        };
      },
    );
    await probe(
      "A08",
      "purchase quantity must not silently truncate fractions",
      async () => {
        const f = await fixture(0);
        const r = await api(
          "/purchases",
          "POST",
          {
            items: [
              {
                productId: f.product.id,
                quantity: 1.9,
                unitCost: 4,
                salePrice: 10,
              },
            ],
          },
          f.token,
        );
        return {
          problem: r.status === 201,
          statusCode: r.status,
          savedQuantity: r.body.purchase?.items[0]?.quantity,
          quantity: await stock(f),
        };
      },
    );
    await probe(
      "A09",
      "replayed sale is deduplicated by its operation key",
      async () => {
        const f = await fixture(10);
        const body = saleBody(f, 2);
        const headers = { "Idempotency-Key": "audit-same-sale-request" };
        const a = await api("/orders", "POST", body, f.token, headers);
        const b = await api("/orders", "POST", body, f.token, headers);
        const n = await raw.order.count({ where: { companyId: f.company.id } });
        return {
          problem: n !== 1,
          statuses: [a.status, b.status],
          orders: n,
          quantity: await stock(f),
        };
      },
    );
    await probe(
      "A11",
      "payment cannot exceed debt without tracked customer credit",
      async () => {
        const f = await fixture();
        await sell(f, 1);
        const r = await api(
          "/payments",
          "POST",
          { customerId: f.customer.id, amount: 100, paymentType: "CASH" },
          f.token,
        );
        const detail = await api(
          "/customers/" + f.customer.id,
          "GET",
          undefined,
          f.token,
        );
        return {
          problem: r.status === 201,
          statusCode: r.status,
          saleTotal: 10,
          payment: 100,
          summary: detail.body.summary || detail.body.customer?.summary,
        };
      },
    );
    await probe(
      "A12",
      "replayed payment does not double-count money",
      async () => {
        const f = await fixture();
        await sell(f, 2);
        const body = {
          customerId: f.customer.id,
          amount: 5,
          paymentType: "CASH",
        };
        const headers = { "Idempotency-Key": "audit-same-payment" };
        await api("/payments", "POST", body, f.token, headers);
        await api("/payments", "POST", body, f.token, headers);
        const p = await raw.payment.aggregate({
          where: { companyId: f.company.id },
          _sum: { amount: true },
          _count: true,
        });
        return {
          problem: p._count !== 1,
          count: p._count,
          total: p._sum.amount,
        };
      },
    );
    await probe("A13", "negative payment is rejected", async () => {
      const f = await fixture();
      const r = await api(
        "/payments",
        "POST",
        { customerId: f.customer.id, amount: -1 },
        f.token,
      );
      return { problem: r.status !== 400, statusCode: r.status };
    });
    await probe(
      "A14",
      "payment precision is restricted to minor currency units",
      async () => {
        const f = await fixture();
        await sell(f, 1);
        const r = await api(
          "/payments",
          "POST",
          { customerId: f.customer.id, amount: 0.001 },
          f.token,
        );
        return {
          problem: r.status === 201,
          statusCode: r.status,
          savedAmount: r.body.payment?.amount,
        };
      },
    );
    await probe(
      "A15",
      "sub-cent sale price must not round to a free sale",
      async () => {
        const f = await fixture();
        const r = await sell(f, 1, 0.001);
        return {
          problem:
            r.status === 201 && Number(r.body.order?.items[0]?.unitPrice) === 0,
          statusCode: r.status,
          sentPrice: 0.001,
          savedPrice: r.body.order?.items[0]?.unitPrice,
          quantity: await stock(f),
        };
      },
    );
    await probe(
      "A16",
      "payment sold quantity cannot exceed goods sold",
      async () => {
        const f = await fixture();
        await sell(f, 2);
        const r = await api(
          "/payments",
          "POST",
          {
            customerId: f.customer.id,
            amount: 1,
            soldItems: [{ productId: f.product.id, quantity: 999 }],
          },
          f.token,
        );
        return {
          problem: r.status === 201,
          statusCode: r.status,
          orderedQuantity: 2,
          savedSoldQuantity: r.body.payment?.soldItems[0]?.quantity,
        };
      },
    );
    await probe(
      "A17",
      "normal return restores stock at original price",
      async () => {
        const f = await fixture(10);
        await sell(f, 2);
        const r = await api(
          "/returns",
          "POST",
          {
            customerId: f.customer.id,
            items: [{ productId: f.product.id, quantity: 1 }],
          },
          f.token,
        );
        return {
          problem: r.status !== 201 || (await stock(f)) !== 9,
          statusCode: r.status,
          quantity: await stock(f),
          returnPrice: r.body.returnDoc?.items[0]?.unitPrice,
        };
      },
    );
    await probe(
      "A18",
      "separate repeat return cannot exceed sold quantity",
      async () => {
        const f = await fixture(10);
        await sell(f, 2);
        const body = {
          customerId: f.customer.id,
          items: [{ productId: f.product.id, quantity: 2 }],
        };
        await api("/returns", "POST", body, f.token);
        const r = await api("/returns", "POST", body, f.token);
        return {
          problem: r.status === 201 || (await stock(f)) !== 10,
          statusCode: r.status,
          quantity: await stock(f),
        };
      },
    );
    await probe(
      "A19",
      "duplicate product rows cannot over-return the same sale",
      async () => {
        const f = await fixture(10);
        const s = await sell(f, 2);
        const r = await api(
          "/returns",
          "POST",
          {
            customerId: f.customer.id,
            items: [
              { productId: f.product.id, quantity: 2 },
              { productId: f.product.id, quantity: 2 },
            ],
          },
          f.token,
        );
        const item = await raw.orderItem.findFirst({
          where: { orderId: s.body.order.id },
        });
        return {
          problem: item.returnedQty > item.quantity,
          statusCode: r.status,
          originalStock: 10,
          orderedQuantity: item.quantity,
          returnedQuantity: item.returnedQty,
          finalStock: await stock(f),
        };
      },
    );
    await probe(
      "A20",
      "ordinary return preserves customer risk status",
      async () => {
        const f = await fixture();
        await sell(f, 2);
        await api(
          "/returns",
          "POST",
          {
            customerId: f.customer.id,
            note: "Customer changed their mind",
            items: [{ productId: f.product.id, quantity: 1 }],
          },
          f.token,
        );
        const c = await raw.customer.findUnique({
          where: { id: f.customer.id },
        });
        return {
          problem: c.isProblematic === true,
          isProblematic: c.isProblematic,
          problemNote: c.problemNote,
          note: "Product-policy review: a standard return should not necessarily label a customer as risky.",
        };
      },
    );
    await probe(
      "A22",
      "cross-company customer payment is refused",
      async () => {
        const a = await fixture();
        const b = await fixture();
        const r = await api(
          "/payments",
          "POST",
          { customerId: b.customer.id, amount: 1 },
          a.token,
        );
        const n = await raw.payment.count({
          where: { companyId: a.company.id },
        });
        return {
          problem: r.status === 201 || n !== 0,
          statusCode: r.status,
          paymentsCreated: n,
        };
      },
    );
    await probe(
      "A23",
      "cross-company product sale is refused and atomic",
      async () => {
        const a = await fixture();
        const b = await fixture();
        const body = saleBody(a);
        body.items[0].productId = b.product.id;
        const r = await api("/orders", "POST", body, a.token);
        return {
          problem: r.status === 201 || (await stock(b)) !== 20,
          statusCode: r.status,
          foreignStock: await stock(b),
        };
      },
    );
    await probe("A24", "warehouse role cannot create sales", async () => {
      const f = await fixture();
      const r = await api("/orders", "POST", saleBody(f), f.warehouseToken);
      return { problem: r.status !== 403, statusCode: r.status };
    });
    await probe(
      "A26",
      "Basic feature gate applies to direct premium endpoint",
      async () => {
        const f = await fixture();
        const r = await api("/live-location/active", "GET", undefined, f.token);
        return { problem: r.status !== 403, statusCode: r.status };
      },
    );
    await probe(
      "A27",
      "bulk invalid fractional stock cannot leave orphan product",
      async () => {
        const f = await fixture();
        const r = await api(
          "/catalog/admin/products/bulk",
          "POST",
          {
            categoryId: f.category.id,
            names: ["Fractional Bulk Item"],
            defaultStock: 0.5,
            salePrice: 1,
          },
          f.token,
        );
        const p = await raw.product.findFirst({
          where: { companyId: f.company.id, name: "Fractional Bulk Item" },
          include: { stock: true },
        });
        return {
          problem: !!p && !p.stock,
          statusCode: r.status,
          createdCount: r.body.createdCount,
          skippedCount: r.body.skippedCount,
          productExists: !!p,
          stockExists: !!p?.stock,
        };
      },
    );
    await probe(
      "A32",
      "null stock quantity is not silently treated as zero",
      async () => {
        const f = await fixture(10);
        const r = await api(
          "/stock/" + f.product.id,
          "PATCH",
          { quantity: null },
          f.token,
        );
        return {
          problem: r.status === 200,
          statusCode: r.status,
          previousStock: 10,
          finalStock: await stock(f),
        };
      },
    );
    await probe(
      "A33",
      "test reset endpoint must not erase production customer ledger",
      async () => {
        const a = await fixture(10);
        const b = await fixture(10);
        await sell(a, 2);
        await sell(b, 1);
        await api(
          "/payments",
          "POST",
          { customerId: a.customer.id, amount: 5 },
          a.token,
        );
        const r = await api(
          "/customers/reset-all-test-data",
          "DELETE",
          undefined,
          a.token,
        );
        const orders = await raw.order.count({
          where: { companyId: a.company.id },
        });
        const payments = await raw.payment.count({
          where: { companyId: a.company.id },
        });
        const customers = await raw.customer.count({
          where: { companyId: a.company.id },
        });
        const otherOrders = await raw.order.count({
          where: { companyId: b.company.id },
        });
        return {
          problem: r.status === 200 && orders === 0,
          statusCode: r.status,
          orders,
          payments,
          customers,
          stockStill: await stock(a),
          otherCompanyOrders: otherOrders,
        };
      },
    );

    await context.test(
      "request key cannot be reused for another payload",
      async () => {
        const f = await fixture(5),
          h = { "Idempotency-Key": "same-financial-key" };
        assert.equal(
          (await api("/orders", "POST", saleBody(f, 1), f.token, h)).status,
          201,
        );
        assert.equal(
          (await api("/orders", "POST", saleBody(f, 2), f.token, h)).status,
          409,
        );
        assert.equal(await stock(f), 4);
      },
    );
    await context.test(
      "direct financial API requires a retry key",
      async () => {
        const f = await fixture();
        const r = await fetch(base + "/api/orders", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + f.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saleBody(f, 1)),
        });
        assert.equal(r.status, 400);
        assert.equal(await stock(f), 20);
      },
    );
    await context.test(
      "returns expose credit and a later sale uses that credit",
      async () => {
        const f = await fixture(10);
        await sell(f, 2);
        await api(
          "/payments",
          "POST",
          { customerId: f.customer.id, amount: 20 },
          f.token,
        );
        await api(
          "/returns",
          "POST",
          {
            customerId: f.customer.id,
            items: [{ productId: f.product.id, quantity: 2 }],
          },
          f.token,
        );
        let c = await api(
          "/customers/" + f.customer.id,
          "GET",
          undefined,
          f.token,
        );
        assert.equal(c.body.summary.credit, 20);
        assert.equal(c.body.summary.debt, 0);
        await sell(f, 1);
        c = await api("/customers/" + f.customer.id, "GET", undefined, f.token);
        assert.equal(c.body.summary.credit, 10);
        assert.equal(c.body.summary.debt, 0);
      },
    );
    await context.test(
      "valid duplicate return lines are combined and applied only once",
      async () => {
        const f = await fixture(10);
        await sell(f, 2);
        const r = await api(
          "/returns",
          "POST",
          {
            customerId: f.customer.id,
            items: [
              { productId: f.product.id, quantity: 1 },
              { productId: f.product.id, quantity: 1 },
            ],
          },
          f.token,
        );
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(await stock(f), 10);
        assert.equal(
          (
            await raw.orderItem.findFirst({
              where: { companyId: f.company.id },
            })
          ).returnedQty,
          2,
        );
      },
    );
    await context.test(
      "sold-item reservations are cumulative and restrict returns",
      async () => {
        const f = await fixture(10);
        await sell(f, 4);
        assert.equal(
          (
            await api(
              "/payments",
              "POST",
              {
                customerId: f.customer.id,
                amount: 1,
                soldItems: [{ productId: f.product.id, quantity: 3 }],
              },
              f.token,
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await api(
              "/payments",
              "POST",
              {
                customerId: f.customer.id,
                amount: 1,
                soldItems: [{ productId: f.product.id, quantity: 2 }],
              },
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await api(
              "/returns",
              "POST",
              {
                customerId: f.customer.id,
                items: [{ productId: f.product.id, quantity: 2 }],
              },
              f.token,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await api(
              "/returns",
              "POST",
              {
                customerId: f.customer.id,
                items: [{ productId: f.product.id, quantity: 1 }],
              },
              f.token,
            )
          ).status,
          201,
        );
      },
    );
    await context.test(
      "invalid amounts and quantities leave no financial or stock mutations",
      async () => {
        const f = await fixture(20);
        for (const value of [null, true, false, "", "2garbage", -1, 0.001]) {
          assert.equal(
            (
              await api(
                "/payments",
                "POST",
                { customerId: f.customer.id, amount: value },
                f.token,
              )
            ).status,
            400,
            JSON.stringify(value),
          );
          assert.equal(
            (await api("/orders", "POST", saleBody(f, value), f.token)).status,
            400,
            JSON.stringify(value),
          );
        }
        assert.equal(await stock(f), 20);
        assert.equal(
          await raw.payment.count({ where: { companyId: f.company.id } }),
          0,
        );
        assert.equal(
          await raw.order.count({ where: { companyId: f.company.id } }),
          0,
        );
      },
    );
    await context.test(
      "legacy expeditor return URL uses the same validation",
      async () => {
        const f = await fixture(10);
        const r = await api(
          "/exp/returns",
          "POST",
          {
            customerId: f.customer.id,
            items: [{ productId: f.product.id, quantity: 3 }],
          },
          f.repToken,
        );
        assert.equal(r.status, 409);
        assert.equal(await stock(f), 10);
      },
    );
    await context.test(
      "new customer and sale roll back together and replay together",
      async () => {
        const f = await fixture(1);
        const area = await raw.area.create({
          data: { companyId: f.company.id, name: "Test area" },
        });
        const body = {
          newCustomer: {
            name: "Atomic Customer",
            phone: "+994501234567",
            salon: "Test business",
            address: "Test address",
            areaId: area.id,
            lat: 40,
            lng: 49,
          },
          paymentType: "NAĞD",
          items: [{ productId: f.product.id, quantity: 2, unitPrice: 10 }],
        };
        const h = { "Idempotency-Key": "new-customer-and-sale" };
        assert.equal(
          (await api("/orders", "POST", body, f.token, h)).status,
          409,
        );
        assert.equal(
          await raw.customer.count({
            where: { companyId: f.company.id, name: "Atomic Customer" },
          }),
          0,
        );
        body.items[0].quantity = 1;
        const first = await api("/orders", "POST", body, f.token, h),
          second = await api("/orders", "POST", body, f.token, h);
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(second.status, 200);
        assert.equal(first.body.order.id, second.body.order.id);
        assert.equal(
          await raw.customer.count({
            where: { companyId: f.company.id, name: "Atomic Customer" },
          }),
          1,
        );
        assert.equal(await stock(f), 0);
      },
    );
    await context.test(
      "legacy unlinked returns keep invoice debts consistent with customer totals",
      async () => {
        const f = await fixture(10);
        await sell(f, 2);
        const doc = await raw.return.create({
          data: {
            totalAmount: 10,
            companyId: f.company.id,
            customerId: f.customer.id,
            createdById: f.admin.id,
          },
        });
        await raw.returnItem.create({
          data: {
            companyId: f.company.id,
            returnId: doc.id,
            productId: f.product.id,
            quantity: 1,
            unitPrice: 10,
          },
        });
        const detail = await api(
          "/customers/" + f.customer.id,
          "GET",
          undefined,
          f.token,
        );
        assert.equal(detail.body.summary.debt, 10);
        assert.equal(
          detail.body.customer.orders.reduce(
            (sum, order) => sum + order.remainingDebt,
            0,
          ),
          10,
        );
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await raw.$disconnect();
    await wire.stop();
    await db.close();
  }
});
