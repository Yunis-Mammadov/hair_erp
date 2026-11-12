const express = require("express");
const bcrypt = require("bcrypt");
const { randomBytes } = require("node:crypto");
const { platformPrisma } = require("../prismaClient");
const { requireAuth, publicUser } = require("../middleware/auth.middleware");
const {
  signToken,
  verifyToken,
  bearerToken,
  attemptLimiter,
} = require("../auth-security");
const {
  hasFeature,
  publicCompany,
  subscriptionIsActive,
} = require("../config/plans");
const router = express.Router();
const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);
const companyLimiter = attemptLimiter(10, 15 * 60 * 1000, (req) =>
  String(req.body?.email || "")
    .trim()
    .toLowerCase()
    .slice(0, 254),
);
const pinLimiter = attemptLimiter(
  10,
  15 * 60 * 1000,
  (req) => req.loginCompany.id,
);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.post("/company-login", companyLimiter, async (req, res, next) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password = req.body?.password;
    if (
      !email ||
      email.length > 254 ||
      typeof password !== "string" ||
      Buffer.byteLength(password) > 72 ||
      !password.length
    )
      return res
        .status(400)
        .json({ message: "Şirkətin e-poçtunu və şifrəsini daxil et." });
    const company = await platformPrisma.company.findUnique({
      where: { loginEmail: email },
    });
    const valid = await bcrypt.compare(
      password,
      company?.passwordHash || (await dummyHash),
    );
    if (!company || !valid)
      return res.status(401).json({ message: "E-poçt və ya şifrə yanlışdır." });
    if (!subscriptionIsActive(company))
      return res
        .status(403)
        .json({
          code: "SUBSCRIPTION_INACTIVE",
          message: "Şirkətin aktiv abunəliyi yoxdur.",
        });
    const loginToken = signToken(
      { companyId: company.id, companyVersion: company.authVersion },
      "company-login",
      "5m",
    );
    return res.json({
      loginToken,
      company: { id: company.id, name: company.name },
      expiresInSeconds: 300,
    });
  } catch (error) {
    next(error);
  }
});
async function requireCompanyLogin(req, res, next) {
  try {
    const decoded = verifyToken(bearerToken(req), "company-login");
    const company = await platformPrisma.company.findUnique({
      where: { id: decoded.companyId },
    });
    if (!company || company.authVersion !== decoded.companyVersion)
      throw new Error("Şirkət girişi bitib.");
    if (!subscriptionIsActive(company))
      return res
        .status(403)
        .json({
          code: "SUBSCRIPTION_INACTIVE",
          message: "Şirkətin aktiv abunəliyi yoxdur.",
        });
    req.loginCompany = company;
    next();
  } catch (error) {
    if (error.name?.startsWith("Prisma")) return next(error);
    return res
      .status(401)
      .json({
        code: "COMPANY_LOGIN_REQUIRED",
        message: "Əvvəl şirkətin e-poçtu və şifrəsi ilə daxil ol.",
      });
  }
}
router.post(
  "/pin-login",
  requireCompanyLogin,
  pinLimiter,
  async (req, res, next) => {
    try {
      const pin = req.body?.pin;
      if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin))
        return res
          .status(400)
          .json({ message: "PIN 4–8 rəqəmdən ibarət olmalıdır." });
      const company = req.loginCompany;
      const users = await platformPrisma.user.findMany({
        where: { companyId: company.id, isActive: true },
        select: {
          id: true,
          fullName: true,
          role: true,
          pinHash: true,
          authVersion: true,
        },
      });
      const matches = [];
      for (const user of users)
        if (user.pinHash && (await bcrypt.compare(pin, user.pinHash)))
          matches.push(user);
      if (matches.length !== 1)
        return res
          .status(401)
          .json({
            message:
              matches.length > 1
                ? "Bu şirkətdə təkrarlanan PIN var. Administrator PIN-ləri fərqləndirməlidir."
                : "PIN yanlışdır.",
          });
      const user = matches[0];
      if (user.role === "DRIVER" && !hasFeature(company, "delivery"))
        return res
          .status(403)
          .json({ message: "Sürücü bölməsi Premium paketdədir." });
      const token = signToken(
        {
          companyId: company.id,
          userId: user.id,
          companyVersion: company.authVersion,
          userVersion: user.authVersion,
        },
        "session",
        "8h",
      );
      return res.json({
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          company: publicCompany(company),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post('/logout',requireAuth,async(req,res,next)=>{try{await platformPrisma.user.update({where:{id:req.user.id},data:{authVersion:{increment:1}}});res.json({ok:true});}catch(error){next(error);}});
router.get("/me", requireAuth, (req, res) => res.json(publicUser(req)));
router.post("/setup-admin", (_req, res) =>
  res
    .status(410)
    .json({
      message:
        "Şirkət və administrator yalnız serverdə şirkət idarəetmə əmri ilə yaradılır.",
    }),
);
module.exports = router;