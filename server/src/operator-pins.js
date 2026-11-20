const bcrypt = require("bcrypt");
const { platformPrisma: db } = require("./prismaClient");
const { assertPin } = require("./pin-policy");
const route = fn => async (req, res, next) => {
  try { await fn(req, res); } catch (error) {
    if (["P2034", "P2002"].includes(error.code))
      return res.status(409).json({ message: "Paralel PIN dəyişikliyi oldu. Yenidən yoxla." });
    next(error);
  }
};
const fail = (status, message) => Object.assign(new Error(message), { status });

module.exports = function installPinRoutes(router) {
  router.get("/companies/:id/users", route(async (req, res) => {
    const company = await db.company.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!company) throw fail(404, "Şirkət tapılmadı.");
    const users = await db.user.findMany({
      where: { companyId: company.id },
      select: { id: true, fullName: true, role: true, isActive: true },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    res.json({ users });
  }));
  router.patch("/companies/:id/users/:userId/pin", route(async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => key !== "pin"))
      throw fail(400, "Yalnız yeni PIN göndər.");
    const pin = assertPin(req.body.pin);
    const pinHash = await bcrypt.hash(pin, 12);
    await db.$transaction(async tx => {
      const company = await tx.company.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!company) throw fail(404, "Şirkət tapılmadı.");
      // Serialize PIN changes and revoke this company's old sessions/challenges.
      await tx.company.update({ where: { id: company.id }, data: { authVersion: { increment: 1 } } });
      const users = await tx.user.findMany({ where: { companyId: company.id }, select: { id: true, pinHash: true } });
      const target = users.find(user => user.id === req.params.userId);
      if (!target) throw fail(404, "İstifadəçi bu şirkətdə tapılmadı.");
      for (const user of users)
        if (user.id !== target.id && user.pinHash && await bcrypt.compare(pin, user.pinHash))
          throw fail(409, "Bu PIN şirkətdə başqa işçiyə aiddir.");
      await tx.user.update({ where: { id: target.id }, data: { pinHash, authVersion: { increment: 1 } } });
      await tx.auditEvent.create({data:{companyId:company.id,entityType:"Company",entityId:company.id,actorName:"Platform operator",action:"COMPANY_PIN_RESET",reason:"Worker PIN reset",before:{userId:target.id},after:{userId:target.id,sessionsRevoked:true}}});
    }, { isolationLevel: "Serializable", timeout: 30000 });
    res.json({ message: "PIN yeniləndi. Bu şirkətin köhnə sessiyaları bağlandı." });
  }));
};
