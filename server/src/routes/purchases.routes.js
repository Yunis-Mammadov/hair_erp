const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /purchases
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE"),
  async (req, res) => {
    try {
      const {
        page = "1",
        limit = "10",
        search = "",
        startDate = "",
        endDate = "",
      } = req.query;

      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      const skip = (pageNumber - 1) * limitNumber;

      const where = {};

      if (search && String(search).trim()) {
        const q = String(search).trim();
        where.OR = [
          { supplier: { contains: q, mode: "insensitive" } },
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } },
        ];
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
      }

      const [purchases, total] = await prisma.$transaction([
        prisma.purchase.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: { createdAt: "desc" },
          include: {
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
        prisma.purchase.count({ where }),
      ]);

      res.json({
        purchases,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      });
    } catch (error) {
      console.error("Get purchases error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * GET /purchases/:id
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const purchase = await prisma.purchase.findUnique({
        where: { id },
        include: {
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

      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      res.json({ purchase });
    } catch (error) {
      console.error("Get single purchase error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * POST /purchases
 * Body:
 * {
 *   "supplier": "optional",
 *   "invoiceNo": "optional",
 *   "note": "optional",
 *   "items": [
 *     {
 *       "productId": "cuid...",
 *       "quantity": 10,
 *       "unitCost": 2.7,
 *       "salePrice": 5
 *     }
 *   ]
 * }
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { supplier, invoiceNo, note, items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "items must be a non-empty array" });
      }

      const normalizedItems = items.map((i) => ({
        productId: String(i?.productId || "").trim(),
        quantity: parseInt(i?.quantity, 10),
        unitCost: Number(i?.unitCost),
        salePrice: Number(i?.salePrice),
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

        if (!Number.isFinite(it.unitCost) || it.unitCost < 0) {
          return res.status(400).json({
            message: "Each item must have valid unitCost",
          });
        }

        if (!Number.isFinite(it.salePrice) || it.salePrice < 0) {
          return res.status(400).json({
            message: "Each item must have valid salePrice",
          });
        }
      }

      const createdById = req.user?.id || req.user?.userId;
      if (!createdById) {
        return res
          .status(401)
          .json({ message: "Invalid token payload (missing user id)" });
      }

      const result = await prisma.$transaction(async (tx) => {
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
            update: {
              quantity: { increment: it.quantity },
            },
            create: {
              productId: it.productId,
              quantity: it.quantity,
            },
          });

          await tx.product.update({
            where: { id: it.productId },
            data: {
              salePrice: it.salePrice,
            },
          });
        }

        const purchase = await tx.purchase.create({
          data: {
            createdById,
            supplier: supplier ? String(supplier).trim() : null,
            invoiceNo: invoiceNo ? String(invoiceNo).trim() : null,
            note: note ? String(note).trim() : null,
            items: {
              create: normalizedItems.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                unitCost: it.unitCost,
              })),
            },
          },
          include: {
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

        return purchase;
      });

      res.status(201).json({ purchase: result });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error("Create purchase error:", error);
      res.status(status).json({ message: error.message || "Server error" });
    }
  },
);

module.exports = router;
