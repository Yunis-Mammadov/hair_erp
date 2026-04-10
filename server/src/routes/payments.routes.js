const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// GET /payments
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const {
        search = "",
        startDate = "",
        endDate = "",
        expeditorId = "",
      } = req.query;

      const where = {};

      if (req.user.role === "EXPEDITOR") {
        where.customer = {
          assignedExpeditorId: req.user.userId,
        };
      } else if (expeditorId && String(expeditorId).trim()) {
        where.customer = {
          assignedExpeditorId: String(expeditorId).trim(),
        };
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.customer = {
          ...(where.customer || {}),
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { salon: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        };
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

      const payments = await prisma.payment.findMany({
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
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json({ payments });
    } catch (error) {
      console.error("GET_PAYMENTS_ERROR:", error);
      return res.status(500).json({ message: "Mədaxillər alınmadı" });
    }
  },
);

// POST /payments
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { customerId, amount, note } = req.body;

      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "customerId tələb olunur" });
      }

      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "Məbləğ düzgün deyil" });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          assignedExpeditorId: true,
        },
      });

      if (!customer) {
        return res.status(404).json({ message: "Müştəri tapılmadı" });
      }

      if (
        req.user.role === "EXPEDITOR" &&
        customer.assignedExpeditorId !== req.user.userId
      ) {
        return res.status(403).json({
          message: "Bu müştəri üçün mədaxil əlavə etməyə icazən yoxdur",
        });
      }

      const payment = await prisma.payment.create({
        data: {
          customerId,
          amount: numericAmount,
          note: note ? String(note).trim() : null,
          createdById: req.user.userId,
        },
        include: {
          customer: {
            include: {
              assignedExpeditor: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
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
      });

      return res.status(201).json({ payment });
    } catch (error) {
      console.error("CREATE_PAYMENT_ERROR:", error);
      return res
        .status(500)
        .json({ message: error.message || "Mədaxil əlavə edilə bilmədi" });
    }
  },
);

module.exports = router;
