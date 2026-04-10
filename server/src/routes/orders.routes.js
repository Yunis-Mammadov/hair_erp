const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

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

      // Yalnız ekspeditor öz satışlarını görür
      if (req.user.role === "EXPEDITOR") {
        where.createdById = req.user.userId;
      } else {
        // ADMIN / DRIVER / WAREHOUSE üçün ekspeditor filteri
        if (expeditorId && String(expeditorId).trim()) {
          where.createdById = String(expeditorId).trim();
        }
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.customer = {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { salon: { contains: q, mode: "insensitive" } },
          ],
        };
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

      // Ekspeditor başqasının order detailinə baxa bilməsin
      if (req.user.role === "EXPEDITOR") {
        where.createdById = req.user.userId;
      }

      const order = await prisma.order.findFirst({
        where,
        include: {
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

      const allowedPayments = ["REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];
      if (!paymentType || !allowedPayments.includes(paymentType)) {
        return res.status(400).json({ message: "paymentType is invalid" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "items must be a non-empty array" });
      }

      const normalizedItems = items.map((i) => ({
        productId: String(i?.productId || "").trim(),
        quantity: parseInt(i?.quantity, 10),
        unitPrice: Number(i?.unitPrice),
        isGift: Boolean(i?.isGift),
      }));

      for (const it of normalizedItems) {
        if (!it.productId) {
          return res
            .status(400)
            .json({ message: "Each item must have productId" });
        }

        if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
          return res
            .status(400)
            .json({ message: "Each item must have quantity > 0" });
        }

        if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
          return res
            .status(400)
            .json({ message: "Each item must have valid unitPrice" });
        }

        if (it.isGift && Number(it.unitPrice) !== 0) {
          return res
            .status(400)
            .json({ message: "Gift item unitPrice must be 0" });
        }

        if (!it.isGift && Number(it.unitPrice) <= 0) {
          return res
            .status(400)
            .json({ message: "Normal sale item unitPrice must be > 0" });
        }
      }

      const createdById = req.user?.id || req.user?.userId;
      if (!createdById) {
        return res
          .status(401)
          .json({ message: "Invalid token payload (missing user id)" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          const err = new Error("Customer not found");
          err.statusCode = 404;
          throw err;
        }

        const productIds = [
          ...new Set(normalizedItems.map((x) => x.productId)),
        ];

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        });

        if (products.length !== productIds.length) {
          const found = new Set(products.map((p) => p.id));
          const missing = productIds.filter((id) => !found.has(id));
          const err = new Error(`Products not found: ${missing.join(", ")}`);
          err.statusCode = 400;
          throw err;
        }

        for (const it of normalizedItems) {
          await tx.stock.upsert({
            where: { productId: it.productId },
            update: {},
            create: { productId: it.productId, quantity: 0 },
          });

          const updated = await tx.stock.updateMany({
            where: {
              productId: it.productId,
              quantity: { gte: it.quantity },
            },
            data: {
              quantity: { decrement: it.quantity },
            },
          });

          if (updated.count === 0) {
            const err = new Error(
              `Insufficient stock for productId=${it.productId}`,
            );
            err.statusCode = 409;
            throw err;
          }
        }

        const order = await tx.order.create({
          data: {
            customerId,
            createdById,
            paymentType,
            note: note ? String(note).trim() : null,
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

module.exports = router;
