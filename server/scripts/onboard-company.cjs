require("dotenv").config({ quiet: true });

const { readFileSync } = require("node:fs");
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { platformPrisma: db } = require("../src/prismaClient");
const { PRICES } = require("../src/config/plans");
const { currencies, validTimezone } = require("../src/workspace-core");
const { assertPin } = require("../src/pin-policy");

function parseInput(input) {
  const code = String(input.code || "").trim().toLowerCase();
  const name = String(input.name || "").trim();
  const password = input.password;

  const currency = String(input.currency || "USD").trim().toUpperCase();
  const market = String(input.market || "GLOBAL").trim().toUpperCase();

  const billingCycle = String(input.billingCycle || "MONTHLY")
    .trim()
    .toUpperCase();

  const timezone = String(input.timezone || "UTC").trim();

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) ||
    code.length > 63
  ) {
    throw Error(
      "Şirkət kodu: a-z, 0-9 və arada tire; maksimum 63 simvol.",
    );
  }

  if (name.length < 2 || name.length > 150) {
    throw Error("Şirkət adı 2–150 simvol olmalıdır.");
  }

  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    throw Error(
      "Şifrə ən azı 12 simvol, maksimum 72 bayt olmalıdır.",
    );
  }

  if (!currencies.includes(currency)) {
    throw Error(`Valyuta seç: ${currencies.join(", ")}`);
  }

  if (
    !PRICES[market]?.BASIC ||
    !["MONTHLY", "YEARLY"].includes(billingCycle)
  ) {
    throw Error(
      "Bazar AZ/GLOBAL, dövr MONTHLY/YEARLY olmalıdır.",
    );
  }

  if (!validTimezone(timezone)) {
    throw Error("Saat qurşağı yanlışdır.");
  }

  const pins = Object.fromEntries(
    ["ADMIN", "WAREHOUSE", "EXPEDITOR"].map(role => [role, assertPin(input.pins?.[role])]),
  );
  if (new Set(Object.values(pins)).size !== 3) {
    throw Error("Üç hesabın PIN-ləri bir-birindən fərqli olmalıdır.");
  }
  return {
    pins,
    code,
    name,
    password,
    currency,
    market,
    billingCycle,
    timezone,
  };
}

async function createCompany(input) {
  const data = parseInput(input);
  const loginEmail = `${data.code}@zindex.com`;

  const passwordHash = await bcrypt.hash(data.password, 12);

  const workers = [
    {
      fullName: "Admin",
      role: "ADMIN",
      pin: data.pins.ADMIN,
    },
    {
      fullName: "Warehouse",
      role: "WAREHOUSE",
      pin: data.pins.WAREHOUSE,
    },
    {
      fullName: "Sales representative",
      role: "EXPEDITOR",
      pin: data.pins.EXPEDITOR,
    },
  ];

  const hashes = [];

  for (const worker of workers) {
    hashes.push(await bcrypt.hash(worker.pin, 12));
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  const day = endsAt.getUTCDate();

  endsAt.setUTCDate(1);

  endsAt.setUTCMonth(
    endsAt.getUTCMonth() +
      (data.billingCycle === "YEARLY" ? 12 : 1),
  );

  const lastDay = new Date(
    Date.UTC(
      endsAt.getUTCFullYear(),
      endsAt.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  endsAt.setUTCDate(Math.min(day, lastDay));

  return db.$transaction(
    async (tx) => {
      const existing = await tx.company.findUnique({
        where: { loginEmail },
        select: { id: true },
      });

      if (existing) {
        throw Error(
          "Bu giriş e-poçtu artıq mövcuddur. Başqa şirkət kodu seç.",
        );
      }

      const company = await tx.company.create({
        data: {
          name: data.name,
          loginEmail,
          passwordHash,

          plan: "BASIC",
          market: data.market,
          billingCycle: data.billingCycle,

          currency: data.currency,
          currencyConfigured: true,

          locale: "en",
          timezone: data.timezone,

          isActive: true,
          startsAt,
          endsAt,
        },
        select: {
          id: true,
          name: true,
          loginEmail: true,
          plan: true,
          currency: true,
          timezone: true,
          endsAt: true,
        },
      });

      for (let i = 0; i < workers.length; i++) {
        await tx.user.create({
          data: {
            companyId: company.id,
            fullName: workers[i].fullName,
            role: workers[i].role,
            pinHash: hashes[i],
            isActive: true,
          },
        });
      }

      return company;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
}

if (require.main === module) {
  (async () => {
    const input = JSON.parse(
      readFileSync(0, "utf8").replace(/^\uFEFF/, ""),
    );

    const company = await createCompany(input);

    console.log(
      "Şirkət və üç hesab yaradıldı. Şifrə ekrana yazılmır.",
    );

    console.table([company]);

    console.log("PIN-lər sorğuda təyin edildi; ekrana yazılmır.");
  })()
    .catch((error) => {
      console.error(
        error.code === "P2002"
          ? "Bu şirkət artıq mövcuddur; məlumatlar dəyişdirilmədi."
          : error.name?.startsWith("Prisma")
            ? "Baza əməliyyatı alınmadı. DATABASE_URL və miqrasiyaları yoxla."
            : error instanceof SyntaxError
              ? "Giriş JSON formatında olmalıdır."
              : error.message,
      );

      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}

module.exports = { parseInput, createCompany };
