const {log}=require("../ops/runtime");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

const ALLOWED_ROLES = ["ADMIN", "WAREHOUSE", "DRIVER"];

function getDateKey(dateValue) {
  if (!dateValue) return "NO_DATE";

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "NO_DATE";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dayLabel(routeDay) {
  if (!routeDay) return "Gün təyin edilməyib";
  return `${routeDay}-ci gün`;
}

function normalizeZone(zone) {
  return zone || "UNKNOWN";
}

function normalizeAreaName(order) {
  return order.area?.name || "Ərazi yoxdur";
}

function normalizeRouteDay(order) {
  return order.area?.routeDay || 0;
}

function normalizeSortOrder(order) {
  return order.area?.sortOrder ?? 9999;
}

function makeEmptyZoneBucket(zoneKey) {
  return {
    zoneKey,
    zoneLabel:
      zoneKey === "SAHE_1"
        ? "Sahə 1"
        : zoneKey === "SAHE_2"
          ? "Sahə 2"
          : "Təyin edilməmiş",
    days: {},
  };
}

function buildGroupedByDate(orders = [], dateField = "createdAt") {
  const grouped = {};

  for (const order of orders) {
    const dateValue = order?.[dateField];
    const dateKey = getDateKey(dateValue);
    const zoneKey = normalizeZone(order.area?.routeZone);
    const routeDay = normalizeRouteDay(order);
    const areaName = normalizeAreaName(order);
    const sortOrder = normalizeSortOrder(order);

    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        dateKey,
        dateValue,
        zones: {
          SAHE_1: makeEmptyZoneBucket("SAHE_1"),
          SAHE_2: makeEmptyZoneBucket("SAHE_2"),
          UNKNOWN: makeEmptyZoneBucket("UNKNOWN"),
        },
      };
    }

    if (!grouped[dateKey].zones[zoneKey]) {
      grouped[dateKey].zones[zoneKey] = makeEmptyZoneBucket(zoneKey);
    }

    const zoneBucket = grouped[dateKey].zones[zoneKey];

    if (!zoneBucket.days[routeDay]) {
      zoneBucket.days[routeDay] = {
        routeDay,
        routeDayLabel: dayLabel(routeDay),
        areas: {},
      };
    }

    if (!zoneBucket.days[routeDay].areas[areaName]) {
      zoneBucket.days[routeDay].areas[areaName] = {
        areaName,
        routeDay,
        routeDayLabel: dayLabel(routeDay),
        routeZone: zoneKey,
        sortOrder,
        count: 0,
        orders: [],
      };
    }

    zoneBucket.days[routeDay].areas[areaName].orders.push(order);
    zoneBucket.days[routeDay].areas[areaName].count += 1;
  }

  return Object.values(grouped)
    .map((dateGroup) => {
      const zones = ["SAHE_1", "SAHE_2", "UNKNOWN"]
        .map((zoneKey) => {
          const zoneData = dateGroup.zones[zoneKey];
          if (!zoneData) return null;

          const days = Object.values(zoneData.days)
            .map((dayGroup) => {
              const areas = Object.values(dayGroup.areas).sort((a, b) => {
                if (a.sortOrder !== b.sortOrder)
                  return a.sortOrder - b.sortOrder;
                return a.areaName.localeCompare(b.areaName, "az");
              });

              return {
                routeDay: dayGroup.routeDay,
                routeDayLabel: dayGroup.routeDayLabel,
                areas,
              };
            })
            .sort((a, b) => a.routeDay - b.routeDay);

          if (!days.length) return null;

          return {
            zoneKey: zoneData.zoneKey,
            zoneLabel: zoneData.zoneLabel,
            days,
          };
        })
        .filter(Boolean);

      return {
        dateKey: dateGroup.dateKey,
        dateValue: dateGroup.dateValue,
        zones,
      };
    })
    .sort((a, b) => {
      return new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime();
    });
}

function buildDeliveredAreaSummary(orders = []) {
  const areaMap = {};

  for (const order of orders) {
    const areaName = normalizeAreaName(order);

    if (!areaMap[areaName]) {
      areaMap[areaName] = {
        areaName,
        count: 0,
      };
    }

    areaMap[areaName].count += 1;
  }

  return Object.values(areaMap).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.areaName.localeCompare(b.areaName, "az");
  });
}

function buildSummary(activeOrders = [], deliveredOrders = []) {
  return {
    totalOrders: activeOrders.length + deliveredOrders.length,
    activeOrders: activeOrders.length,
    deliveredOrders: deliveredOrders.length,
    inWarehouse: activeOrders.filter((x) => x.deliveryStatus === "IN_WAREHOUSE")
      .length,
    onBoard: activeOrders.filter((x) => x.deliveryStatus === "ON_BOARD").length,
  };
}

function applyDeliveredDateTimeFilter(orders = [], query = {}) {
  const {
    deliveredStartDate = "",
    deliveredEndDate = "",
    startTime = "",
    endTime = "",
  } = query;

  return orders.filter((order) => {
    if (!order.deliveredAt) return false;

    const deliveredAt = new Date(order.deliveredAt);
    if (Number.isNaN(deliveredAt.getTime())) return false;

    if (deliveredStartDate) {
      const start = new Date(deliveredStartDate);
      if (!Number.isNaN(start.getTime()) && deliveredAt < start) {
        return false;
      }
    }

    if (deliveredEndDate) {
      const end = new Date(deliveredEndDate);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        if (deliveredAt > end) return false;
      }
    }

    const hh = String(deliveredAt.getHours()).padStart(2, "0");
    const mm = String(deliveredAt.getMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;

    if (startTime && currentTime < startTime) {
      return false;
    }

    if (endTime && currentTime > endTime) {
      return false;
    }

    return true;
  });
}

// GET /delivery
router.get(
  "/",
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req, res) => {
    try {
      const orders = await prisma.order.findMany({
        include: {
          area: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });

      const activeOrders = orders.filter(
        (order) => order.deliveryStatus !== "DELIVERED",
      );

      const deliveredOrdersRaw = orders.filter(
        (order) => order.deliveryStatus === "DELIVERED",
      );

      const deliveredOrders = applyDeliveredDateTimeFilter(
        deliveredOrdersRaw,
        req.query,
      );

      const activeGroupedByDate = buildGroupedByDate(activeOrders, "createdAt");
      const deliveredGroupedByDate = buildGroupedByDate(
        deliveredOrders,
        "deliveredAt",
      );

      const deliveredAreaSummary = buildDeliveredAreaSummary(deliveredOrders);
      const summary = buildSummary(activeOrders, deliveredOrdersRaw);

      return res.json({
        summary,
        filters: {
          deliveredStartDate: req.query.deliveredStartDate || "",
          deliveredEndDate: req.query.deliveredEndDate || "",
          startTime: req.query.startTime || "",
          endTime: req.query.endTime || "",
        },
        activeGroupedByDate,
        deliveredGroupedByDate,
        deliveredAreaSummary,
      });
    } catch (error) {
      log("GET /delivery error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      return res
        .status(500)
        .json({ message: "Çatdırılma məlumatları alınmadı" });
    }
  },
);

// PATCH /delivery/:orderId/status
router.patch(
  "/:orderId/status",
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { deliveryStatus } = req.body;

      const validStatuses = ["IN_WAREHOUSE", "ON_BOARD", "DELIVERED"];

      if (!validStatuses.includes(deliveryStatus)) {
        return res.status(400).json({ message: "Yanlış delivery status" });
      }

      const data = {
        deliveryStatus,
      };

      if (deliveryStatus === "DELIVERED") {
        data.deliveredAt = new Date();
      } else {
        data.deliveredAt = null;
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data,
        include: {
          area: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return res.json({ order: updatedOrder });
    } catch (error) {
      log("PATCH /delivery/:orderId/status error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      return res.status(500).json({ message: "Status yenilənmədi" });
    }
  },
);

module.exports = router;
