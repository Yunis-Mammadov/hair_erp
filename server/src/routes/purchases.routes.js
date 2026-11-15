const express = require("express");

const { prisma } = require("../prismaClient");

const {
  requireAuth,
  requireRole,
} = require("../middleware/auth.middleware");

const F = require("../financial-core");
const W = require("../workspace-core");
const { log } = require("../ops/runtime");

const {
  readPurchase,
  recordPurchase,
} = require("../purchase-input");

const router = express.Router();

/**
 * Alış siyahısı
 * GET /api/purchases
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

      const pageNumber = Math.max(
        parseInt(page, 10) || 1,
        1,
      );

      const limitNumber = Math.min(
        Math.max(parseInt(limit, 10) || 10, 1),
        100,
      );

      const skip = (pageNumber - 1) * limitNumber;

      const where = {};

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.OR = [
          {
            supplier: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            invoiceNo: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            note: {
              contains: q,
              mode: "insensitive",
            },
          },
        ];
      }

      if (startDate || endDate) {
        W.dateRange(
          startDate,
          endDate,
          req.company.timezone,
        );

        where.purchaseDate = {
          ...(startDate
            ? { gte: W.calendar(startDate) }
            : {}),
          ...(endDate
            ? { lte: W.calendar(endDate) }
            : {}),
        };
      }

      const [purchases, total] =
        await prisma.$transaction([
          prisma.purchase.findMany({
            where,
            skip,
            take: limitNumber,

            orderBy: [
              { purchaseDate: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],

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
          totalPages: Math.ceil(
            total / limitNumber,
          ),
        },
      });
    } catch (error) {
      log("Get purchases error:", {
        code:
          error.code ||
          error.type ||
          "REQUEST_FAILED",
        name: error.name,
        status:
          error.status ||
          error.statusCode ||
          500,
      });

      F.errorResponse(res, error);
    }
  },
);

/**
 * Bir alışın detalları
 * GET /api/purchases/:id
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const purchase =
        await prisma.purchase.findUnique({
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
        return res.status(404).json({
          message: "Purchase not found",
        });
      }

      res.json({ purchase });
    } catch (error) {
      log("Get single purchase error:", {
        code:
          error.code ||
          error.type ||
          "REQUEST_FAILED",
        name: error.name,
        status:
          error.status ||
          error.statusCode ||
          500,
      });

      F.errorResponse(res, error);
    }
  },
);

/**
 * Yeni alış
 * POST /api/purchases
 *
 * Yeni kateqoriya, məhsul, alış sənədi və stok
 * hərəkəti eyni tranzaksiyada saxlanılır.
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE"),
  async (req, res) => {
    try {
      const input = readPurchase(req);

      const result = await F.mutate(
        req,
        "purchase",
        input,
        (tx) => recordPurchase(tx, req, input),
      );

      res
        .status(result.replayed ? 200 : 201)
        .json(result);
    } catch (error) {
      F.errorResponse(res, error);
    }
  },
);

module.exports = router;