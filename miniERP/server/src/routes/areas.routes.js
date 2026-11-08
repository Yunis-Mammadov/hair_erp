const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const areas = await prisma.area.findMany({
      where: { isActive: true },
      orderBy: [
        { routeZone: "asc" },
        { routeDay: "asc" },
        { sortOrder: "asc" },
      ],
    });

    return res.json(areas);
  } catch (error) {
    console.error("GET /areas error:", error);
    return res.status(500).json({ message: "Ərazilər gətirilə bilmədi" });
  }
});

module.exports = router;
