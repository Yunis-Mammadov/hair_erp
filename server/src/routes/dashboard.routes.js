const {log}=require("../ops/runtime");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

const W = require("../workspace-core");
function monthRange(zone, offset = 0) {
  const day = W.localDay(new Date(), zone), d = W.calendar(day);
  const y=d.getUTCFullYear(), m=d.getUTCMonth();
  const start=new Date(Date.UTC(y,m+offset,1)).toISOString().slice(0,10);
  const end=new Date(Date.UTC(y,m+offset+1,1)).toISOString().slice(0,10);
  return {start: W.zonedDay(start,zone), end: W.zonedDay(end,zone)};
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

router.get("/stats", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const currentMonth = monthRange(req.company.timezone);
    const previousMonth = monthRange(req.company.timezone, -1);

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
    log("DASHBOARD_STATS_ERROR:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
    return res.status(500).json({
      message: "Dashboard statistikaları alınmadı",
    });
  }
});

module.exports = router;
