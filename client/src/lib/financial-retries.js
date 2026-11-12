// Only uncertain operations are retained. A successful new submission gets a new key.
// sessionStorage preserves a lost-response retry across a reload in the same tab.
const pending = new Map();
const prefix = "z-index-pending-financial:";
const writes =
  /^\/(?:orders|exp\/orders|payments(?:\/refunds|\/[^/]+\/void)?|returns|exp\/returns|purchases)\/?$/;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export async function prepareFinancialRequest(config, token) {
  const pathname = new URL(
    config.url,
    "https://local.invalid",
  ).pathname.replace(/^\/api(?=\/)/, "");
  const method = (config.method || "get").toLowerCase();
  const recordPatch =
    method === "patch" &&
    /^\/(?:stock\/[^/]+|catalog\/admin\/products\/[^/]+)$/.test(pathname);
  if (
    !recordPatch &&
    ((config.method || "get").toLowerCase() !== "post" ||
      !(
        writes.test(pathname) ||
        /^\/catalog\/admin\/(?:categories|products(?:\/bulk)?)\/?$/.test(
          pathname,
        ) ||
        /^\/records\/imports\/(?:products|customers)$/.test(pathname)
      ))
  )
    return config;
  if (
    Object.keys(config.headers || {}).some(
      (key) => key.toLowerCase() === "idempotency-key",
    ) ||
    config.data?.requestId
  )
    return config;
  let actor = token;
  try {
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (claims.companyId && claims.userId)
      actor = { companyId: claims.companyId, userId: claims.userId };
  } catch {
    /* Only used to namespace browser retries; API verifies authentication. */
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify(canonical({ actor, pathname, body: config.data })),
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  let key = pending.get(fingerprint);
  if (!key) {
    try {
      key = sessionStorage.getItem(prefix + fingerprint);
    } catch {
      /* Storage may be disabled. */
    }
    if (!key) key = globalThis.crypto.randomUUID();
    pending.set(fingerprint, key);
    try {
      sessionStorage.setItem(prefix + fingerprint, key);
    } catch {
      /* Memory still protects retries. */
    }
  }
  config.headers ||= {};
  config.headers["Idempotency-Key"] = key;
  config.financialFingerprint = fingerprint;
  return config;
}
export function finishFinancialRequest(config, status) {
  // Network errors and server/conflict responses may have committed: retain the key.
  if (
    !config?.financialFingerprint ||
    !(
      (status >= 200 && status < 300) ||
      [400, 404, 405, 413, 415, 422].includes(status)
    )
  )
    return;
  pending.delete(config.financialFingerprint);
  try {
    sessionStorage.removeItem(prefix + config.financialFingerprint);
  } catch {
    /* Storage may be disabled. */
  }
}
