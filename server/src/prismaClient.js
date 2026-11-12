const { PrismaClient, Prisma } = require("@prisma/client");
const { getCompanyId } = require("./tenant-context");
// Reject an old generated client before accepting business requests.
const requiredFields={Company:["timezone","logoUrl"],Payment:["orderId","voidedAt"],CustomerRefund:["amount"],BillingEvent:["state"]};
for(const [name,fields]of Object.entries(requiredFields)){
 const model=Prisma.dmmf.datamodel.models.find(m=>m.name===name);
 if(fields.some(field=>!model?.fields.some(f=>f.name===field)))throw new Error("Prisma Client is out of date. Stop the backend, run npx prisma generate in server, then restart it.");
}
// Only authentication and local company management use the unscoped client.
const platformPrisma = new PrismaClient();
const tenantModels = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.name !== "Company")
    .map((model) => model.name),
);
const modelFields = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    new Map(model.fields.map((field) => [field.name, field])),
  ]),
);
const nestedChildren = {
  Order: { items: "OrderItem" },
  Purchase: { items: "PurchaseItem" },
  Return: { items: "ReturnItem" },
  Payment: { soldItems: "PaymentSoldItem" },
};
const filteredOperations = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
function checkedData(model, data, companyId, isCreate, nested = false) {
  if (Array.isArray(data))
    return data.map((entry) =>
      checkedData(model, entry, companyId, isCreate, nested),
    );
  if (!data || typeof data !== "object")
    throw new Error("Yanlış yazma məlumatı.");
  const result = { ...data };
  if (Object.hasOwn(result, "companyId") && result.companyId !== companyId)
    throw new Error("Şirkəti dəyişmək olmaz.");
  delete result.companyId;
  for (const [key, value] of Object.entries(result)) {
    const field = modelFields.get(model)?.get(key);
    if (field?.kind !== "object") continue;
    const child = nestedChildren[model]?.[key];
    // Scalar IDs plus composite foreign keys enforce relation ownership.
    // These are the only nested writes used by the existing application.
    if (
      !isCreate ||
      !child ||
      !value ||
      Object.keys(value).some(
        (operation) => !["create", "createMany"].includes(operation),
      )
    )
      throw new Error("Bu əlaqə əməliyyatı şirkət sərhədini poza bilər.");
    const relation = { ...value };
    if (relation.create)
      relation.create = checkedData(
        child,
        relation.create,
        companyId,
        true,
        true,
      );
    if (relation.createMany)
      relation.createMany = {
        ...relation.createMany,
        data: checkedData(
          child,
          relation.createMany.data,
          companyId,
          true,
          true,
        ),
      };
    result[key] = relation;
  }
  // A nested child inherits companyId from the composite parent relation.
  if (isCreate && !nested) result.companyId = companyId;
  return result;
}
const scopedPrisma = platformPrisma.$extends({
  name: "company-isolation",
  query: {
    $allOperations({ model, operation, args, query }) {
      const companyId = getCompanyId();
      if (!model || !tenantModels.has(model))
        throw new Error("Bu sorğu şirkət daxilində icazəli deyil.");
      const next = { ...args };
      if (filteredOperations.has(operation))
        next.where = { ...next.where, companyId };
      else if (
        !["create", "createMany", "createManyAndReturn"].includes(operation)
      )
        throw new Error("Dəstəklənməyən şirkət sorğusu.");
      if (["create", "createMany", "createManyAndReturn"].includes(operation))
        next.data = checkedData(model, next.data, companyId, true);
      if (["update", "updateMany", "updateManyAndReturn"].includes(operation))
        next.data = checkedData(model, next.data, companyId, false);
      if (operation === "upsert") {
        next.create = checkedData(model, next.create, companyId, true);
        next.update = checkedData(model, next.update, companyId, false);
      }
      return query(next);
    },
  },
});
module.exports = { prisma: scopedPrisma, platformPrisma };