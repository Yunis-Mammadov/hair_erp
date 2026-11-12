const { Router } = require("express");
const { platformPrisma: db, prisma } = require("../prismaClient");
const { requireRole } = require("../middleware/auth.middleware");
const { publicCompany } = require("../config/plans");
const { normalizeUploadUrl } = require("../upload-access");
const F = require("../financial-core"), W = require("../workspace-core"), R = require("../records-core");
const router = Router();
async function hasActivity(tx, companyId) {
  for (const model of ["order", "purchase", "payment", "return"])
    if (await tx[model].findFirst({ where: { companyId }, select: { id: true } })) return true;
  return false;
}
router.get("/settings", R.route(async (req, res) => {
  res.json({ company: publicCompany(req.company), currencyLocked: await hasActivity(db, req.company.id), currencies: W.currencies });
}));
router.patch("/settings", requireRole("ADMIN"), R.route(async (req, res) => {
  const input = req.body;
  const allowed = ["name", "currency", "timezone", "address", "phone", "taxId", "invoicePrefix", "supportEmail", "logoUrl"];
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw F.fail(400, "Check the company settings.");
  const data = {};
  for (const key of Object.keys(input)) {
    if (key === "phone") data[key] = W.phone(input[key]);
    else if (key === "logoUrl") data[key] = input[key] ? normalizeUploadUrl(input[key], req.company) : null;
    else data[key] = F.text(input[key], key === "address" ? 500 : 150);
  }
  if ("name" in data && (!data.name || data.name.length < 2)) throw F.fail(400, "Company name must contain at least two characters.");
  if ("currency" in data && !W.currencies.includes(data.currency)) throw F.fail(400, "Choose a supported currency.");
  if ("timezone" in data && !W.validTimezone(data.timezone)) throw F.fail(400, "Choose a valid time zone.");
  if ("supportEmail" in data && data.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.supportEmail)) throw F.fail(400, "Enter a valid contact email.");
  if ("invoicePrefix" in data) { data.invoicePrefix = (data.invoicePrefix || "").toUpperCase(); if (!/^[A-Z0-9-]{0,12}$/.test(data.invoicePrefix)) throw F.fail(400, "Invoice prefix may contain up to 12 letters, digits or hyphens."); }
  if ("currency" in data) data.currencyConfigured = true;
  let company;
  for (let attempt = 0; ; attempt++) {
    try {
      company = await db.$transaction(async tx => {
        const current = await tx.company.findUniqueOrThrow({ where: { id: req.company.id } });
        await tx.invoiceCounter.upsert({ where: { companyId: current.id }, create: { companyId: current.id, value: 0, currency: current.currency }, update: { value: { increment: 0 } } });
        if (data.currency && data.currency !== current.currency && await hasActivity(tx, current.id)) throw F.fail(409, "Currency is locked because this company already has financial records.", "CURRENCY_LOCKED");
        if (data.currency) await tx.invoiceCounter.update({ where: { companyId: current.id }, data: { currency: data.currency } });
        return tx.company.update({ where: { id: current.id }, data });
      }, { isolationLevel: "Serializable", timeout: 20000 });
      break;
    } catch (e) { if (attempt < 5 && ["P2034", "P2002"].includes(e.code)) continue; throw e; }
  }
  res.json({ company: publicCompany(company), currencyLocked: await hasActivity(db, company.id) });
}));
router.get("/onboarding", requireRole("ADMIN"), R.route(async (req, res) => {
  const [products, stock, sales, locked] = await Promise.all([prisma.product.count({ where: { archivedAt: null } }), prisma.stock.count({ where: { quantity: { gt: 0 } } }), prisma.order.count(), hasActivity(db, req.company.id)]);
  res.json({ currencyConfigured: req.company.currencyConfigured || locked, products, stock, sales });
}));
module.exports = router;
