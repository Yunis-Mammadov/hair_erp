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
    const companies = await db.company.findMany({
      select: {
        id: true,
        name: true,
        loginEmail: true,
        currency: true,
        plan: true,
        isActive: true,
        endsAt: true,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 50,
    });

    res.json({ companies, currencies });
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

router.use((_req, res) => {
  res.status(404).json({
    message: "Operator ünvanı tapılmadı.",
  });
});

module.exports = router;