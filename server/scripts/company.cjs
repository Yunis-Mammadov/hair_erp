require("dotenv").config();
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { platformPrisma: db } = require("../src/prismaClient");
const { PLANS, PRICES, publicCompany } = require("../src/config/plans");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} təyin edilməlidir.`);
  return value;
}
function offerInput() {
  const plan = (process.env.COMPANY_PLAN || "BASIC").toUpperCase();
  const market = (process.env.COMPANY_MARKET || "AZ").toUpperCase();
  const billingCycle = (
    process.env.COMPANY_BILLING_CYCLE || "MONTHLY"
  ).toUpperCase();
  if (!PRICES[market]?.[plan] || !["MONTHLY", "YEARLY"].includes(billingCycle))
    throw new Error(
      "Paket, bazar və ya ödəniş dövrü yanlışdır. GLOBAL bazarında yalnız BASIC var.",
    );
  const startsAt = new Date();
  const endsAt = process.env.COMPANY_ENDS_AT
    ? new Date(process.env.COMPANY_ENDS_AT)
    : new Date(startsAt);
  if (!process.env.COMPANY_ENDS_AT) {
    // Clamp the day to the target month's final day.
    const day = endsAt.getUTCDate();
    endsAt.setUTCDate(1);
    endsAt.setUTCMonth(
      endsAt.getUTCMonth() + (billingCycle === "YEARLY" ? 12 : 1),
    );
    const last = new Date(
      Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth() + 1, 0),
    ).getUTCDate();
    endsAt.setUTCDate(Math.min(day, last));
  }
  if (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)
    throw new Error("COMPANY_ENDS_AT gələcək tarix olmalıdır.");
  return {
    plan,
    market,
    billingCycle,
    startsAt,
    endsAt,
    isActive: true,
    currency: market === "GLOBAL" ? "USD" : "AZN",
    locale: "en",
    timezone: market === "GLOBAL" ? "UTC" : "Asia/Baku",
  };
}
async function applyActiveUsers(tx, companyId, plan, adminId) {
  const users = await tx.user.findMany({
    where: { companyId },
    select: {
      id: true,
      fullName: true,
      role: true,
      isActive: true,
      pinHash: true,
    },
  });
  const explicit = process.env.KEEP_ACTIVE_USER_IDS;
  const keep = explicit
    ? explicit
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : users.filter((user) => user.isActive).map((user) => user.id);
  if (
    new Set(keep).size !== keep.length ||
    keep.some((id) => !users.some((user) => user.id === id))
  )
    throw new Error("KEEP_ACTIVE_USER_IDS siyahısını yoxla.");
  if (
    !keep.includes(adminId) ||
    keep.length > PLANS[plan].maxUsers ||
    users.some(
      (user) =>
        keep.includes(user.id) && user.role === "DRIVER" && plan !== "PREMIUM",
    )
  ) {
    console.table(users.map(({ pinHash, ...user }) => user));
    throw new Error(
      `Bu paketdə ən çox ${PLANS[plan].maxUsers} aktiv hesab ola bilər; DRIVER yalnız PREMIUM üçündür. KEEP_ACTIVE_USER_IDS dəyişəninə saxlanacaq hesabların ID-lərini vergüllə yaz. Admin (${adminId}) siyahıda qalmalıdır. Məlumatlar silinmir.`,
    );
  }
  const selected = users.filter((user) => keep.includes(user.id));
  // A newly supplied admin PIN must not identify another employee.
  const pin = process.env.COMPANY_ADMIN_PIN;
  if (pin)
    for (const user of users)
      if (
        user.id !== adminId &&
        user.pinHash &&
        (await bcrypt.compare(pin, user.pinHash))
      )
        throw new Error("Admin üçün seçilən PIN başqa işçiyə aiddir.");
  if (explicit) {
    await tx.user.updateMany({
      where: { companyId, id: { notIn: keep }, isActive: true },
      data: { isActive: false, authVersion: { increment: 1 } },
    });
    await tx.user.updateMany({
      where: { companyId, id: { in: keep }, isActive: false },
      data: { isActive: true, authVersion: { increment: 1 } },
    });
  }
  if (selected.some((user) => user.id !== adminId && !user.pinHash))
    throw new Error(
      "Aktiv işçinin PIN-i yoxdur. Əvvəl onun PIN-ini təyin et və ya həmin hesabı seçimdən çıxar.",
    );
}
async function main() {
  const action = process.argv[2];
  if (action === "list") {
    const companies = await db.company.findMany({
      select: {
        id: true,
        name: true,
        loginEmail: true,
        plan: true,
        market: true,
        isActive: true,
        endsAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    console.table(companies);
    const companyId = process.env.COMPANY_ID || "legacy-company";
    console.table(
      await db.user.findMany({
        where: { companyId },
        select: { id: true, fullName: true, role: true, isActive: true },
      }),
    );
    return;
  }
  if (!["setup", "create", "plan"].includes(action))
    throw new Error(
      "İstifadə: node scripts/company.cjs setup|create|plan|list",
    );
  const offer = offerInput();
  if (action === "plan") {
    const companyId = required("COMPANY_ID");
    const company = await db.$transaction(
      async (tx) => {
        const admin = await tx.user.findFirst({
          where: { companyId, role: "ADMIN", isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (!admin) throw new Error("Aktiv admin yoxdur.");
        await applyActiveUsers(tx, companyId, offer.plan, admin.id);
        return tx.company.update({
          where: { id: companyId },
          data: { ...offer, currency: (await tx.company.findUniqueOrThrow({where:{id:companyId}})).currency, timezone: (await tx.company.findUniqueOrThrow({where:{id:companyId}})).timezone, authVersion: { increment: 1 } },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    );
    console.log(JSON.stringify(publicCompany(company), null, 2));
    return;
  }
  const loginEmail = required("COMPANY_LOGIN_EMAIL").trim().toLowerCase();
  const password = required("COMPANY_LOGIN_PASSWORD");
  const pin = process.env.COMPANY_ADMIN_PIN;
  const name = required("COMPANY_NAME").trim();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail) ||
    loginEmail.length > 254 ||
    name.length < 2
  )
    throw new Error("Şirkət adı və giriş e-poçtunu yoxla.");
  if (password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error("Şifrə ən azı 12 simvol və maksimum 72 bayt olmalıdır.");
  if (pin !== undefined && !/^\d{4,8}$/.test(pin))
    throw new Error("PIN 4–8 rəqəm olmalıdır.");
  if (action === "create" && !pin)
    throw new Error("Yeni şirkət üçün COMPANY_ADMIN_PIN tələb olunur.");
  const passwordHash = await bcrypt.hash(password, 12);
  const pinHash = pin ? await bcrypt.hash(pin, 12) : undefined;
  const result = await db.$transaction(
    async (tx) => {
      if (action === "create") {
        const company = await tx.company.create({
          data: { name, loginEmail, passwordHash, ...offer },
        });
        const admin = await tx.user.create({
          data: {
            companyId: company.id,
            fullName: process.env.COMPANY_ADMIN_NAME || "Admin",
            role: "ADMIN",
            pinHash,
          },
          select: { id: true, fullName: true, role: true },
        });
        return { company: publicCompany(company), admin };
      }
      const companyId = process.env.COMPANY_ID || "legacy-company";
      const admin = await tx.user.findFirst({
        where: {
          companyId,
          role: "ADMIN",
          ...(process.env.COMPANY_ADMIN_USER_ID
            ? { id: process.env.COMPANY_ADMIN_USER_ID }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (!admin)
        throw new Error(
          "Mövcud şirkətdə admin tapılmadı. Yeni şirkət üçün create əmrindən istifadə et.",
        );
      if (!pinHash && !admin.pinHash)
        throw new Error("COMPANY_ADMIN_PIN təyin et.");
      await applyActiveUsers(tx, companyId, offer.plan, admin.id);
      const updatedAdmin = await tx.user.update({
        where: { id: admin.id },
        data: {
          ...(pinHash ? { pinHash } : {}),
          isActive: true,
          authVersion: { increment: 1 },
        },
        select: { id: true, fullName: true, role: true },
      });
      const company = await tx.company.update({
        where: { id: companyId },
        data: {
          name,
          loginEmail,
          passwordHash,
          ...offer,
          currency: (await tx.company.findUniqueOrThrow({where:{id:companyId}})).currency,
          timezone: (await tx.company.findUniqueOrThrow({where:{id:companyId}})).timezone,
          authVersion: { increment: 1 },
        },
      });
      return { company: publicCompany(company), admin: updatedAdmin };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());