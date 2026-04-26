const express = require("express");
const bcrypt = require("bcrypt");
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
  }
);

/**
 * POST /users
 * Only ADMIN can create users
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { fullName, pin, role, email } = req.body;

      if (!fullName || !pin || !role) {
        return res.status(400).json({
          message: "fullName, pin və role mütləqdir",
        });
      }

      const allowedRoles = ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          message: "Role yanlışdır",
        });
      }

      const pinHash = await bcrypt.hash(String(pin), 10);

      const user = await prisma.user.create({
        data: {
          fullName,
          role,
          email: email || null,
          pinHash,
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return res.status(201).json({
        message: "User yaradıldı",
        user,
      });
    } catch (error) {
      console.error("Create user error:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          message: "Bu email artıq mövcuddur",
        });
      }

      return res.status(500).json({
        message: error.message || "Server error",
      });
    }
  }
);

module.exports = router;