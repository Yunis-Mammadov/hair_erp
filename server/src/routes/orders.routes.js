const {log}=require("../ops/runtime");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const { hasFeature } = require("../config/plans");

const F = require("../financial-core");
const W = require("../workspace-core");
const { normalizeUploadUrl } = require("../upload-access");
const R = require("../records-core");

const router = express.Router();

const ALLOWED_PAYMENTS = ["REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];

function normalizeOrderItems(items) {
  const result = F.lines(items).map((item) => {
    if (item.isGift !== undefined && typeof item.isGift !== "boolean")
      throw F.fail(400, "isGift boolean olmalıdır.");
    const value = {
      productId: F.id(item.productId),
      quantity: F.integer(item.quantity),
      unitPrice: F.money(item.unitPrice, item.isGift === true),
      isGift: item.isGift === true,
    };
    if (value.isGift && value.unitPrice !== 0)
      throw F.fail(400, "Hədiyyənin qiyməti sıfır olmalıdır.");
    return value;
  });
  const total = result.reduce(
    (sum, item) => sum + F.minor(item.unitPrice) * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(total) || total > 999999999999)
    throw F.fail(400, "Satışın ümumi məbləği çox böyükdür.");
  return result;
}

async function ensureProductsExist(tx, productIds) {
  const uniqueIds = [...new Set(productIds)];

  const products = await tx.product.findMany({
    where: { id: { in: uniqueIds }, archivedAt: null },
    select: {
      id: true,
      name: true,
      salePrice: true,
      sku: true,
      category: { select: { name: true } },
    },
  });

  if (products.length !== uniqueIds.length) {
    const found = new Set(products.map((p) => p.id));
    const missing = uniqueIds.filter((id) => !found.has(id));

    const err = new Error(`Products not found: ${missing.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  return products;
}

async function giveBackStock(tx, items, details) {
  for (const item of [...items].sort((a, b) =>
    a.productId.localeCompare(b.productId),
  ))
    await F.moveStock(tx, item.productId, item.quantity, details);
}
async function decrementStockOrThrow(tx, items, details) {
  for (const item of [...items].sort((a, b) =>
    a.productId.localeCompare(b.productId),
  ))
    await F.moveStock(tx, item.productId, -item.quantity, details);
}

/**
 * GET /orders
 * Query:
 * ?page=1
 * &limit=10
 * &search=leyla
 * &paymentType=NAĞD
 * &startDate=2026-03-01
 * &endDate=2026-03-21
 * &expeditorId=xxxx
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const {
        page = "1",
        limit = "10",
        search = "",
        paymentType = "",
        startDate = "",
        endDate = "",
        expeditorId = "",
      } = req.query;

      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      const skip = (pageNumber - 1) * limitNumber;

      const where = {};

      if (req.user.role === "EXPEDITOR") {
        where.createdById = req.user.userId;
      } else {
        if (
          hasFeature(req.company, "teamManagement") &&
          expeditorId &&
          String(expeditorId).trim()
        ) {
          where.createdById = String(expeditorId).trim();
        }
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.OR = [
          {
            customer: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { salon: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          {
            area: {
              name: { contains: q, mode: "insensitive" },
            },
          },
        ];
      }

      if (paymentType && String(paymentType).trim()) {
        where.paymentType = String(paymentType).trim();
      }

      if (startDate || endDate) where.createdAt = W.dateRange(startDate, endDate, req.company.timezone);

      const [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: { createdAt: "desc" },
          include: {
            area: true,
            customer: true,
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        }),
        prisma.order.count({ where }),
      ]);

      const amounts=new Map();
      for(const customerId of new Set(orders.map(o=>o.customerId)))for(const [id,value]of await R.orderFinancials(prisma,customerId))amounts.set(id,value);
      res.json({
        orders: orders.map(o=>({...R.presentOrder(o),...amounts.get(o.id)})),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      });
    } catch (error) {
      log("Get orders error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      F.errorResponse(res, error);
    }
  },
);

/**
 * GET /orders/:id
 */
router.get("/:id",requireAuth,requireRole("ADMIN","EXPEDITOR","WAREHOUSE","DRIVER"),R.route(async(req,res)=>{
 const where={id:F.id(req.params.id)};if(req.user.role==="EXPEDITOR")where.createdById=req.user.id;
 const order=await prisma.$transaction(async tx=>{const row=await tx.order.findFirst({where,include:R.orderInclude});if(!row)return null;return {...R.presentOrder(row),...(await R.orderFinancials(tx,row.customerId)).get(row.id)};},{isolationLevel:"RepeatableRead"});
 if(!order)throw F.fail(404,"Invoice not found.");res.json({order});
}));

/**
 * POST /orders
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { customerId, newCustomer, paymentType, note, items } =
        req.body || {};

      if (!newCustomer && (!customerId || typeof customerId !== "string")) {
        return res.status(400).json({ message: "customerId is required" });
      }

      if (!paymentType || !ALLOWED_PAYMENTS.includes(paymentType)) {
        return res.status(400).json({ message: "paymentType is invalid" });
      }

      const normalizedItems = normalizeOrderItems(items);

      const createdById = req.user?.id || req.user?.userId;
      if (!createdById) {
        return res
          .status(401)
          .json({ message: "Invalid token payload (missing user id)" });
      }

      if (newCustomer && customerId)
        throw F.fail(400, "Ya mövcud, ya yeni müştəri göndər.");
      const customerInput = newCustomer ? W.customerData(newCustomer) : null;
      let initialPayment;
      if(req.body.initialPayment!=null){
        const p=req.body.initialPayment;
        if(!p || typeof p!=="object" || Array.isArray(p))throw F.fail(400,"Check the initial payment.");
        initialPayment={amount:F.money(p.amount),method:F.text(p.method,20)||"CASH",note:F.text(p.note,300),imageUrl:p.imageUrl?normalizeUploadUrl(p.imageUrl,req.company):null};
        if(!["CASH","BANK","CARD"].includes(initialPayment.method))throw F.fail(400,"Choose a payment method.");
        if(F.minor(initialPayment.amount)>F.minor(R.documentTotal(normalizedItems)))throw F.fail(409,"Payment exceeds the invoice balance.","PAYMENT_LIMIT");
      }
      const input = {
        ...(initialPayment ? {initialPayment} : {}),
        customerId: customerInput ? null : F.id(customerId),
        newCustomer: customerInput,
        paymentType,
        note: F.text(note),
        items: normalizedItems,
      };
      const result = await F.mutate(req, "sale", input, async (tx) => {
        let customer;
        if (input.newCustomer) {
          await W.checkArea(tx, input.newCustomer.areaId);
          customer = await tx.customer.create({
            data: {
              ...input.newCustomer,
              assignedExpeditorId:
                hasFeature(req.company, "customerAssignments") &&
                req.user.role === "EXPEDITOR"
                  ? req.user.id
                  : null,
            },
          });
        } else customer = await F.lockCustomer(tx, input.customerId, req);

        const products = await ensureProductsExist(
          tx,
          normalizedItems.map((x) => x.productId),
        );
        if (req.user.role !== "ADMIN") {
          const catalogue = new Map(
            products.map((product) => [product.id, product]),
          );
          for (const item of normalizedItems) {
            if (
              item.isGift ||
              F.minor(item.unitPrice) !==
                F.minor(catalogue.get(item.productId).salePrice)
            ) {
              throw F.fail(
                403,
                "Qiyməti dəyişmək və hədiyyə əlavə etmək yalnız administratora icazəlidir.",
                "PRICE_PERMISSION",
              );
            }
          }
        }

        const invoice = await R.nextInvoice(tx, req.company.id, req.company.invoicePrefix);
        const snapshotItems = R.itemSnapshots(normalizedItems, products);
        const order = await tx.order.create({
          data: {
            ...invoice,
            totalAmount: R.documentTotal(normalizedItems),
            currency: req.company.currency,
            customerSnapshot: R.customerSnapshot(customer),
            companySnapshot: R.companySnapshot(req),
            customerId: customer.id,
            createdById,
            paymentType,
            note: note ? String(note).trim() : null,
            areaId: customer.areaId || null,
            deliveryStatus: "IN_WAREHOUSE",
            items: { create: snapshotItems },
          },
          include: {
            area: true,
            customer: true,
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });

        await decrementStockOrThrow(tx, normalizedItems, {
          user: req.user,
          kind: "SALE",
          reason: "Satış " + invoice.invoiceNumber,
          documentId: order.id,
        });
        let payment=null;
        if(input.initialPayment){
          const balance=await F.account(tx,customer.id);
          if(F.minor(input.initialPayment.amount)>F.minor(balance.debt))throw F.fail(409,"Payment exceeds the remaining customer debt after credit.","PAYMENT_LIMIT");
          payment=await tx.payment.create({data:{customerId:customer.id,orderId:order.id,createdById:req.user.id,amount:input.initialPayment.amount,paymentType:input.initialPayment.method,note:input.initialPayment.note||"Payment at sale",imageUrl:input.initialPayment.imageUrl,paymentDate:new Date()}});
        }
        return {order:R.presentOrder(order),payment,summary:await F.account(tx,customer.id)};
      });

      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return F.errorResponse(res, error);
    }
  },
);

// POST /orders/:id/signature
router.post(
  "/:id/signature",
  requireAuth,
  requireRole("ADMIN", "DRIVER"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { signature } = req.body;

      if (!signature) {
        return res.status(400).json({ message: "İmza tələb olunur" });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          customerSignature: signature,
          signedAt: new Date(),
        },
      });

      return res.json({ order: updated });
    } catch (err) {
      log("SIGNATURE ERROR:",{code:err.code||err.type||"REQUEST_FAILED",name:err.name,status:err.status||err.statusCode||500});
      return res.status(500).json({ message: "İmza saxlanmadı" });
    }
  },
);

// POST /orders/:id/seller-signature
router.post("/:id/seller-signature", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { signature } = req.body;

    if (!signature) {
      return res.status(400).json({ message: "signature tələb olunur" });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        sellerSignature: signature,
        sellerSignedAt: new Date(),
      },
    });

    return res.json({ message: "Seller imzası əlavə olundu", order });
  } catch (err) {
    log("SELLER SIGN ERROR:",{code:err.code||err.type||"REQUEST_FAILED",name:err.name,status:err.status||err.statusCode||500});
    return res.status(500).json({ message: "Xəta baş verdi" });
  }
});

/**
 * PUT /orders/:id
 * Admin order edit
 */
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentType, note, items } = req.body;

    if (paymentType && !ALLOWED_PAYMENTS.includes(paymentType)) {
      return res.status(400).json({ message: "paymentType is invalid" });
    }

    const normalizedItems = normalizeOrderItems(items);

    const result = await F.transaction(async (tx) => {
      await F.lockWorkspace(tx, req);
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              returnItems: true,
            },
          },
        },
      });

      if (!existingOrder) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
      }

      await F.lockCustomer(tx, existingOrder.customerId, req);

      if (existingOrder.deliveryStatus === "DELIVERED") {
        const err = new Error("Delivered order cannot be edited");
        err.statusCode = 400;
        throw err;
      }

      const hasReturnedItems = existingOrder.items.some(
        (item) => item.returnedQty > 0 || item.returnItems.length > 0,
      );

      if (hasReturnedItems) {
        const err = new Error("Order with returned items cannot be edited");
        err.statusCode = 400;
        throw err;
      }

      const products = await ensureProductsExist(
        tx,
        normalizedItems.map((x) => x.productId),
      );
      const snapshotItems = R.itemSnapshots(
        normalizedItems,
        products,
        existingOrder.items,
      );

      // 1) Köhnə sifarişin stokunu geri qaytar
      await giveBackStock(
        tx,
        existingOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        {
          user: req.user,
          kind: "SALE_EDIT",
          reason: F.text(req.body.reason, 300) || "Sifariş redaktəsi",
          documentId: existingOrder.id,
        },
      );

      // 2) Yeni item-lara görə stoku yenidən çıx
      await decrementStockOrThrow(tx, normalizedItems, {
        user: req.user,
        kind: "SALE_EDIT",
        reason: F.text(req.body.reason, 300) || "Sifariş redaktəsi",
        documentId: existingOrder.id,
      });

      // 3) Köhnə order item-ları sil
      await tx.orderItem.deleteMany({
        where: { orderId: existingOrder.id },
      });

      // 4) Yenilərini yaz
      await tx.orderItem.createMany({
        data: snapshotItems.map((item) => ({
          ...item,
          orderId: existingOrder.id,
        })),
      });

      // 5) Order başlığını update et
      const updatedOrder = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          totalAmount: R.documentTotal(normalizedItems),
          lastEditedById: req.user.id,
          lastEditedAt: new Date(),
          paymentType: paymentType || existingOrder.paymentType,
          note:
            note === undefined
              ? existingOrder.note
              : note
                ? String(note).trim()
                : null,
          areaId: existingOrder.customer?.areaId || null,
        },
        include: {
          area: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  stock: true,
                },
              },
              returnItems: true,
            },
          },
        },
      });

      await tx.orderEditLog.create({
        data: {
          orderId: existingOrder.id,
          editedById: req.user.id,
          reason: F.text(req.body.reason, 300) || "Sifariş redaktəsi",
          beforeSnapshot: JSON.parse(
            JSON.stringify(R.presentOrder(existingOrder)),
          ),
          afterSnapshot: JSON.parse(
            JSON.stringify(R.presentOrder(updatedOrder)),
          ),
        },
      });
      return R.presentOrder(updatedOrder);
    });

    res.json({
      message: "Order updated successfully",
      order: result,
    });
  } catch (error) {
    return F.errorResponse(res, error);
  }
});

module.exports = router;
