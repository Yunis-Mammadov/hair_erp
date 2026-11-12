const F = require("./financial-core");
const { hasFeature } = require("./config/plans");
const personSelect = { id: true, fullName: true, role: true };
const orderInclude = {
  area: true,
  customer: true,
  createdBy: { select: personSelect },
  items: {
    include: {
      product: { include: { category: true, stock: true } },
      returnItems: true,
    },
  },
};
function page(query) {
  const number = F.integer(query.page ?? 1, 1, 1000000),
    limit = F.integer(query.limit ?? 25, 1, 100);
  return { page: number, limit, skip: (number - 1) * limit, take: limit };
}
const pagination = (p, total) => ({
  page: p.page,
  limit: p.limit,
  total,
  totalPages: Math.ceil(total / p.limit),
});
const route = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else next(error);
  }
};
function customerWhere(req) {
  const where = {};
  if (
    hasFeature(req.company, "customerAssignments") &&
    req.user.role === "EXPEDITOR"
  )
    where.assignedExpeditorId = req.user.id;
  else if (
    hasFeature(req.company, "customerAssignments") &&
    req.query.expeditorId
  )
    where.assignedExpeditorId = F.id(req.query.expeditorId);
  const search = F.text(req.query.search, 150);
  if (search)
    where.OR = ["name", "phone", "salon", "address"].map((field) => ({
      [field]: { contains: search, mode: "insensitive" },
    }));
  return where;
}
async function allowedCustomer(tx, req, id) {
  const customer = await tx.customer.findFirst({
    where: { ...customerWhere({ ...req, query: {} }), id },
    include: { area: true, assignedExpeditor: { select: personSelect } },
  });
  if (!customer) throw F.fail(404, "Müştəri tapılmadı.");
  return customer;
}
async function summaries(tx, ids) {
 const where={customerId:{in:ids}};
 const groups=await Promise.all([
  tx.order.groupBy({by:["customerId"],where,_sum:{totalAmount:true},_count:true}),
  tx.return.groupBy({by:["customerId"],where,_sum:{totalAmount:true},_count:true}),
  tx.payment.groupBy({by:["customerId"],where:{...where,voidedAt:null},_sum:{amount:true},_count:true}),
  tx.customerRefund.groupBy({by:["customerId"],where,_sum:{amount:true},_count:true}),
 ]);
 const maps=groups.map(rows=>new Map(rows.map(row=>[row.customerId,row])));
 return new Map(ids.map(id=>{const [o,r,p,f]=maps.map(m=>m.get(id));return [id,F.totals(o?._sum.totalAmount,r?._sum.totalAmount,p?._sum.amount,o?._count,r?._count,p?._count,f?._sum.amount,f?._count)];}));
}
function customerSnapshot(c) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    salon: c.salon,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    areaName: c.area?.name || null,
  };
}
function companySnapshot(req) {
  return {
    name: req.company.name,
    currency: req.company.currency,
    timezone: req.company.timezone,
    address: req.company.address,
    phone: req.company.phone,
    taxId: req.company.taxId,
    logoUrl: req.company.logoUrl,
    issuedBy: req.user.fullName,
    issuedByRole: req.user.role,
  };
}
function presentOrder(order) {
  if (!order) return order;
  return {
    ...order,
    customer: order.customerSnapshot
      ? { ...order.customer, ...order.customerSnapshot }
      : order.customer,
    createdBy: order.companySnapshot?.issuedBy
      ? {
          ...order.createdBy,
          fullName: order.companySnapshot.issuedBy,
          role: order.companySnapshot.issuedByRole || order.createdBy?.role,
        }
      : order.createdBy,
    items: order.items?.map((item) => ({
      ...item,
      product: {
        ...item.product,
        name: item.productName ?? item.product?.name,
        sku: Object.hasOwn(item, "productSku")
          ? item.productSku
          : item.product?.sku,
        category: {
          ...item.product?.category,
          name: item.categoryName ?? item.product?.category?.name,
        },
      },
    })),
  };
}
async function nextInvoice(tx, companyId, prefix = "") {
  const current = await tx.invoiceCounter.findUnique({ where: { companyId } });
  let counter;
  if (current)
    counter = await tx.invoiceCounter.update({
      where: { companyId },
      data: { value: { increment: 1 } },
    });
  else {
    const existing = await tx.order.aggregate({ _max: { orderNumber: true } });
    counter = await tx.invoiceCounter.create({
      data: { value: (existing._max.orderNumber || 0) + 1 },
    });
  }
  return {
    orderNumber: counter.value,
    invoiceNumber: prefix + String(counter.value).padStart(5, "0"),
  };
}
function itemSnapshots(items, products, previous = []) {
  const map = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = map.get(item.productId),
      old = previous.find((p) => p.productId === item.productId);
    return {
      ...item,
      productName: old?.productName ?? product.name,
      productSku:
        old && Object.hasOwn(old, "productSku") ? old.productSku : product.sku,
      categoryName: old?.categoryName ?? product.category?.name,
    };
  });
}
function documentTotal(items) {
  const total = items.reduce(
    (n, item) =>
      n + (item.isGift ? 0 : F.minor(item.unitPrice) * item.quantity),
    0,
  );
  if (!Number.isSafeInteger(total) || total > 999999999999)
    throw F.fail(400, "Sənəd məbləği həddi aşır.");
  return F.major(total);
}
async function orderFinancials(tx, customerId) {
 const [orders,returns,payments,refunds]=await Promise.all([
  tx.order.findMany({where:{customerId},select:{id:true,totalAmount:true,createdAt:true},orderBy:[{createdAt:"asc"},{id:"asc"}]}),
  tx.returnItem.findMany({where:{returnDoc:{customerId}},select:{orderItemId:true,quantity:true,unitPrice:true,orderItem:{select:{orderId:true}}}}),
  tx.payment.findMany({where:{customerId,voidedAt:null},select:{orderId:true,amount:true}}),
  tx.customerRefund.aggregate({where:{customerId},_sum:{amount:true}}),
 ]);
 const linkedReturns=new Map(), linkedPayments=new Map();let legacy=0;
 for(const r of returns){const n=F.minor(r.unitPrice)*r.quantity;if(r.orderItemId)linkedReturns.set(r.orderItem.orderId,(linkedReturns.get(r.orderItem.orderId)||0)+n);else legacy+=n;}
 for(const p of payments)if(p.orderId)linkedPayments.set(p.orderId,(linkedPayments.get(p.orderId)||0)+F.minor(p.amount));
 let pool=payments.reduce((n,p)=>n+F.minor(p.amount),0)-F.minor(refunds._sum.amount);
 const rows=orders.map(order=>{const total=F.minor(order.totalAmount);let ret=Math.min(total,linkedReturns.get(order.id)||0);const extra=Math.min(legacy,Math.max(total-ret,0));legacy-=extra;ret+=extra;const paid=Math.min(Math.max(total-ret,0),linkedPayments.get(order.id)||0,Math.max(pool,0));pool-=paid;return {id:order.id,total,ret,paid};});
 return new Map(rows.map(row=>{const extra=Math.min(Math.max(pool,0),Math.max(row.total-row.ret-row.paid,0));pool-=extra;row.paid+=extra;const debt=Math.max(row.total-row.ret-row.paid,0);return [row.id,{totalAmount:F.major(row.total),allocatedReturn:F.major(row.ret),allocatedPayment:F.major(row.paid),remainingDebt:F.major(debt),financialStatus:debt===0?"ODENIB":row.paid||row.ret?"QISMEN_ODENIB":"BORCLU"}];}));
}
module.exports = {
  personSelect,
  orderInclude,
  page,
  pagination,
  route,
  customerWhere,
  allowedCustomer,
  summaries,
  customerSnapshot,
  companySnapshot,
  presentOrder,
  nextInvoice,
  itemSnapshots,
  documentTotal,
  orderFinancials,
};
