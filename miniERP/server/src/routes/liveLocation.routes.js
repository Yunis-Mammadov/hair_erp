const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

const VIEW_ROLES = ["ADMIN", "DRIVER"];
const DRIVER_ONLY = ["DRIVER"];

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /live-location/orders
router.get(
  "/orders",
  requireAuth,
  requireRole(...VIEW_ROLES),
  async (req, res) => {
    try {
      const where = {
        deliveryStatus: "ON_BOARD",
        customer: {
          lat: { not: null },
          lng: { not: null },
        },
      };

      // İstəsən driver yalnız öz seçdiyi orderləri görsün deyə burada filter qoymaq olar.
      // Hələlik admin və driver hamısını görür.

      const orders = await prisma.order.findMany({
        where,
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
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      });

      return res.json({ orders });
    } catch (error) {
      console.error("GET /live-location/orders error:", error);
      return res.status(500).json({ message: "Bortda sifarişlər alınmadı" });
    }
  },
);

// GET /live-location/active
router.get(
  "/active",
  requireAuth,
  requireRole(...VIEW_ROLES),
  async (req, res) => {
    try {
      const sessions = await prisma.driverLiveSession.findMany({
        where: {
          isActive: true,
        },
        include: {
          driver: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return res.json({ sessions });
    } catch (error) {
      console.error("GET /live-location/active error:", error);
      return res.status(500).json({ message: "Aktiv canlı konumlar alınmadı" });
    }
  },
);

// POST /live-location/start
router.post(
  "/start",
  requireAuth,
  requireRole(...DRIVER_ONLY),
  async (req, res) => {
    try {
      const driverId = req.user.userId || req.user.id;
      const lat = toNumber(req.body?.lat);
      const lng = toNumber(req.body?.lng);

      if (lat === null || lng === null) {
        return res.status(400).json({ message: "lat və lng tələb olunur" });
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.driverLiveSession.updateMany({
          where: {
            driverId,
            isActive: true,
          },
          data: {
            isActive: false,
            endedAt: new Date(),
          },
        });

        const session = await tx.driverLiveSession.create({
          data: {
            driverId,
            lat,
            lng,
            isActive: true,
          },
          include: {
            driver: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        });

        return session;
      });

      return res.status(201).json({
        message: "Canlı paylaşım başladı",
        session: result,
      });
    } catch (error) {
      console.error("POST /live-location/start error:", error);
      return res
        .status(500)
        .json({ message: "Canlı paylaşım başlatıla bilmədi" });
    }
  },
);

// PATCH /live-location/update
router.patch(
  "/update",
  requireAuth,
  requireRole(...DRIVER_ONLY),
  async (req, res) => {
    try {
      const driverId = req.user.userId || req.user.id;
      const lat = toNumber(req.body?.lat);
      const lng = toNumber(req.body?.lng);

      if (lat === null || lng === null) {
        return res.status(400).json({ message: "lat və lng tələb olunur" });
      }

      const activeSession = await prisma.driverLiveSession.findFirst({
        where: {
          driverId,
          isActive: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (!activeSession) {
        return res
          .status(404)
          .json({ message: "Aktiv canlı paylaşım tapılmadı" });
      }

      const updated = await prisma.driverLiveSession.update({
        where: {
          id: activeSession.id,
        },
        data: {
          lat,
          lng,
        },
        include: {
          driver: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      });

      return res.json({
        message: "Canlı konum yeniləndi",
        session: updated,
      });
    } catch (error) {
      console.error("PATCH /live-location/update error:", error);
      return res.status(500).json({ message: "Canlı konum yenilənmədi" });
    }
  },
);

// POST /live-location/stop
router.post(
  "/stop",
  requireAuth,
  requireRole(...DRIVER_ONLY),
  async (req, res) => {
    try {
      const driverId = req.user.userId || req.user.id;

      const activeSession = await prisma.driverLiveSession.findFirst({
        where: {
          driverId,
          isActive: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (!activeSession) {
        return res.json({
          message: "Aktiv paylaşım yox idi",
        });
      }

      const stopped = await prisma.driverLiveSession.update({
        where: { id: activeSession.id },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });

      return res.json({
        message: "Canlı paylaşım dayandırıldı",
        session: stopped,
      });
    } catch (error) {
      console.error("POST /live-location/stop error:", error);
      return res.status(500).json({ message: "Canlı paylaşım dayandırılmadı" });
    }
  },
);

module.exports = router;
