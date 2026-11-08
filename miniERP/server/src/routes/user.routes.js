const express = require("express");
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { PLANS, hasFeature } = require("../config/plans");
const router = express.Router();
const roles = ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"];
const userSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};
function problem(status, message) {
  return Object.assign(new Error(message), { status });
}
async function assertUniquePin(tx, pin, exceptId) {
  const users = await tx.user.findMany({ select: { id: true, pinHash: true } });
  for (const user of users)
    if (
      user.id !== exceptId &&
      user.pinHash &&
      (await bcrypt.compare(pin, user.pinHash))
    )
      throw problem(409, "Bu PIN şirkətdə başqa işçiyə aiddir.");
}
function replyError(error, res, next) {
  if (error.status)
    return res.status(error.status).json({ message: error.message });
  if (error.code === "P2034" || error.code === "P2002")
    return res
      .status(409)
      .json({
        message:
          "Paralel dəyişiklik və ya təkrarlanan e-poçt var. Yenidən yoxla.",
      });
  next(error);
}
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE", "DRIVER"),
  async (req, res, next) => {
    try {
      const role = req.query.role;
      if (role && !roles.includes(role))
        return res.status(400).json({ message: "Rol yanlışdır." });
      const users = await prisma.user.findMany({
        where: role ? { role } : {},
        orderBy: { fullName: "asc" },
        select: userSelect,
      });
      res.json({ users });
    } catch (error) {
      next(error);
    }
  },
);
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { fullName, pin, role, email } = req.body || {};
    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 2 ||
      fullName.length > 100 ||
      typeof pin !== "string" ||
      !/^\d{4,8}$/.test(pin) ||
      !roles.includes(role)
    )
      return res
        .status(400)
        .json({ message: "Adı, rolu və 4–8 rəqəmli PIN-i yoxla." });
    if (email != null && (typeof email !== "string" || email.length > 254))
      return res.status(400).json({ message: "E-poçt yanlışdır." });
    if (role === "DRIVER" && !hasFeature(req.company, "delivery"))
      return res
        .status(403)
        .json({ message: "Sürücü hesabı Premium paketindədir." });
    const pinHash = await bcrypt.hash(pin, 12);
    const user = await prisma.$transaction(
      async (tx) => {
        if (
          (await tx.user.count({ where: { isActive: true } })) >=
          PLANS[req.company.plan].maxUsers
        )
          throw problem(409, "Paketin aktiv istifadəçi limiti dolub.");
        await assertUniquePin(tx, pin);
        return tx.user.create({
          data: {
            fullName: fullName.trim(),
            pinHash,
            role,
            email: email?.trim().toLowerCase() || null,
          },
          select: userSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      },
    );
    res.status(201).json({ user });
  } catch (error) {
    replyError(error, res, next);
  }
});
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = req.body || {};
      if (
        Object.keys(body).some(
          (key) =>
            !["fullName", "email", "role", "pin", "isActive"].includes(key),
        )
      )
        return res
          .status(400)
          .json({ message: "Dəyişdirilə bilməyən sahə göndərilib." });
      if (
        body.pin !== undefined &&
        (typeof body.pin !== "string" || !/^\d{4,8}$/.test(body.pin))
      )
        return res.status(400).json({ message: "PIN 4–8 rəqəm olmalıdır." });
      if (body.role !== undefined && !roles.includes(body.role))
        return res.status(400).json({ message: "Rol yanlışdır." });
      if (body.isActive !== undefined && typeof body.isActive !== "boolean")
        return res.status(400).json({ message: "isActive boolean olmalıdır." });
      if (
        body.fullName !== undefined &&
        (typeof body.fullName !== "string" ||
          body.fullName.trim().length < 2 ||
          body.fullName.length > 100)
      )
        return res.status(400).json({ message: "Adı yoxla." });
      if (
        body.email !== undefined &&
        body.email !== null &&
        (typeof body.email !== "string" || body.email.length > 254)
      )
        return res.status(400).json({ message: "E-poçtu yoxla." });
      if (
        req.params.id === req.user.id &&
        (body.isActive === false || (body.role && body.role !== "ADMIN"))
      )
        return res
          .status(400)
          .json({
            message:
              "Öz admin hesabını deaktiv etmək və ya rolunu azaltmaq olmaz.",
          });
      const pinHash = body.pin ? await bcrypt.hash(body.pin, 12) : undefined;
      const user = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.user.findUnique({
            where: { id: req.params.id },
          });
          if (!existing) throw problem(404, "İstifadəçi tapılmadı.");
          const active = body.isActive ?? existing.isActive;
          if (
            active &&
            (body.role || existing.role) === "DRIVER" &&
            !hasFeature(req.company, "delivery")
          )
            throw problem(403, "Sürücü hesabı Premium paketindədir.");
          if (
            active &&
            !existing.isActive &&
            (await tx.user.count({ where: { isActive: true } })) >=
              PLANS[req.company.plan].maxUsers
          )
            throw problem(409, "Paketin aktiv istifadəçi limiti dolub.");
          if (body.pin) await assertUniquePin(tx, body.pin, existing.id);
          const data = { authVersion: { increment: 1 } };
          for (const key of ["role", "isActive"])
            if (body[key] !== undefined) data[key] = body[key];
          if (body.fullName !== undefined) data.fullName = body.fullName.trim();
          if (body.email !== undefined)
            data.email = body.email?.trim().toLowerCase() || null;
          if (pinHash) data.pinHash = pinHash;
          return tx.user.update({
            where: { id: existing.id },
            data,
            select: userSelect,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 20000,
        },
      );
      res.json({ user });
    } catch (error) {
      replyError(error, res, next);
    }
  },
);
module.exports = router;