const { AsyncLocalStorage } = require("node:async_hooks");
const tenantContext = new AsyncLocalStorage();
function runWithCompany(companyId, callback) {
  if (!companyId || typeof companyId !== "string")
    throw new Error("Şirkət konteksti yoxdur.");
  return tenantContext.run({ companyId }, callback);
}
function getCompanyId() {
  const companyId = tenantContext.getStore()?.companyId;
  if (!companyId)
    throw new Error("Şirkətsiz verilənlər bazası sorğusu bloklandı.");
  return companyId;
}
module.exports = { runWithCompany, getCompanyId };