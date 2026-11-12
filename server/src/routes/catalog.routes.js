const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const F = require("../financial-core"),
  R = require("../records-core");
const router = express.Router();
router.use(
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
);
router.get(
  "/categories",
  R.route(async (_req, res) =>
    res.json({
      categories: await prisma.category.findMany({ orderBy: { name: "asc" } }),
    }),
  ),
);
router.get(
  "/products",
  R.route(async (req, res) => {
    const p = R.page(req.query),
      where = { archivedAt: null };
    if (req.query.categoryId) where.categoryId = F.id(req.query.categoryId);
    const search = F.text(req.query.search, 150);
    if (search)
      where.OR = ["name", "sku", "barcode"].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, stock: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: Number(p.salePrice),
        stockQty: p.stock?.quantity || 0,
        category: p.category,
      })),
      pagination: R.pagination(p, total),
    });
  }),
);
module.exports = router;
