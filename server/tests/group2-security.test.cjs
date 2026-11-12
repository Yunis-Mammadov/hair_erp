const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const sharp = require("sharp");

test("Group 2: API permissions, safe images, input errors and session revocation", async (t) => {
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
          name: "Group2",
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
    const image = await sharp({
      create: { width: 12, height: 8, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    async function upload(
      bytes,
      tokenValue,
      mime = "image/png",
      filename = "receipt.png",
      extra = false,
    ) {
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: mime }), filename);
      if (extra) form.append("extra", "not-allowed");
      const res = await fetch(base + "/api/uploads", {
        method: "POST",
        headers: { Authorization: "Bearer " + tokenValue },
        body: form,
      });
      return {
        status: res.status,
        body: await res.json(),
        headers: res.headers,
      };
    }
    const stock = async (f) =>
      (await raw.stock.findUnique({ where: { productId: f.product.id } }))
        .quantity;

    await t.test(
      "rep cannot lower or raise catalogue price, gift goods or bypass through /exp",
      async () => {
        const f = await fixture();
        for (const [url, body] of [
          ["/orders", f.sale(0.01)],
          ["/orders", f.sale(20)],
          ["/orders", f.sale(0, true)],
          ["/exp/orders", f.sale(0.01)],
        ]) {
          const result = await api(url, "POST", body, f.repToken);
          assert.equal(result.status, 403, JSON.stringify(result.body));
        }
        assert.equal(await stock(f), 10);
        assert.equal(
          await raw.order.count({ where: { companyId: f.company.id } }),
          0,
        );
        assert.equal(
          (await api("/orders", "POST", f.sale(), f.repToken)).status,
          201,
        );
      },
    );
    await t.test("admin can set a manual price and record a gift", async () => {
      const f = await fixture();
      assert.equal(
        (await api("/orders", "POST", f.sale(7.5), f.token)).status,
        201,
      );
      assert.equal(
        (await api("/orders", "POST", f.sale(0, true), f.token)).status,
        201,
      );
      assert.equal(await stock(f), 8);
    });
    await t.test(
      "warehouse purchase cannot change catalogue sale price; normal receipt still works",
      async () => {
        const f = await fixture(),
          payload = {
            items: [
              {
                productId: f.product.id,
                quantity: 2,
                unitCost: 4,
                salePrice: 1,
              },
            ],
          };
        assert.equal(
          (await api("/purchases", "POST", payload, f.warehouseToken)).status,
          403,
        );
        assert.equal(await stock(f), 10);
        payload.items[0].salePrice = 10;
        assert.equal(
          (await api("/purchases", "POST", payload, f.warehouseToken)).status,
          201,
        );
        assert.equal(
          Number(
            (await raw.product.findUnique({ where: { id: f.product.id } }))
              .salePrice,
          ),
          10,
        );
        assert.equal(await stock(f), 12);
      },
    );
    await t.test(
      "dashboard financial statistics require ADMIN even on Premium",
      async () => {
        const f = await fixture("PREMIUM");
        assert.equal(
          (await api("/dashboard/stats", "GET", undefined, f.token)).status,
          200,
        );
        for (const other of [f.repToken, f.warehouseToken])
          assert.equal(
            (await api("/dashboard/stats", "GET", undefined, other)).status,
            403,
          );
        const driver = await raw.user.create({
          data: { companyId: f.company.id, fullName: "Driver", role: "DRIVER" },
        });
        assert.equal(
          (
            await api(
              "/dashboard/stats",
              "GET",
              undefined,
              token(f.company, driver),
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "malformed JSON returns 400 without echoing credentials",
      async () => {
        const f = await fixture(),
          marker = "secret-that-must-not-be-echoed";
        const res = await api(
          "/payments",
          "POST",
          '{"password":"' + marker + '",',
          f.token,
        );
        assert.equal(res.status, 400);
        assert.equal(res.body.code, "INVALID_JSON");
        assert.ok(!JSON.stringify(res.body).includes(marker));
      },
    );
    await t.test("oversized JSON returns 413", async () => {
      const f = await fixture();
      const res = await api(
        "/payments",
        "POST",
        { note: "x".repeat(2 * 1024 * 1024) },
        f.token,
      );
      assert.equal(res.status, 413);
      assert.equal(res.body.code, "REQUEST_TOO_LARGE");
    });
    await t.test(
      "bytes masquerading as PNG and SVG are rejected without files",
      async () => {
        const f = await fixture();
        for (const [bytes, mime] of [
          [Buffer.from("this is not a PNG"), "image/png"],
          [
            Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            ),
            "image/png",
          ],
          [image, "image/svg+xml"],
        ])
          assert.equal((await upload(bytes, f.token, mime)).status, 400);
        assert.equal(
          (await fs.readdir(path.join(uploads, f.company.id)).catch(() => []))
            .length,
          0,
        );
      },
    );
    await t.test(
      "valid image is re-encoded, resized and stripped of original metadata",
      async () => {
        const f = await fixture();
        const jpeg = await sharp({
          create: { width: 2400, height: 30, channels: 3, background: "white" },
        })
          .withMetadata({ exif: { IFD0: { Copyright: "private metadata" } } })
          .jpeg()
          .toBuffer();
        const res = await upload(
          jpeg,
          f.token,
          "image/jpeg",
          "../../arbitrary-name.jpg",
        );
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.match(res.body.file.filename, /^payment-[a-f0-9-]+\.webp$/);
        assert.equal(res.body.file.mimetype, "image/webp");
        const metadata = await sharp(
          await fs.readFile(
            path.join(uploads, f.company.id, res.body.file.filename),
          ),
        ).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(metadata.width, 2000);
        assert.equal(metadata.exif, undefined);
        const view = await fetch(res.body.file.url);
        assert.equal(view.status, 200);
        assert.equal(view.headers.get("x-content-type-options"), "nosniff");
      },
    );
    await t.test(
      "multipart size, extra fields, missing file and pixel limits return client errors",
      async () => {
        const f = await fixture();
        assert.equal(
          (await upload(Buffer.alloc(5 * 1024 * 1024 + 1), f.token)).status,
          413,
        );
        assert.equal(
          (await upload(image, f.token, "image/png", "receipt.png", true))
            .status,
          400,
        );
        const blank = new FormData();
        const missing = await fetch(base + "/api/uploads", {
          method: "POST",
          headers: { Authorization: "Bearer " + f.token },
          body: blank,
        });
        assert.equal(missing.status, 400);
        const huge = await sharp({
          create: {
            width: 4100,
            height: 4100,
            channels: 3,
            background: "white",
          },
        })
          .png()
          .toBuffer();
        assert.equal((await upload(huge, f.token)).status, 400);
      },
    );
    await t.test(
      "company storage quota is enforced across simultaneous uploads",
      async () => {
        const f = await fixture(),
          directory = path.join(uploads, f.company.id);
        await fs.mkdir(directory, { recursive: true });
        const encoded = await sharp(image)
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
        const reserve = path.join(directory, "quota-reservation.bin");
        await fs.writeFile(reserve, "");
        await fs.truncate(reserve, 250 * 1024 * 1024 - encoded.length * 2 + 1);
        const results = await Promise.all([
          upload(image, f.token),
          upload(image, f.token),
        ]);
        assert.deepEqual(
          results.map((res) => res.status).sort(),
          [201, 409],
          JSON.stringify(results),
        );
        assert.equal(
          results.find((res) => res.status === 409).body.code,
          "STORAGE_LIMIT",
        );
      },
    );
    await t.test(
      "uploads require an allowed active user and are rate-limited",
      async () => {
        const f = await fixture();
        assert.equal((await upload(image, f.warehouseToken)).status, 403);
        for (let i = 0; i < 15; i++)
          assert.equal(
            (await upload(Buffer.from("invalid"), f.token)).status,
            400,
          );
        const res = await upload(image, f.token);
        assert.equal(res.status, 429);
        assert.ok(Number(res.headers.get("retry-after")) > 0);
      },
    );
    await t.test(
      "new inline receipt input cannot bypass image validation; legacy photos remain readable",
      async () => {
        const f = await fixture();
        await api("/orders", "POST", f.sale(), f.token);
        const res = await api(
          "/payments",
          "POST",
          {
            customerId: f.customer.id,
            amount: 1,
            imageUrl: "data:image/png;base64,iVBORw0KGgo=",
          },
          f.token,
        );
        assert.equal(res.status, 400);
        assert.equal(
          await raw.payment.count({ where: { companyId: f.company.id } }),
          0,
        );
        await raw.payment.create({
          data: {
            companyId: f.company.id,
            customerId: f.customer.id,
            amount: 1,
            imageUrl: "data:image/png;base64,iVBORw0KGgo=",
          },
        });
        const history = await api("/payments", "GET", undefined, f.token);
        assert.equal(
          history.body.payments[0].imageUrl,
          "data:image/png;base64,iVBORw0KGgo=",
        );
      },
    );
    await t.test(
      "logout revokes session and signed image access but keeps another user's session",
      async () => {
        const f = await fixture();
        const receipt = await upload(image, f.token);
        assert.equal(receipt.status, 201);
        assert.equal(
          (await api("/auth/logout", "POST", {}, f.token)).status,
          200,
        );
        assert.equal(
          (await api("/stock", "GET", undefined, f.token)).status,
          401,
        );
        assert.equal((await fetch(receipt.body.file.url)).status, 401);
        assert.equal(
          (await api("/stock", "GET", undefined, f.repToken)).status,
          200,
        );
        const current = await raw.user.findUnique({
          where: { id: f.admin.id },
        });
        assert.equal(
          (await api("/stock", "GET", undefined, token(f.company, current)))
            .status,
          200,
        );
      },
    );
    await t.test(
      "expired sessions, deactivated users and another tenant cannot access images",
      async () => {
        const f = await fixture(),
          other = await fixture();
        const receipt = await upload(image, f.token);
        assert.equal(receipt.status, 201);
        assert.equal(
          (
            await api(
              "/stock",
              "GET",
              undefined,
              token(f.company, f.admin, "-1s"),
            )
          ).status,
          401,
        );
        const pathname = new URL(receipt.body.file.url).pathname;
        const wrong = signToken(
          {
            companyId: other.company.id,
            userId: other.admin.id,
            companyVersion: 0,
            userVersion: 0,
            pathname,
          },
          "upload",
          "1h",
        );
        assert.equal(
          (await fetch(base + pathname + "?token=" + wrong)).status,
          401,
        );
        await raw.user.update({
          where: { id: f.admin.id },
          data: { isActive: false },
        });
        assert.equal((await fetch(receipt.body.file.url)).status, 401);
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
