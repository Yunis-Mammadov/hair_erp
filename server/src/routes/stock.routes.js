const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const F = require("../financial-core"),
  R = require("../records-core");
const router = express.Router();
router.use(requireAuth);
router.get(
  "/",
  requireRole("ADMIN", "WAREHOUSE", "EXPEDITOR"),
  R.route(async (req, res) => {
    const p = R.page(req.query),
      base = {
        archivedAt: req.query.archived === "true" ? { not: null } : null,
      };
    if (req.query.categoryId) base.categoryId = F.id(req.query.categoryId);
    const search = F.text(req.query.search, 150);
    if (search)
      base.OR = ["name", "sku", "barcode"].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    const status = req.query.status || "ALL";
    if (!["ALL", "IN_STOCK", "LOW", "OUT"].includes(status))
      throw F.fail(400, "Stok filtri yanlışdır.");
    const where = { ...base };
    if (status === "IN_STOCK") where.stock = { quantity: { gt: 0 } };
    if (status === "LOW") where.stock = { quantity: { gt: 0, lte: 5 } };
    if (status === "OUT")
      where.AND = [{ OR: [{ stock: null }, { stock: { quantity: 0 } }] }];
    const result = await prisma.$transaction(
      async (tx) => {
        const [
          products,
          total,
          totalProducts,
          totalQuantity,
          outOfStock,
          lowStock,
        ] = await Promise.all([
          tx.product.findMany({
            where,
            include: { category: true, stock: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            skip: p.skip,
            take: p.take,
          }),
          tx.product.count({ where }),
          tx.product.count({ where: base }),
          tx.stock.aggregate({
            where: { product: base },
            _sum: { quantity: true },
          }),
          tx.product.count({
            where: {
              ...base,
              AND: [{ OR: [{ stock: null }, { stock: { quantity: 0 } }] }],
            },
          }),
          tx.product.count({
            where: { ...base, stock: { quantity: { gt: 0, lte: 5 } } },
          }),
        ]);
        return {
          items: products.map((product) => ({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            barcode: product.barcode,
            archivedAt: product.archivedAt,
            category: product.category,
            quantity: product.stock?.quantity || 0,
            version: product.stock?.version || 0,
            salePrice: Number(product.salePrice),
            updatedAt: product.stock?.updatedAt || product.updatedAt,
            status: !product.stock?.quantity
              ? "OUT"
              : product.stock.quantity <= 5
                ? "LOW"
                : "NORMAL",
          })),
          pagination: R.pagination(p, total),
          stats: {
            totalProducts,
            totalQuantity: totalQuantity._sum.quantity || 0,
            outOfStock,
            lowStock,
          },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    res.json(result);
  }),
);
router.get(
  "/:productId/movements",
  requireRole("ADMIN", "WAREHOUSE", "EXPEDITOR"),
  R.route(async (req, res) => {
    const productId = F.id(req.params.productId),
      p = R.page(req.query);
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw F.fail(404, "Məhsul tapılmadı.");
    const where = { productId };
    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.stockMovement.count({ where }),
    ]);
    res.json({
      product: { id: product.id, name: product.name, sku: product.sku },
      movements,
      pagination: R.pagination(p, total),
    });
  }),
);
router.patch(
  "/:productId",
  requireRole("ADMIN", "WAREHOUSE"),
  R.route(async (req, res) => {
    const input = {
      productId: F.id(req.params.productId),
      quantity: F.integer(req.body?.quantity, 0, 1000000000),
      expectedVersion: F.integer(req.body?.expectedVersion, 0, 2147483647),
      reason: F.text(req.body?.reason, 300),
    };
    if (!input.reason) throw F.fail(400, "Stok düzəlişinin səbəbini yaz.");
    const result = await F.mutate(req, "stock-count", input, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) throw F.fail(404, "Məhsul tapılmadı.");
      if (product.archivedAt)
        throw F.fail(409, "Əvvəl məhsulu arxivdən çıxar.");
      const stock = await tx.stock.findUnique({
        where: { productId: input.productId },
      });
      if (input.expectedVersion !== (stock?.version || 0))
        throw F.fail(
          409,
          "Stok dəyişib. Siyahını yenilə və sayımı yoxla.",
          "COUNT_CHANGED",
        );
      return {
        stock: await F.moveStock(
          tx,
          input.productId,
          input.quantity - (stock?.quantity || 0),
          { user: req.user, kind: "ADJUSTMENT", reason: input.reason },
        ),
      };
    });
    res.json(result);
  }),
);
module.exports = router;
