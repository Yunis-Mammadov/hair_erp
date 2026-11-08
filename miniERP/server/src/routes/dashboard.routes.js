const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function getPreviousMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end };
}

function calcPercentChange(current, previous) {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function calcOrderTotal(order) {
  return (order.items || []).reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0);
}

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const currentMonth = getMonthRange();
    const previousMonth = getPreviousMonthRange();

    const [
      productsCount,
      customersCount,
      currentOrders,
      previousOrders,
      recentOrders,
    ] = await Promise.all([
      prisma.product.count(),

      prisma.customer.count(),

      prisma.order.findMany({
        where: {
          createdAt: {
            gte: currentMonth.start,
            lt: currentMonth.end,
          },
        },
        include: {
          customer: true,
          items: true,
        },
      }),

      prisma.order.findMany({
        where: {
          createdAt: {
            gte: previousMonth.start,
            lt: previousMonth.end,
          },
        },
        include: {
          items: true,
        },
      }),

      prisma.order.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    const currentSalesCount = currentOrders.length;
    const previousSalesCount = previousOrders.length;

    const currentItemsSold = currentOrders.reduce((sum, order) => {
      return (
        sum +
        order.items.reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        )
      );
    }, 0);

    const previousItemsSold = previousOrders.reduce((sum, order) => {
      return (
        sum +
        order.items.reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        )
      );
    }, 0);

    const currentRevenue = currentOrders.reduce((sum, order) => {
      return sum + calcOrderTotal(order);
    }, 0);

    const previousRevenue = previousOrders.reduce((sum, order) => {
      return sum + calcOrderTotal(order);
    }, 0);

    const averageOrderValue =
      currentSalesCount > 0 ? currentRevenue / currentSalesCount : 0;

    return res.json({
      products: {
        value: productsCount,
      },
      customers: {
        value: customersCount,
      },
      orders: {
        value: currentSalesCount,
        change: calcPercentChange(currentSalesCount, previousSalesCount),
      },
      itemsSold: {
        value: currentItemsSold,
        change: calcPercentChange(currentItemsSold, previousItemsSold),
      },
      revenue: {
        value: Number(currentRevenue.toFixed(2)),
        change: calcPercentChange(currentRevenue, previousRevenue),
      },
      averageOrderValue: {
        value: Number(averageOrderValue.toFixed(2)),
      },
      recentOrders,
    });
  } catch (error) {
    console.error("DASHBOARD_STATS_ERROR:", error);
    return res.status(500).json({
      message: "Dashboard statistikaları alınmadı",
    });
  }
});

module.exports = router;
