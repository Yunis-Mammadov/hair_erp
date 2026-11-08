const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// GET /exp/orders (expeditor öz orderləri; admin hamısı)
router.get(
  "/orders",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    const where =
      req.user.role === "EXPEDITOR" ? { createdById: req.user.userId } : {};

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json({ orders });
  },
);

module.exports = router;
