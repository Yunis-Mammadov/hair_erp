const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

const ALLOWED_PAYMENTS = ["REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];

function normalizeOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items must be a non-empty array");
    err.statusCode = 400;
    throw err;
  }

  const normalized = items.map((i) => ({
    productId: String(i?.productId || "").trim(),
    quantity: parseInt(i?.quantity, 10),
    unitPrice: Number(i?.unitPrice),
    isGift: Boolean(i?.isGift),
  }));

  for (const it of normalized) {
    if (!it.productId) {
      const err = new Error("Each item must have productId");
      err.statusCode = 400;
      throw err;
    }

    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      const err = new Error("Each item must have quantity > 0");
      err.statusCode = 400;
      throw err;
    }

    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
      const err = new Error("Each item must have valid unitPrice");
      err.statusCode = 400;
      throw err;
    }

    if (it.isGift && Number(it.unitPrice) !== 0) {
      const err = new Error("Gift item unitPrice must be 0");
      err.statusCode = 400;
      throw err;
    }

    if (!it.isGift && Number(it.unitPrice) <= 0) {
      const err = new Error("Normal sale item unitPrice must be > 0");
      err.statusCode = 400;
      throw err;
    }
  }

  return normalized;
}

async function ensureProductsExist(tx, productIds) {
  const uniqueIds = [...new Set(productIds)];

  const products = await tx.product.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
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

async function giveBackStock(tx, items) {
  for (const item of items) {
    await tx.stock.upsert({
      where: { productId: item.productId },
      update: {
        quantity: { increment: item.quantity },
      },
      create: {
        productId: item.productId,
        quantity: item.quantity,
      },
    });
  }
}

async function decrementStockOrThrow(tx, items) {
  for (const item of items) {
    await tx.stock.upsert({
      where: { productId: item.productId },
      update: {},
      create: { productId: item.productId, quantity: 0 },
    });

    const updated = await tx.stock.updateMany({
      where: {
        productId: item.productId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
      },
    });

    if (updated.count === 0) {
      const err = new Error(
        `Insufficient stock for productId=${item.productId}`,
      );
      err.statusCode = 409;
      throw err;
    }
  }
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
        if (expeditorId && String(expeditorId).trim()) {
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

      if (startDate || endDate) {
        where.createdAt = {};

        if (startDate) {
          const start = new Date(startDate);
          if (!isNaN(start.getTime())) {
            where.createdAt.gte = start;
          }
        }

        if (endDate) {
          const end = new Date(endDate);
          if (!isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            where.createdAt.lte = end;
          }
        }

        if (
          where.createdAt &&
          where.createdAt.gte === undefined &&
          where.createdAt.lte === undefined
        ) {
          delete where.createdAt;
        }
      }

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

      res.json({
        orders,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      });
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * GET /orders/:id
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const where = { id };

      if (req.user.role === "EXPEDITOR") {
        where.createdById = req.user.userId;
      }

      const order = await prisma.order.findFirst({
        where,
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

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({ order });
    } catch (error) {
      console.error("Get single order error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * POST /orders
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { customerId, paymentType, note, items } = req.body;

      if (!customerId || typeof customerId !== "string") {
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

      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          include: {
            area: true,
          },
        });

        if (!customer) {
          const err = new Error("Customer not found");
          err.statusCode = 404;
          throw err;
        }

        await ensureProductsExist(
          tx,
          normalizedItems.map((x) => x.productId),
        );

        await decrementStockOrThrow(tx, normalizedItems);

        const order = await tx.order.create({
          data: {
            customerId,
            createdById,
            paymentType,
            note: note ? String(note).trim() : null,
            areaId: customer.areaId || null,
            deliveryStatus: "IN_WAREHOUSE",
            items: {
              create: normalizedItems.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                isGift: it.isGift,
              })),
            },
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

        return order;
      });

      res.status(201).json({ order: result });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error("Create order error:", error);
      res.status(status).json({ message: error.message || "Server error" });
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
      console.error("SIGNATURE ERROR:", err);
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
    console.error("SELLER SIGN ERROR:", err);
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

    const result = await prisma.$transaction(async (tx) => {
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

      await ensureProductsExist(
        tx,
        normalizedItems.map((x) => x.productId),
      );

      // 1) Köhnə sifarişin stokunu geri qaytar
      await giveBackStock(
        tx,
        existingOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );

      // 2) Yeni item-lara görə stoku yenidən çıx
      await decrementStockOrThrow(tx, normalizedItems);

      // 3) Köhnə order item-ları sil
      await tx.orderItem.deleteMany({
        where: { orderId: existingOrder.id },
      });

      // 4) Yenilərini yaz
      await tx.orderItem.createMany({
        data: normalizedItems.map((it) => ({
          orderId: existingOrder.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          isGift: it.isGift,
        })),
      });

      // 5) Order başlığını update et
      const updatedOrder = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
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

      return updatedOrder;
    });

    res.json({
      message: "Order updated successfully",
      order: result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Update order error:", error);
    res.status(status).json({ message: error.message || "Server error" });
  }
});

module.exports = router;
