const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/categories",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
      });

      res.json({ categories });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

router.get(
  "/products",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const { categoryId, search = "" } = req.query;

      const where = {};

      if (categoryId) {
        where.categoryId = String(categoryId);
      }

      if (search && String(search).trim()) {
        where.name = {
          contains: String(search).trim(),
          mode: "insensitive",
        };
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          stock: true,
        },
        orderBy: [{ name: "asc" }],
      });

      const mapped = products.map((p) => ({
        id: p.id,
        name: p.name,
        salePrice: Number(p.salePrice || 0),
        stockQty: Number(p.stock?.quantity || 0),
        category: p.category,
      }));

      res.json({ products: mapped });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

module.exports = router;
