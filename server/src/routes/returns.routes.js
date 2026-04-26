const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /returns
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const where = {};

      if (req.user.role === "EXPEDITOR") {
        where.customer = {
          assignedExpeditorId: req.user.userId,
        };
      }

      const returns = await prisma.return.findMany({
        where,
        include: {
          customer: {
            include: {
              assignedExpeditor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({ returns });
    } catch (error) {
      console.error("GET_RETURNS_ERROR:", error);
      res.status(500).json({ message: "Geri qaytarmalar alınmadı" });
    }
  },
);

/**
 * GET /returns/:id
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const where = { id };

      if (req.user.role === "EXPEDITOR") {
        where.createdById = req.user.userId;
      }

      const returnData = await prisma.return.findFirst({
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

      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      res.json({ return: returnData });
    } catch (error) {
      console.error("Get single return error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * POST /returns
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { customerId, note, items } = req.body;

      if (!customerId) {
        return res.status(400).json({ message: "customerId tələb olunur" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items tələb olunur" });
      }

      const normalizedItems = items
        .map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.productId && item.quantity > 0);

      if (normalizedItems.length === 0) {
        return res.status(400).json({
          message: "Qaytarılacaq məhsullar düzgün göndərilməyib",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const authUserId = req.user?.userId || req.user?.id;

        if (!authUserId) {
          throw new Error("Aktiv istifadəçi tapılmadı");
        }

        const isExpeditor = req.user.role === "EXPEDITOR";

        const customer = await tx.customer.findFirst({
          where: isExpeditor
            ? {
                id: customerId,
                assignedExpeditorId: authUserId,
              }
            : {
                id: customerId,
              },
          include: {
            orders: {
              where: isExpeditor ? { createdById: authUserId } : {},
              orderBy: { createdAt: "asc" },
              include: {
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
            },
          },
        });

        if (!customer) {
          throw new Error("Müştəri tapılmadı");
        }

        /**
         * MƏDAXİLDƏ SATILMIŞ KİMİ QEYD OLUNAN MƏHSULLAR
         * Bu məhsullar artıq geri qaytarıla bilməz.
         */
        const paymentSoldItems = await tx.paymentSoldItem.findMany({
          where: {
            payment: {
              customerId,
            },
          },
          select: {
            productId: true,
            quantity: true,
          },
        });

        const soldQtyByProduct = paymentSoldItems.reduce((acc, item) => {
          acc[item.productId] =
            (acc[item.productId] || 0) + Number(item.quantity || 0);
          return acc;
        }, {});

        const returnDoc = await tx.return.create({
          data: {
            note: note || null,
            customer: {
              connect: { id: customerId },
            },
            createdBy: {
              connect: { id: authUserId },
            },
          },
        });

        for (const requestedItem of normalizedItems) {
          const { productId, quantity } = requestedItem;
          let remainingQty = quantity;

          const matchingOrderItems = customer.orders
            .flatMap((order) =>
              (order.items || []).map((item) => ({
                ...item,
                orderId: order.id,
              })),
            )
            .filter((item) => {
              const orderedQty = Number(item.quantity || 0);
              const returnedQty = Number(item.returnedQty || 0);
              const availableQty = orderedQty - returnedQty;

              return (
                item.productId === productId && !item.isGift && availableQty > 0
              );
            });

          const totalOrderedAvailable = matchingOrderItems.reduce(
            (sum, item) => {
              const orderedQty = Number(item.quantity || 0);
              const returnedQty = Number(item.returnedQty || 0);
              return sum + Math.max(orderedQty - returnedQty, 0);
            },
            0,
          );

          const alreadySoldQty = Number(soldQtyByProduct[productId] || 0);
          const totalAvailable = Math.max(
            totalOrderedAvailable - alreadySoldQty,
            0,
          );

          if (remainingQty > totalAvailable) {
            const productName =
              matchingOrderItems[0]?.product?.name || "Məhsul";

            throw new Error(
              `${productName} üçün maksimum ${totalAvailable} ədəd qaytarmaq olar. Çünki ${alreadySoldQty} ədəd artıq mədaxildə satılmış kimi qeyd olunub.`,
            );
          }

          /**
           * Burada satılmış miqdarı əvvəlcə skip edirik.
           * Yəni mədaxildə satılmış məhsullar qaytarma üçün əlçatan sayılmır.
           */
          let soldQtyToSkip = alreadySoldQty;

          for (const orderItem of matchingOrderItems) {
            if (remainingQty <= 0) break;

            const orderedQty = Number(orderItem.quantity || 0);
            const returnedQty = Number(orderItem.returnedQty || 0);
            let availableQty = Math.max(orderedQty - returnedQty, 0);

            if (soldQtyToSkip > 0) {
              const skippedQty = Math.min(soldQtyToSkip, availableQty);
              availableQty -= skippedQty;
              soldQtyToSkip -= skippedQty;
            }

            if (availableQty <= 0) continue;

            const allocateQty = Math.min(remainingQty, availableQty);

            await tx.returnItem.create({
              data: {
                returnId: returnDoc.id,
                orderItemId: orderItem.id,
                productId: orderItem.productId,
                quantity: allocateQty,
                unitPrice: orderItem.unitPrice,
              },
            });

            await tx.orderItem.update({
              where: { id: orderItem.id },
              data: {
                returnedQty: {
                  increment: allocateQty,
                },
              },
            });

            await tx.stock.update({
              where: { productId: orderItem.productId },
              data: {
                quantity: {
                  increment: allocateQty,
                },
              },
            });

            remainingQty -= allocateQty;
          }
        }

        await tx.customer.update({
          where: { id: customerId },
          data: {
            isProblematic: true,
            problemNote: note ? String(note).trim() : customer.problemNote,
            problemMarkedAt: new Date(),
          },
        });

        const fullReturnDoc = await tx.return.findUnique({
          where: { id: returnDoc.id },
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
                orderItem: true,
              },
            },
          },
        });

        return fullReturnDoc;
      });

      return res.status(201).json({
        message: "Geri qaytarma yaradıldı",
        returnDoc: result,
      });
    } catch (error) {
      console.error("Create return error:", error);
      return res.status(400).json({
        message: error.message || "Geri qaytarma yaradılmadı",
      });
    }
  },
);

module.exports = router;
