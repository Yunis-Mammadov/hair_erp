const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /users?role=EXPEDITOR
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const { role = "" } = req.query;

      const where = {};

      if (role && String(role).trim()) {
        where.role = String(role).trim();
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: {
          fullName: "asc",
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      res.json({ users });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

module.exports = router;
