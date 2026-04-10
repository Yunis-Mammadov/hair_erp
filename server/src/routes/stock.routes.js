const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /stock
 * Query:
 * ?search=5.00
 * &categoryId=...
 * &status=ALL | IN_STOCK | LOW | OUT
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAREHOUSE", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { search = "", categoryId = "", status = "ALL" } = req.query;

      const where = {};

      if (categoryId && String(categoryId).trim()) {
        where.categoryId = String(categoryId).trim();
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
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      });

      const mapped = products.map((p) => {
        const quantity = Number(p.stock?.quantity || 0);

        let stockStatus = "NORMAL";
        if (quantity === 0) stockStatus = "OUT";
        else if (quantity <= 5) stockStatus = "LOW";

        return {
          productId: p.id,
          productName: p.name,
          category: p.category
            ? {
                id: p.category.id,
                name: p.category.name,
              }
            : null,
          quantity,
          salePrice: Number(p.salePrice || 0),
          updatedAt: p.stock?.updatedAt || p.updatedAt,
          status: stockStatus,
        };
      });

      const filtered = mapped.filter((item) => {
        if (status === "OUT") return item.quantity === 0;
        if (status === "LOW") return item.quantity > 0 && item.quantity <= 5;
        if (status === "IN_STOCK") return item.quantity > 0;
        return true;
      });

      const stats = {
        totalProducts: mapped.length,
        totalQuantity: mapped.reduce((sum, item) => sum + item.quantity, 0),
        outOfStock: mapped.filter((item) => item.quantity === 0).length,
        lowStock: mapped.filter(
          (item) => item.quantity > 0 && item.quantity <= 5,
        ).length,
      };

      res.json({
        items: filtered,
        stats,
      });
    } catch (error) {
      console.error("Get stock error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

/**
 * PATCH /stock/:productId
 * body: { quantity: number }
 */
router.patch(
  "/:productId",
  requireAuth,
  requireRole("WAREHOUSE", "ADMIN"),
  async (req, res) => {
    try {
      const productId = req.params.productId;
      const quantity = Number(req.body?.quantity);

      if (!Number.isInteger(quantity) || quantity < 0) {
        return res
          .status(400)
          .json({ message: "quantity must be integer >= 0" });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const stock = await prisma.stock.upsert({
        where: { productId },
        update: { quantity },
        create: { productId, quantity },
      });

      res.json({ stock });
    } catch (error) {
      console.error("Patch stock error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

module.exports = router;
