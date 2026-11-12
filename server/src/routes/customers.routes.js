const {log}=require("../ops/runtime");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { hasFeature } = require("../config/plans");
const F = require("../financial-core");
const W = require("../workspace-core");
const R = require("../records-core");
const router = express.Router();
const customerInclude = {
  area: true,
  assignedExpeditor: { select: R.personSelect },
};
const returnInclude = {
  items: { include: { product: { include: { category: true } } } },
  createdBy: { select: R.personSelect },
};
const paymentInclude = {
  soldItems: { include: { product: true } },
  createdBy: { select: R.personSelect },
};
router.use(requireAuth);
router.get(
  "/lookup",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  R.route(async (req, res) => {
    const p = R.page({ ...req.query, limit: req.query.limit ?? 20 });
    const where = R.customerWhere(req);
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: customerInclude,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ customers, pagination: R.pagination(p, total) });
  }),
);
router.get(
  "/",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  R.route(async (req, res) => {
    const p = R.page(req.query),
      where = R.customerWhere(req);
    const result = await prisma.$transaction(
      async (tx) => {
        const [customers, total] = await Promise.all([
          tx.customer.findMany({
            where,
            include: customerInclude,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: p.skip,
            take: p.take,
          }),
          tx.customer.count({ where }),
        ]);
        const totals = await R.summaries(
          tx,
          customers.map((c) => c.id),
        );
        return {
          customers: customers.map((c) => ({
            ...c,
            summary: totals.get(c.id),
          })),
          pagination: R.pagination(p, total),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    res.json(result);
  }),
);
async function related(tx, req, customerId, kind, p) {
  const config = {
    orders: { model: "order", include: R.orderInclude },
    returns: { model: "return", include: returnInclude },
    payments: { model: "payment", include: paymentInclude },
    refunds: { model: "customerRefund", include: { createdBy: {select:R.personSelect} } },
  }[kind];
  if (!config) throw F.fail(404, "Tarixçə tapılmadı.");
  const [rows, total] = await Promise.all([
    tx[config.model].findMany({
      where: { customerId },
      include: config.include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: p.skip,
      take: p.take,
    }),
    tx[config.model].count({ where: { customerId } }),
  ]);
  if (kind === "orders") {
    const amounts = await R.orderFinancials(tx, customerId);
    return {
      orders: rows.map((o) => ({ ...R.presentOrder(o), ...amounts.get(o.id) })),
      pagination: R.pagination(p, total),
    };
  }
  return { [kind]: rows, pagination: R.pagination(p, total) };
}
router.get(
  "/:id/returnable-products",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  R.route(async (req, res) => {
    const customerId = F.id(req.params.id),
      p = R.page(req.query);
    await R.allowedCustomer(prisma, req, customerId);
    const where = {
      orderItems: { some: { isGift: false, order: { customerId } } },
    };
    const search = F.text(req.query.search, 150);
    if (search)
      where.OR = ["name", "sku", "barcode"].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    const result = await prisma.$transaction(
      async (tx) => {
        const [products, total] = await Promise.all([
          tx.product.findMany({
            where,
            include: { category: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            skip: p.skip,
            take: p.take,
          }),
          tx.product.count({ where }),
        ]);
        const productIds = products.map((p) => p.id);
        const [ordered, sold] = await Promise.all([
          tx.orderItem.groupBy({
            by: ["productId"],
            where: {
              productId: { in: productIds },
              isGift: false,
              order: { customerId },
            },
            _sum: { quantity: true, returnedQty: true },
          }),
          tx.paymentSoldItem.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds }, payment: { customerId, voidedAt: null } },
            _sum: { quantity: true },
          }),
        ]);
        const orderMap = new Map(ordered.map((o) => [o.productId, o._sum])),
          soldMap = new Map(
            sold.map((o) => [o.productId, o._sum.quantity || 0]),
          );
        return {
          products: products.map((product) => {
            const order = orderMap.get(product.id) || {},
              soldQty = soldMap.get(product.id) || 0;
            return {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              categoryName: product.category.name,
              totalQty: order.quantity || 0,
              returnedQty: order.returnedQty || 0,
              soldQty,
              returnableQty: Math.max(
                (order.quantity || 0) - (order.returnedQty || 0) - soldQty,
                0,
              ),
            };
          }),
          pagination: R.pagination(p, total),
          summary: await F.account(tx, customerId),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    res.json(result);
  }),
);
router.get("/:id/profile", requireRole("ADMIN","EXPEDITOR","WAREHOUSE"), R.route(async(req,res)=>{
 const id=F.id(req.params.id);res.json(await prisma.$transaction(async tx=>({customer:await R.allowedCustomer(tx,req,id),summary:await F.account(tx,id)}),{isolationLevel:"RepeatableRead"}));
}));
router.get("/:id/summary", requireRole("ADMIN","EXPEDITOR","WAREHOUSE"), R.route(async (req,res)=>{
 const id=F.id(req.params.id);res.json(await prisma.$transaction(async tx=>{await R.allowedCustomer(tx,req,id);return {summary:await F.account(tx,id)};},{isolationLevel:"RepeatableRead"}));
}));
router.get(
  "/:id/:kind",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  R.route(async (req, res) => {
    const customerId = F.id(req.params.id);
    await R.allowedCustomer(prisma, req, customerId);
    const result = await prisma.$transaction(
      async (tx) => ({
        ...(await related(
          tx,
          req,
          customerId,
          req.params.kind,
          R.page(req.query),
        )),
        summary: await F.account(tx, customerId),
      }),
      { isolationLevel: "RepeatableRead" },
    );
    res.json(result);
  }),
);
router.get(
  "/:id",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  R.route(async (req, res) => {
    const customerId = F.id(req.params.id),
      p = R.page({ ...req.query, limit: req.query.limit ?? 25 });
    const result = await prisma.$transaction(
      async (tx) => {
        const customer = await R.allowedCustomer(tx, req, customerId),
          summary = await F.account(tx, customerId);
        const [orders, returns, payments, refunds] = await Promise.all([
          related(tx, req, customerId, "orders", p),
          related(tx, req, customerId, "returns", p),
          related(tx, req, customerId, "payments", p),
          related(tx, req, customerId, "refunds", p),
        ]);
        return {
          customer: {
            ...customer,
            summary,
            orders: orders.orders,
            returns: returns.returns,
            payments: payments.payments,
            refunds: refunds.refunds,
          },
          summary,
          pagination: {
            orders: orders.pagination,
            returns: returns.pagination,
            payments: payments.pagination,
            refunds: refunds.pagination,
          },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    res.json(result);
  }),
);

// POST /customers
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const input = W.customerData(req.body);
      await W.checkArea(prisma, input.areaId);
      const customer = await prisma.customer.create({
        data: {
          ...input,
          assignedExpeditorId:
            hasFeature(req.company, "customerAssignments") &&
            req.user.role === "EXPEDITOR"
              ? req.user.userId
              : null,
        },
        include: {
          area: true,
          assignedExpeditor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return res.status(201).json({ customer });
    } catch (error) {
      log("Create customer error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      return F.errorResponse(res, error);
    }
  },
);

// PUT /customers/:id
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const isExpeditor =
        hasFeature(req.company, "customerAssignments") &&
        req.user.role === "EXPEDITOR";

      const {
        name,
        phone,
        salon,
        address,
        lat,
        lng,
        areaId,
        assignedExpeditorId,
        isProblematic,
        problemNote,
      } = req.body;

      const where = { id };

      if (isExpeditor) {
        where.assignedExpeditorId = req.user.userId;
      }

      const existingCustomer = await prisma.customer.findFirst({ where });

      if (!existingCustomer) {
        return res.status(404).json({ message: "Müştəri tapılmadı" });
      }

      let finalAreaId = existingCustomer.areaId || null;

      if (areaId !== undefined) {
        finalAreaId = areaId ? F.id(areaId) : null;
        await W.checkArea(prisma, finalAreaId);
      }

      const updateData = { areaId: finalAreaId };
      for (const field of ["name", "phone", "salon", "address"])
        if (req.body[field] !== undefined) {
          updateData[field] = field === "phone" ? W.phone(req.body[field]) : F.text(
            req.body[field],
            field === "address" ? 500 : 150,
          );
          if (
            field === "name" &&
            (!updateData.name || updateData.name.length < 2)
          )
            return res
              .status(400)
              .json({ message: "Müştəri adı ən azı iki simvol olmalıdır." });
        }
      if (lat !== undefined || lng !== undefined) Object.assign(updateData, W.coordinates(lat, lng));
      if (assignedExpeditorId !== undefined) {
        if (!hasFeature(req.company, "customerAssignments"))
          return res
            .status(403)
            .json({ message: "Müştəri təyinatı Business paketindədir." });
        if (req.user.role !== "ADMIN")
          return res
            .status(403)
            .json({ message: "Müştəri təyinatını yalnız admin dəyişə bilər." });
        if (assignedExpeditorId !== null && assignedExpeditorId !== "") {
          const worker = await prisma.user.findFirst({
            where: {
              id: assignedExpeditorId,
              role: "EXPEDITOR",
              isActive: true,
            },
            select: { id: true },
          });
          if (!worker)
            return res.status(400).json({ message: "Ekspeditor tapılmadı." });
          updateData.assignedExpeditorId = worker.id;
        } else updateData.assignedExpeditorId = null;
      }

      if (isProblematic !== undefined) {
        updateData.isProblematic = Boolean(isProblematic);
      }

      if (problemNote !== undefined) {
        updateData.problemNote = problemNote
          ? String(problemNote).trim()
          : null;
      }

      if (isProblematic === true) {
        updateData.problemMarkedAt = new Date();
      }

      if (isProblematic === false) {
        updateData.problemMarkedAt = null;
      }

      const customer = await prisma.customer.update({
        where: { id },
        data: updateData,
        include: {
          area: true,
          assignedExpeditor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return res.json({ customer });
    } catch (error) {
      log("Update customer error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      return F.errorResponse(res, error);
    }
  },
);

// Test-data reset is deliberately unavailable in the application API.

module.exports = router;
