import { test } from "node:test";
import assert from "node:assert/strict";
import { expiredSessionToken } from "../src/lib/session-response.js";
const response = (
  status,
  code,
  url = "/payments",
  token = "current-token",
) => ({
  config: { url, headers: { Authorization: "Bearer " + token } },
  response: { status, data: { code } },
});
test("current session 401 and expired subscription request a logout", () => {
  assert.equal(
    expiredSessionToken(response(401), "current-token"),
    "current-token",
  );
  assert.equal(
    expiredSessionToken(
      response(403, "SUBSCRIPTION_INACTIVE"),
      "current-token",
    ),
    "current-token",
  );
});
test("ordinary role or price rejection does not log out a valid user", () => {
  assert.equal(
    expiredSessionToken(response(403, "PRICE_PERMISSION"), "current-token"),
    null,
  );
  assert.equal(
    expiredSessionToken(
      response(403, "PLAN_FEATURE_DISABLED"),
      "current-token",
    ),
    null,
  );
  assert.equal(expiredSessionToken(response(500), "current-token"), null);
});
test("old in-flight responses cannot log out a newly signed-in session", () => {
  assert.equal(
    expiredSessionToken(
      response(401, undefined, "/auth/me", "old-token"),
      "current-token",
    ),
    null,
  );
  assert.equal(expiredSessionToken(response(401), null), null);
});
test("company password and PIN errors do not invalidate a current browser session", () => {
  for (const url of [
    "/auth/company-login",
    "/api/auth/pin-login",
    "https://api.test/api/auth/pin-login",
  ])
    assert.equal(
      expiredSessionToken(response(401, undefined, url), "current-token"),
      null,
    );
});
test("header names are case insensitive and anonymous failures do not invalidate sessions", () => {
  const error = response(401);
  error.config.headers = { authorization: "Bearer current-token" };
  assert.equal(expiredSessionToken(error, "current-token"), "current-token");
  error.config.headers = {};
  assert.equal(expiredSessionToken(error, "current-token"), null);
});
