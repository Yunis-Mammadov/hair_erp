const {log}=require("../ops/runtime");
const W = require("../workspace-core");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const F = require("../financial-core");
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

      if (startDate || endDate) where.createdAt = W.dateRange(startDate, endDate, req.company.timezone);

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
      log("Get purchases error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      F.errorResponse(res, error);
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
      log("Get single purchase error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      F.errorResponse(res, error);
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

      const normalizedItems = F.lines(items).map((item) => ({
        productId: F.id(item.productId),
        quantity: F.integer(item.quantity),
        unitCost: F.money(item.unitCost, true),
        salePrice: F.money(item.salePrice, true),
      }));

      const createdById = req.user?.id || req.user?.userId;
      if (!createdById) {
        return res
          .status(401)
          .json({ message: "Invalid token payload (missing user id)" });
      }

      const input = {
        supplier: F.text(supplier, 200),
        invoiceNo: F.text(invoiceNo, 100),
        note: F.text(note),
        items: normalizedItems,
      };
      const result = await F.mutate(req, "purchase", input, async (tx) => {
        const productIds = [
          ...new Set(normalizedItems.map((x) => x.productId)),
        ];

        const products = await tx.product.findMany({
          where: { id: { in: productIds }, archivedAt: null },
          select: { id: true, name: true, salePrice: true },
        });

        if (products.length !== productIds.length) {
          const found = new Set(products.map((p) => p.id));
          const missing = productIds.filter((id) => !found.has(id));
          const err = new Error(`Products not found: ${missing.join(", ")}`);
          err.statusCode = 400;
          throw err;
        }

        if (req.user.role !== "ADMIN") {
          const catalogue = new Map(
            products.map((product) => [product.id, product]),
          );
          if (
            normalizedItems.some(
              (item) =>
                F.minor(item.salePrice) !==
                F.minor(catalogue.get(item.productId).salePrice),
            )
          )
            throw F.fail(
              403,
              "Kataloq satış qiymətini yalnız administrator dəyişə bilər.",
              "PRICE_PERMISSION",
            );
        }

        for (const it of normalizedItems) {
          if (req.user.role === "ADMIN")
            await tx.product.update({
              where: { id: it.productId },
              data: { salePrice: it.salePrice },
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

        for (const item of normalizedItems)
          await F.moveStock(tx, item.productId, item.quantity, {
            user: req.user,
            kind: "PURCHASE",
            reason: input.note || "Alış " + (input.invoiceNo || ""),
            documentId: purchase.id,
          });
        return { purchase };
      });

      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return F.errorResponse(res, error);
    }
  },
);

module.exports = router;
