import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareFinancialRequest as prepare,
  finishFinancialRequest as finish,
} from "../src/lib/financial-retries.js";
const stored = new Map();
globalThis.sessionStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
const config = (amount = 5) => ({
  method: "post",
  url: "/payments",
  data: { customerId: "customer", amount },
  headers: {},
});
const token = (suffix) =>
  "header." +
  Buffer.from(
    JSON.stringify({ companyId: "company", userId: "user", exp: suffix }),
  ).toString("base64url") +
  ".signature";

test("simultaneous submissions share a key", async () => {
  const [a, b] = await Promise.all([
    prepare(config(), token(1)),
    prepare(config(), token(1)),
  ]);
  assert.equal(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  finish(a, 201);
});
test("lost response, server error, auth failure and conflict retain the operation key", async () => {
  const a = await prepare(config(6), token(1));
  for (const status of [undefined, 500, 409, 401, 403, 429]) {
    finish(a, status);
    const b = await prepare(config(6), token(1));
    assert.equal(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  }
  finish(a, 201);
});
test("session storage survives module reload and a refreshed login", async () => {
  const a = await prepare(config(7), token(1));
  const reloaded = await import("../src/lib/financial-retries.js?reload-test");
  const b = await reloaded.prepareFinancialRequest(config(7), token(2));
  assert.equal(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  reloaded.finishFinancialRequest(b, 200);
  finish(a, 200);
});
test("a successful operation allows a separate later payment", async () => {
  const a = await prepare(config(8), token(1));
  finish(a, 201);
  const b = await prepare(config(8), token(1));
  assert.notEqual(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  finish(b, 201);
});
test("changed payload gets a separate key; explicit keys are preserved", async () => {
  const a = await prepare(config(9), token(1)),
    b = await prepare(config(10), token(1));
  assert.notEqual(a.headers["Idempotency-Key"], b.headers["Idempotency-Key"]);
  const c = {
    ...config(),
    headers: { "Idempotency-Key": "explicit-request-key" },
  };
  await prepare(c, token(1));
  assert.equal(c.headers["Idempotency-Key"], "explicit-request-key");
  const d = {
    ...config(),
    headers: { "idempotency-key": "lowercase-request-key" },
  };
  await prepare(d, token(1));
  assert.equal(d.headers["idempotency-key"], "lowercase-request-key");
  assert.equal(d.financialFingerprint, undefined);
  finish(a, 201);
  finish(b, 201);
});
test("read-only and nonfinancial requests receive no operation key", async () => {
  for (const c of [
    { ...config(), method: "get" },
    { ...config(), url: "/auth/company-login" },
  ]) {
    await prepare(c, token(1));
    assert.equal(c.headers["Idempotency-Key"], undefined);
  }
});
test("catalogue creates, CSV imports, edits and stock counts retain uncertain retry keys", async () => {
  for (const [method, url] of [
    ["post", "/catalog/admin/categories"],
    ["post", "/catalog/admin/products"],
    ["post", "/catalog/admin/products/bulk"],
    ["post", "/records/imports/products"],
    ["post", "/records/imports/customers"],
    ["patch", "/stock/product-1"],
    ["patch", "/catalog/admin/products/product-1"],
  ]) {
    const create = () => ({ method, url, data: { value: 12 }, headers: {} });
    const a = await prepare(create(), token(5));
    assert.ok(a.headers["Idempotency-Key"], url);
    finish(a, 500);
    const b = await prepare(create(), token(6));
    assert.equal(
      a.headers["Idempotency-Key"],
      b.headers["Idempotency-Key"],
      url,
    );
    finish(b, 200);
  }
});
