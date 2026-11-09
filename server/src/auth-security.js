const jwt = require("jsonwebtoken");
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("JWT_SECRET ən azı 32 bayt olmalıdır.");
  return secret;
}
function signToken(payload, purpose, expiresIn) {
  return jwt.sign({ ...payload, purpose }, jwtSecret(), {
    algorithm: "HS256",
    issuer: "z-index",
    audience: purpose,
    expiresIn,
  });
}
function verifyToken(token, purpose) {
  const payload = jwt.verify(token, jwtSecret(), {
    algorithms: ["HS256"],
    issuer: "z-index",
    audience: purpose,
  });
  if (payload.purpose !== purpose || typeof payload.companyId !== "string")
    throw new Error("Token uyğun deyil.");
  return payload;
}
function bearerToken(req) {
  const header = req.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice(7)
    : "";
}
// Single-process limits; PIN attempts are tied to company/IP, not challenge ID.
function attemptLimiter(limit, windowMs, identify) {
  const entries = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries)
      if (entry.resetAt <= now) entries.delete(key);
  }, 60000);
  timer.unref();
  return (req, res, next) => {
    const key = `${req.ip}:${identify(req)}`;
    const now = Date.now();
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (entries.size >= 10000) {
        res.set("Retry-After", "60");
        return res
          .status(429)
          .json({ message: "Bir qədər sonra yenidən cəhd et." });
      }
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    if (++entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        message: "Çox sayda giriş cəhdi oldu. Bir qədər sonra yenidən yoxla.",
      });
    }
    res.once("finish", () => {
      if (res.statusCode < 400) entry.count = Math.max(0, entry.count - 1);
    });
    next();
  };
}
module.exports = {
  jwtSecret,
  signToken,
  verifyToken,
  bearerToken,
  attemptLimiter,
};