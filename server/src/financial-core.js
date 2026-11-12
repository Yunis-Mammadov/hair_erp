const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { prisma } = require("./prismaClient");
const { hasFeature } = require("./config/plans");

function fail(statusCode, message, code = "INVALID_INPUT") {
  return Object.assign(new Error(message), { statusCode, code });
}
function integer(value, min = 1, max = 1000000) {
  if (
    !["number", "string"].includes(typeof value) ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw fail(400, `Miqdar ${min}–${max} aralığında tam ədəd olmalıdır.`);
  return Number(value);
}
function money(value, zero = false) {
  if (
    !["number", "string"].includes(typeof value) ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value))
  )
    throw fail(400, "Məbləğ ən çox iki onluq rəqəmlə yazılmalıdır.");
  const cents = Math.round(Number(value) * 100);
  if (
    !Number.isSafeInteger(cents) ||
    cents < (zero ? 0 : 1) ||
    cents > 9999999999
  )
    throw fail(400, "Məbləğ icazə verilən həddi aşır.");
  return cents / 100;
}
const minor = (value) =>
  new Prisma.Decimal(value ?? 0).mul(100).toDecimalPlaces(0).toNumber();
const major = (value) => value / 100;
function id(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 100)
    throw fail(400, "Məlumatın ID-si yanlışdır.");
  return value.trim();
}
function text(value, max = 1000) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > max)
    throw fail(400, "Mətn sahəsini yoxla.");
  return value.trim() || null;
}
function lines(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    throw fail(400, "1–100 məhsul sətri göndərilməlidir.");
  if (
    items.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  )
    throw fail(400, "Məhsul sətrini yoxla.");
  return items;
}
function combine(items) {
  const map = new Map();
  for (const item of lines(items)) {
    const productId = id(item?.productId);
    map.set(
      productId,
      integer((map.get(productId) || 0) + integer(item.quantity)),
    );
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
async function transaction(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (attempt < 5 && ["P2034", "P2002"].includes(error.code)) {
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.random() * 40),
        );
        continue;
      }
      throw error;
    }
  }
}
async function lockWorkspace(tx, req) {
  const counter = await tx.invoiceCounter.upsert({
    where: { companyId: req.company.id },
    create: { value: 0, currency: req.company.currency },
    update: { value: { increment: 0 } },
  });
  const displayed = req.get("X-Workspace-Currency");
  if ((displayed && displayed !== req.company.currency) || (counter.currency && counter.currency !== req.company.currency))
    throw fail(409, "Company currency changed. Refresh the page before continuing.", "WORKSPACE_CHANGED");
  if (!counter.currency) await tx.invoiceCounter.update({ where: { companyId: req.company.id }, data: { currency: req.company.currency } });
}
async function mutate(req, scope, input, fn) {
  const key = req.get("Idempotency-Key") || req.body?.requestId;
  if (typeof key !== "string" || !/^[a-zA-Z0-9._:-]{8,120}$/.test(key))
    throw fail(
      400,
      "Bu əməliyyat üçün Idempotency-Key tələb olunur.",
      "REQUEST_KEY_REQUIRED",
    );
  const hash = createHash("sha256")
    .update(JSON.stringify(canonical({ input, actor: req.user.id })))
    .digest("hex");
  return transaction(async (tx) => {
    await lockWorkspace(tx, req);
    const existing = await tx.operationRequest.findUnique({
      where: { companyId_scope_key: { companyId: req.company.id, scope, key } },
    });
    if (existing) {
      if (existing.hash !== hash)
        throw fail(
          409,
          "Bu əməliyyat açarı başqa məlumat üçün istifadə edilib.",
          "REQUEST_CONFLICT",
        );
      return { ...existing.response, replayed: true };
    }
    const response = JSON.parse(
      JSON.stringify({ ...(await fn(tx)), replayed: false }),
    );
    await tx.operationRequest.create({ data: { scope, key, hash, response } });
    return response;
  });
}
async function lockCustomer(tx, customerId, req) {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    include: { area: true },
  });
  if (!customer) throw fail(404, "Müştəri tapılmadı.");
  if (
    hasFeature(req.company, "customerAssignments") &&
    req.user.role === "EXPEDITOR" &&
    customer.assignedExpeditorId !== req.user.id
  )
    throw fail(403, "Bu müştəri başqa ekspeditora təyin edilib.");
  // All sales, edits, collections and returns for this customer share a lock.
  await tx.customer.update({
    where: { id: customerId },
    data: { updatedAt: new Date() },
  });
  return customer;
}
async function moveStock(tx, productId, delta, details = {}) {
  await tx.stock.upsert({
    where: { productId },
    create: { productId, quantity: 0 },
    update: {},
  });
  const updated = await tx.stock.updateMany({
    where: {
      productId,
      quantity: delta < 0 ? { gte: -delta } : { lte: 1000000000 - delta },
    },
    data: { quantity: { increment: delta }, version: { increment: 1 } },
  });
  if (updated.count !== 1)
    throw fail(
      409,
      "Stok kifayət etmir və ya maksimum miqdar həddi aşılır.",
      "INSUFFICIENT_STOCK",
    );
  const stock = await tx.stock.findUnique({ where: { productId } });
  await tx.stockMovement.create({
    data: {
      productId,
      userId: details.user?.id || null,
      actorName: details.user?.fullName || "Sistem",
      kind: details.kind || "ADJUSTMENT",
      delta,
      before: stock.quantity - delta,
      after: stock.quantity,
      reason: details.reason || "Stok əməliyyatı",
      documentId: details.documentId || null,
    },
  });
  if (delta > 0 && details.kind === "RETURN")
    await tx.product.update({
      where: { id: productId },
      data: { archivedAt: null },
    });
  return stock;
}
function summary(customer) {
 const orders=customer.orders||[],returns=customer.returns||[],payments=(customer.payments||[]).filter(p=>!p.voidedAt),refunds=customer.refunds||[];
 const orderAmount=orders.reduce((n,o)=>n+o.items.reduce((v,i)=>v+(i.isGift?0:minor(i.unitPrice)*i.quantity),0),0);
 const returnAmount=returns.reduce((n,r)=>n+r.items.reduce((v,i)=>v+minor(i.unitPrice)*i.quantity,0),0);
 return totals(major(orderAmount),major(returnAmount),major(payments.reduce((n,p)=>n+minor(p.amount),0)),orders.length,returns.length,payments.length,major(refunds.reduce((n,r)=>n+minor(r.amount),0)),refunds.length);
}
async function account(tx, customerId) {
  const [orders, returns, payments, refunds] = await Promise.all([
    tx.order.aggregate({
      where: { customerId },
      _sum: { totalAmount: true },
      _count: true,
    }),
    tx.return.aggregate({
      where: { customerId },
      _sum: { totalAmount: true },
      _count: true,
    }),
    tx.payment.aggregate({
      where: { customerId, voidedAt: null },
      _sum: { amount: true },
      _count: true,
    }),
    tx.customerRefund.aggregate({ where: {customerId}, _sum:{amount:true}, _count:true }),
  ]);
  return totals(
    orders._sum.totalAmount,
    returns._sum.totalAmount,
    payments._sum.amount,
    orders._count,
    returns._count,
    payments._count,
    refunds._sum.amount,
    refunds._count,
  );
}
function totals(
  orderAmount,
  returnAmount,
  paymentAmount,
  ordersCount = 0,
  returnsCount = 0,
  paymentsCount = 0,
  refundAmount = 0,
  refundsCount = 0,
) {
  const orderTotal = minor(orderAmount),
    returnTotal = minor(returnAmount),
    paymentTotal = minor(paymentAmount),
    refundTotal = minor(refundAmount),
    net = orderTotal - returnTotal - paymentTotal + refundTotal;
  if (![orderTotal, returnTotal, paymentTotal, net].every(Number.isSafeInteger))
    throw fail(409, "Hesab məbləği həddi aşır.");
  return {
    orderTotal: major(orderTotal),
    returnTotal: major(returnTotal),
    paymentTotal: major(paymentTotal),
    netTotal: major(orderTotal - returnTotal),
    debt: major(Math.max(net, 0)),
    credit: major(Math.max(-net, 0)),
    ordersCount,
    returnsCount,
    paymentsCount,
    refundTotal: major(refundTotal),
    netPaidTotal: major(paymentTotal - refundTotal),
    refundsCount,
  };
}
async function returnable(tx, customerId, productId) {
  const [items, sold] = await Promise.all([
    tx.orderItem.findMany({
      where: { productId, isGift: false, order: { customerId } },
      orderBy: [{ order: { createdAt: "asc" } }, { id: "asc" }],
    }),
    tx.paymentSoldItem.aggregate({
      where: { productId, payment: { customerId, voidedAt: null } },
      _sum: { quantity: true },
    }),
  ]);
  const available = items.reduce(
    (n, item) => n + Math.max(item.quantity - item.returnedQty, 0),
    0,
  );
  return {
    items,
    sold: sold._sum.quantity || 0,
    available: Math.max(available - (sold._sum.quantity || 0), 0),
  };
}
function errorResponse(res, error) {
  const status =
    error.statusCode ||
    (["P2002", "P2034"].includes(error.code)
      ? 409
      : error.code === "P2025"
        ? 404
        : error.code === "P2003"
          ? 400
          : 500);
  if (status === 500) console.error("FINANCIAL_ERROR", error.name, error.code);
  return res.status(status).json({
    code: error.code || "REQUEST_ERROR",
    message:
      status === 500
        ? "Əməliyyat tamamlanmadı. Yenidən cəhd et."
        : status === 409 && !error.statusCode
          ? "Paralel dəyişiklik oldu. Eyni əməliyyat açarı ilə yenidən cəhd et."
          : error.message,
  });
}
module.exports = {
  fail,
  integer,
  money,
  minor,
  major,
  id,
  text,
  lines,
  combine,
  transaction,
  mutate,
  lockWorkspace,
  lockCustomer,
  moveStock,
  summary,
  account,
  totals,
  returnable,
  errorResponse,
};
