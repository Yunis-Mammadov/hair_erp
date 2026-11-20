const { Router } = require("express");
const { createHash, timingSafeEqual } = require("node:crypto");

const { attemptLimiter, bearerToken } = require("../auth-security");
const { platformPrisma: db } = require("../prismaClient");
const { currencies } = require("../workspace-core");

const {
  createCompany,
  parseInput,
} = require("../../scripts/onboard-company.cjs");

const router = Router();

const digest = (value) =>
  createHash("sha256").update(value).digest();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.use(
  attemptLimiter(
    10,
    15 * 60 * 1000,
    () => "platform-owner",
  ),
);

router.use((req, res, next) => {
  const secret = process.env.PLATFORM_OWNER_SECRET;

  if (!secret || Buffer.byteLength(secret) < 32) {
    return res.status(503).json({
      message: "Operator girişi serverdə sazlanmayıb.",
    });
  }

  const supplied = bearerToken(req);

  if (
    !supplied ||
    supplied.length > 1024 ||
    !timingSafeEqual(digest(supplied), digest(secret))
  ) {
    return res.status(401).json({
      message: "Operator şifrəsi yanlışdır.",
    });
  }

  next();
});

router.get("/companies", async (_req, res, next) => {
  try {
    const F=require('../financial-core'),R=require('../records-core'),M=require('../operator-management');
    const page=R.page({..._req.query,limit:_req.query.limit||20});
    const search=F.text(_req.query.search,150);
    const where=search?{OR:[{name:{contains:search,mode:'insensitive'}},{loginEmail:{contains:search,mode:'insensitive'}}]}:{};
    const [companies,total]=await db.$transaction([db.company.findMany({where,select:M.companySelect,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:page.skip,take:page.take}),db.company.count({where})]);
    res.json({companies:companies.map(M.publicRecord),currencies,pagination:R.pagination(page,total)});
  } catch (error) {
    next(error);
  }
});

router.post("/companies", async (req, res, next) => {
  if (!req.is("application/json")) {
    return res.status(415).json({
      message: "JSON formatı tələb olunur.",
    });
  }

  let input;

  try {
    if (
      !req.body ||
      Array.isArray(req.body) ||
      typeof req.body !== "object"
    ) {
      throw Error("Şirkət məlumatlarını yoxla.");
    }

    input = parseInput(req.body);
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  try {
    const company = await createCompany(input);

    res.status(201).json({ company });
  } catch (error) {
    if (
      error.code === "P2002" ||
      error.message.includes("artıq mövcuddur")
    ) {
      return res.status(409).json({
        message:
          "Bu giriş e-poçtu artıq mövcuddur. Başqa şirkət kodu seç.",
      });
    }

    if (error.code === "P2034") {
      return res.status(409).json({
        message:
          "Paralel dəyişiklik oldu. Siyahını yenilə və yenidən yoxla.",
      });
    }

    next(error);
  }
});

require("../operator-pins")(router);
require("../operator-management")(router);

router.use((_req, res) => {
  res.status(404).json({
    message: "Operator ünvanı tapılmadı.",
  });
});

module.exports = router;
