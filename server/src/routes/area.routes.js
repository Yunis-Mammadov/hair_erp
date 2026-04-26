const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/areas
 * Bütün area-ları gətir
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE", "EXPEDITOR", "DRIVER"),
  async (req, res) => {
    try {
      const areas = await prisma.area.findMany({
        where: { isActive: true },
        orderBy: [
          { routeZone: "asc" },
          { routeDay: "asc" },
          { sortOrder: "asc" },
        ],
      });

      return res.json({ areas });
    } catch (error) {
      console.error("GET_AREAS_ERROR:", error);
      return res.status(500).json({ message: "Area-lar alınmadı" });
    }
  }
);

/**
 * POST /api/areas
 * Tək area əlavə etmək
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { name, routeZone, routeDay, sortOrder } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name mütləqdir" });
      }

      const area = await prisma.area.create({
        data: {
          name,
          routeZone: routeZone || null,
          routeDay: routeDay ?? null,
          sortOrder: sortOrder ?? 0,
          isActive: true,
        },
      });

      return res.status(201).json({
        message: "Area yaradıldı",
        area,
      });
    } catch (error) {
      console.error("CREATE_AREA_ERROR:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          message: "Bu adda area artıq mövcuddur",
        });
      }

      return res.status(500).json({ message: "Area yaradılmadı" });
    }
  }
);

/**
 * POST /api/areas/bulk
 * Bulk area əlavə etmək (sənin əsas istifadə edəcəyin)
 */
router.post(
  "/bulk",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { areas } = req.body;

      if (!Array.isArray(areas) || areas.length === 0) {
        return res.status(400).json({
          message: "areas boş olmayan array olmalıdır",
        });
      }

      const results = [];

      for (const area of areas) {
        if (!area.name) continue;

        const savedArea = await prisma.area.upsert({
          where: { name: area.name },
          update: {
            routeZone: area.routeZone || null,
            routeDay: area.routeDay ?? null,
            sortOrder: area.sortOrder ?? 0,
            isActive: area.isActive ?? true,
          },
          create: {
            name: area.name,
            routeZone: area.routeZone || null,
            routeDay: area.routeDay ?? null,
            sortOrder: area.sortOrder ?? 0,
            isActive: area.isActive ?? true,
          },
        });

        results.push(savedArea);
      }

      return res.status(201).json({
        message: "Area-lar uğurla əlavə/yeniləndi",
        count: results.length,
        areas: results,
      });
    } catch (error) {
      console.error("AREA_BULK_ERROR:", error);
      return res.status(500).json({
        message: error.message || "Area bulk əməliyyatı alınmadı",
      });
    }
  }
);

module.exports = router;