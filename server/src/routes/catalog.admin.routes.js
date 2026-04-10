const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * ADMIN-only catalog management
 * Base: /catalog/admin
 */

// GET /catalog/admin/categories
router.get(
  "/categories",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return res.json({ categories });
    } catch (e) {
      return res
        .status(500)
        .json({ message: e.message || "Categories fetch error" });
    }
  },
);

// POST /catalog/admin/categories
router.post(
  "/categories",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "name required" });

    try {
      const category = await prisma.category.create({ data: { name } });
      return res.json({ category });
    } catch (e) {
      return res
        .status(400)
        .json({ message: e.message || "Category create error" });
    }
  },
);

// GET /catalog/admin/products
router.get("/products", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { categoryId = "", search = "" } = req.query;

    const where = {};

    if (String(categoryId).trim()) {
      where.categoryId = String(categoryId).trim();
    }

    if (String(search).trim()) {
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

    return res.json({ products });
  } catch (e) {
    return res
      .status(500)
      .json({ message: e.message || "Products fetch error" });
  }
});

// POST /catalog/admin/products
// body: { name: "4.66", categoryId: "...", salePrice?: 0 }
router.post(
  "/products",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const categoryId = String(req.body?.categoryId || "").trim();
    const salePrice = Number(req.body?.salePrice ?? 0);

    if (!name) return res.status(400).json({ message: "name required" });
    if (!categoryId) {
      return res.status(400).json({ message: "categoryId required" });
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return res.status(400).json({ message: "salePrice must be >= 0" });
    }

    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return res.status(400).json({ message: "Category not found" });

    try {
      const product = await prisma.product.create({
        data: { name, categoryId, salePrice },
      });

      await prisma.stock.upsert({
        where: { productId: product.id },
        update: {},
        create: { productId: product.id, quantity: 0 },
      });

      return res.json({ product });
    } catch (e) {
      return res
        .status(400)
        .json({ message: e.message || "Product create error" });
    }
  },
);

// POST /catalog/admin/products/bulk
// body: { categoryId, names: ["1.0","4.66"], defaultStock: 0, salePrice?: 0 }
router.post(
  "/products/bulk",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const categoryId = String(req.body?.categoryId || "").trim();
    const names = Array.isArray(req.body?.names) ? req.body.names : [];
    const defaultStock = Number.isFinite(Number(req.body?.defaultStock))
      ? Number(req.body.defaultStock)
      : 0;
    const salePrice = Number.isFinite(Number(req.body?.salePrice))
      ? Number(req.body.salePrice)
      : 0;

    if (!categoryId) {
      return res.status(400).json({ message: "categoryId required" });
    }
    if (!names.length) {
      return res.status(400).json({ message: "names[] required" });
    }
    if (!Number.isFinite(defaultStock) || defaultStock < 0) {
      return res.status(400).json({ message: "defaultStock must be >= 0" });
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return res.status(400).json({ message: "salePrice must be >= 0" });
    }

    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return res.status(400).json({ message: "Category not found" });

    const cleaned = names.map((x) => String(x || "").trim()).filter(Boolean);

    const created = [];
    const skipped = [];

    for (const name of cleaned) {
      try {
        const p = await prisma.product.create({
          data: { name, categoryId, salePrice },
        });

        await prisma.stock.upsert({
          where: { productId: p.id },
          update: { quantity: defaultStock },
          create: { productId: p.id, quantity: defaultStock },
        });

        created.push(p);
      } catch (e) {
        skipped.push({ name, reason: e.message });
      }
    }

    return res.json({
      categoryId,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  },
);

// PUT /catalog/admin/stock/:productId
// body: { quantity: 10 }
router.put(
  "/stock/:productId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const productId = String(req.params.productId || "").trim();
    const quantity = Number(req.body?.quantity);

    if (!productId) {
      return res.status(400).json({ message: "productId required" });
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity must be >= 0" });
    }

    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return res.status(400).json({ message: "Product not found" });

    const stock = await prisma.stock.upsert({
      where: { productId },
      update: { quantity },
      create: { productId, quantity },
    });

    return res.json({ stock });
  },
);

module.exports = router;
