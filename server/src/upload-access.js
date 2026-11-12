const path = require("node:path");
const { platformPrisma } = require("./prismaClient");
const { signToken, verifyToken } = require("./auth-security");
const { subscriptionIsActive } = require("./config/plans");

const uploadsRoot = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, "uploads"),
);
function uploadPath(value, company) {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("Şəkil ünvanı yanlışdır.");
  const pathname = new URL(value, "http://local.invalid").pathname;
  const parts = pathname.split("/").filter(Boolean);
  const safe = (part) => /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part);
  if (parts[0] !== "uploads" || !parts.every(safe))
    throw new Error("Şəkil ünvanı yanlışdır.");
  if (parts.length === 3 && parts[1] === company.id)
    return { pathname, diskPath: path.join(uploadsRoot, company.id, parts[2]) };
  if (parts.length === 2 && company.legacyUploads)
    return { pathname, diskPath: path.join(uploadsRoot, parts[1]) };
  throw new Error("Şəkil bu şirkətə aid deyil.");
}
function inlineImage(value) {
  return (
    typeof value === "string" &&
    value.length <= 7 * 1024 * 1024 &&
    /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)
  );
}
function normalizeUploadUrl(value, company) {
  if (inlineImage(value)) throw Object.assign(new Error("Upload new receipt images through the image upload endpoint."), {statusCode:400, code:"INVALID_IMAGE"});
  try {
    return uploadPath(value, company).pathname;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
}
function signedUploadUrl(value, req) {
  if (inlineImage(value)) return value;
  const { pathname } = uploadPath(value, req.company);
  const token = signToken(
    {
      companyId: req.company.id,
      userId: req.user.id,
      companyVersion: req.company.authVersion,
      userVersion: req.authUserVersion,
      pathname,
    },
    "upload",
    "1h",
  );
  const origin =
    process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/$/, "")}${pathname}?token=${encodeURIComponent(token)}`;
}
function signImageResponses(req, res, next) {
  res.set("Cache-Control", "no-store");
  const original = res.json.bind(res);
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || Object.getPrototypeOf(value) !== Object.prototype)
      return value;
    const copy = { ...value };
    for (const [key, item] of Object.entries(copy)) {
      if (["imageUrl", "logoUrl"].includes(key) && item) {
        try {
          copy[key] = signedUploadUrl(item, req);
        } catch {
          copy[key] = null;
        }
      } else copy[key] = visit(item);
    }
    return copy;
  }
  res.json = (body) => original(visit(body));
  next();
}
async function serveUpload(req, res, next) {
  try {
    const decoded = verifyToken(String(req.query.token || ""), "upload");
    const pathname = new URL(req.originalUrl, "http://local.invalid").pathname;
    if (decoded.pathname !== pathname || typeof decoded.userId !== "string")
      throw new Error("Şəkil açılmadı.");
    const user = await platformPrisma.user.findFirst({
      where: {
        id: decoded.userId,
        companyId: decoded.companyId,
        isActive: true,
      },
      select: { authVersion: true, company: true },
    });
    if (
      !user ||
      user.authVersion !== decoded.userVersion ||
      user.company.authVersion !== decoded.companyVersion ||
      !subscriptionIsActive(user.company)
    )
      throw new Error("Şəkil açılmadı.");
    const { diskPath } = uploadPath(pathname, user.company);
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.sendFile(diskPath, (error) => {
      if (error && !res.headersSent)
        res.status(404).json({ message: "Şəkil tapılmadı." });
    });
  } catch (error) {
    if (error.name?.startsWith("Prisma")) return next(error);
    return res
      .status(401)
      .json({ message: "Şəkli açmaq üçün səhifəni yenilə." });
  }
}
module.exports = {
  uploadsRoot,
  normalizeUploadUrl,
  signedUploadUrl,
  signImageResponses,
  serveUpload,
};
