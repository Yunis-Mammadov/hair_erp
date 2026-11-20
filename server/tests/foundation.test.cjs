const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Foundation: private PIN provisioning, operator recovery and revocation", async t => {
  const db = new PGlite(); await db.waitReady;
  let wire, raw, server;
  try {
    await db.exec(await fs.readFile(path.join(__dirname, "fixtures/legacy-schema.sql"), "utf8"));
    await require("./helpers/current-migrations.cjs")(db, "202611070000");
    wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" }); await wire.start();
    process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${wire.getServerConn().split(":")[1]}/postgres?connection_limit=1`;
    process.env.JWT_SECRET = "foundation-test-only-jwt-secret-at-least-32";
    process.env.PLATFORM_OWNER_SECRET = "foundation-test-only-operator-secret-32";
    raw = require("../src/prismaClient").platformPrisma;
    server = require("../src/index").app.listen(0, "127.0.0.1"); await new Promise(r => server.on("listening", r));
    const url = `http://127.0.0.1:${server.address().port}/api`, owner = process.env.PLATFORM_OWNER_SECRET;
    async function api(route, method = "GET", body, token) {
      const r = await fetch(url + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: r.status, data: await r.json() };
    }
    const input = { code: "foundation-a", name: "Foundation A", password: "TestCompanyPassword123!", currency: "USD", pins: { ADMIN: "610001", WAREHOUSE: "610002", EXPEDITOR: "610003" } };
    let company, admin, session, challenge;
    async function login(pin) {
      const c = await api("/auth/company-login", "POST", { email: company.loginEmail, password: input.password });
      assert.equal(c.status, 200); challenge = c.data.loginToken;
      return api("/auth/pin-login", "POST", { pin }, challenge);
    }
    await t.test("migration revokes pre-policy company sessions", async () => {
      assert.equal((await raw.company.findUnique({ where: { id: "legacy-company" } })).authVersion, 1);
    });
    await t.test("shared, duplicate and missing initial PINs cannot provision a company", async () => {
      for (const pins of [undefined, { ...input.pins, ADMIN: "2580" }, { ...input.pins, ADMIN: "610002" }])
        assert.equal((await api("/operator/companies", "POST", { ...input, pins }, owner)).status, 400);
      assert.equal(await raw.company.count({ where: { loginEmail: "foundation-a@zindex.com" } }), 0);
    });
    await t.test("private operator PINs provision three accounts without disclosing hashes", async () => {
      const c = await api("/operator/companies", "POST", input, owner); assert.equal(c.status, 201); company = c.data.company;
      const r = await api(`/operator/companies/${company.id}/users`, "GET", null, owner); assert.equal(r.data.users.length, 3); admin = r.data.users.find(u => u.role === "ADMIN");
      assert.ok(!JSON.stringify(r.data).includes("pinHash"));
      for (const [role, pin] of Object.entries(input.pins)) { const l = await login(pin); assert.equal(l.status, 200); assert.equal(l.data.user.role, role); if (role === "ADMIN") session = l.data.token; }
    });
    await t.test("legacy standard PIN login is refused", async () => {
      const r = await login("2580"); assert.equal(r.status, 401); assert.equal(r.data.code, "PIN_RESET_REQUIRED");
    });
    await t.test("ordinary tenant admin cannot access operator recovery", async () => {
      const r = await api(`/operator/companies/${company.id}/users`, "GET", null, session); assert.equal(r.status, 401);
    });
    const endpoint = () => `/operator/companies/${company.id}/users/${admin.id}/pin`;
    await t.test("duplicate/legacy PIN and foreign user IDs are rejected atomically", async () => {
      assert.equal((await api(endpoint(), "PATCH", { pin: "610002" }, owner)).status, 409);
      assert.equal((await api(endpoint(), "PATCH", { pin: "2557" }, owner)).status, 400);
      assert.equal((await api(`/operator/companies/${company.id}/users/not-in-company/pin`, "PATCH", { pin: "610009" }, owner)).status, 404);
      assert.equal((await raw.company.findUnique({ where: { id: company.id } })).authVersion, 0);
    });
    await t.test("operator reset revokes old sessions/challenges and only the new PIN works", async () => {
      const oldChallenge = challenge;
      assert.equal((await api(endpoint(), "PATCH", { pin: "610009" }, owner)).status, 200);
      assert.equal((await api("/stock", "GET", null, session)).status, 401);
      assert.equal((await api("/auth/pin-login", "POST", { pin: "610009" }, oldChallenge)).status, 401);
      assert.equal((await login("610001")).status, 401);
      const updated = await login("610009"); assert.equal(updated.status, 200); session = updated.data.token;
    });
    await t.test("Team API cannot restore a public standard PIN", async () => {
      assert.equal((await api(`/users/${admin.id}`, "PATCH", { pin: "2580" }, session)).status, 400);
    });
  } finally {
    if (server) await new Promise(r => server.close(r)); if (raw) await raw.$disconnect(); if (wire) await wire.stop(); await db.close();
  }
});
