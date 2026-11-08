const { platformPrisma } = require("../prismaClient");
const { runWithCompany } = require("../tenant-context");
const { bearerToken, verifyToken } = require("../auth-security");
const {
  hasFeature,
  publicCompany,
  subscriptionIsActive,
} = require("../config/plans");
async function requireAuth(req, res, next) {
  if (req.user && req.company) return runWithCompany(req.company.id, next);
  try {
    const decoded = verifyToken(bearerToken(req), "session");
    if (typeof decoded.userId !== "string")
      throw new Error("İstifadəçi yoxdur.");
    const user = await platformPrisma.user.findFirst({
      where: { id: decoded.userId, companyId: decoded.companyId },
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
        authVersion: true,
        company: true,
      },
    });
    if (
      !user?.isActive ||
      user.authVersion !== decoded.userVersion ||
      user.company.authVersion !== decoded.companyVersion
    )
      return res
        .status(401)
        .json({ message: "Sessiya bitib. Yenidən daxil ol." });
    if (!subscriptionIsActive(user.company))
      return res
        .status(403)
        .json({
          code: "SUBSCRIPTION_INACTIVE",
          message: "Şirkətin aktiv abunəliyi yoxdur.",
        });
    if (user.role === "DRIVER" && !hasFeature(user.company, "delivery"))
      return res
        .status(403)
        .json({
          code: "PLAN_FEATURE_DISABLED",
          message: "Sürücü bölməsi Premium paketdədir.",
        });
    req.company = user.company;
    req.authUserVersion = user.authVersion;
    req.user = {
      userId: user.id,
      id: user.id,
      companyId: user.company.id,
      fullName: user.fullName,
      role: user.role,
    };
    return runWithCompany(user.company.id, next);
  } catch (error) {
    if (error.name?.startsWith("Prisma")) return next(error);
    return res.status(401).json({ message: "Daxil olmaq lazımdır." });
  }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: "Bu əməliyyata icazə yoxdur." });
}
function requireFeature(feature) {
  return (req, res, next) =>
    hasFeature(req.company, feature)
      ? next()
      : res
          .status(403)
          .json({
            code: "PLAN_FEATURE_DISABLED",
            feature,
            message: "Bu funksiya şirkətin paketinə daxil deyil.",
          });
}
function publicUser(req) {
  return {
    id: req.user.id,
    fullName: req.user.fullName,
    role: req.user.role,
    company: publicCompany(req.company),
  };
}
module.exports = { requireAuth, requireRole, requireFeature, publicUser };