const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const F = require("../financial-core"),
  R = require("../records-core");
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));
const include = { category: true, stock: true };
const code = (value) => F.text(value, 80) || null;
function productInput(body) {
  const name = F.text(body.name, 150);
  if (!name) throw F.fail(400, "Məhsul adını yaz.");
  return {
    name,
    categoryId: F.id(body.categoryId),
    salePrice: F.money(body.salePrice === undefined ? 0 : body.salePrice, true),
    sku: code(body.sku),
    barcode: code(body.barcode),
  };
}
async function category(tx, id) {
  if (!(await tx.category.findUnique({ where: { id } })))
    throw F.fail(400, "Kateqoriya tapılmadı.");
}
router.get(
  "/categories",
  R.route(async (req, res) =>
    res.json({
      categories: await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      }),
    }),
  ),
);
router.post(
  "/categories",
  R.route(async (req, res) => {
    const name = F.text(req.body?.name, 150);
    if (!name) throw F.fail(400, "Kateqoriya adını yaz.");
    res.json(
      await F.mutate(req, "category-create", { name }, async (tx) => {
        if (
          await tx.category.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          })
        )
          throw F.fail(400, "Kateqoriya artıq var.");
        return { category: await tx.category.create({ data: { name } }) };
      }),
    );
  }),
);
router.get(
  "/products",
  R.route(async (req, res) => {
    const p = R.page(req.query),
      where = {
        archivedAt: req.query.archived === "true" ? { not: null } : null,
      };
    if (req.query.categoryId) where.categoryId = F.id(req.query.categoryId);
    const search = F.text(req.query.search, 150);
    if (search)
      where.OR = ["name", "sku", "barcode"].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, pagination: R.pagination(p, total) });
  }),
);
router.post(
  "/products",
  R.route(async (req, res) => {
    const input = {
      ...productInput(req.body || {}),
      quantity: F.integer(
        req.body?.quantity === undefined ? 0 : req.body.quantity,
        0,
        1000000000,
      ),
    };
    res.json(
      await F.mutate(req, "product-create", input, async (tx) => {
        await category(tx, input.categoryId);
        const { quantity, ...data } = input;
        const product = await tx.product.create({ data });
        await F.moveStock(tx, product.id, quantity, {
          user: req.user,
          kind: "OPENING",
          reason: "Yeni məhsulun ilkin qalığı",
        });
        return {
          product: await tx.product.findUnique({
            where: { id: product.id },
            include,
          }),
        };
      }),
    );
  }),
);
router.post(
  "/products/bulk",
  R.route(async (req, res) => {
    if (
      !Array.isArray(req.body?.names) ||
      !req.body.names.length ||
      req.body.names.length > 200
    )
      throw F.fail(400, "1–200 məhsul adı göndər.");
    const input = {
      categoryId: F.id(req.body?.categoryId),
      names: req.body.names.map((n) => F.text(n, 150)),
      defaultStock: F.integer(
        req.body?.defaultStock === undefined ? 0 : req.body.defaultStock,
        0,
        1000000000,
      ),
      salePrice: F.money(
        req.body?.salePrice === undefined ? 0 : req.body.salePrice,
        true,
      ),
    };
    if (input.names.some((n) => !n))
      throw F.fail(400, "Məhsul adı boş ola bilməz.");
    res.json(
      await F.mutate(req, "product-bulk", input, async (tx) => {
        await category(tx, input.categoryId);
        const created = [],
          skipped = [];
        for (const name of input.names) {
          if (
            await tx.product.findFirst({
              where: { name, categoryId: input.categoryId },
            })
          ) {
            skipped.push({ name, reason: "Məhsul artıq var" });
            continue;
          }
          const product = await tx.product.create({
            data: {
              name,
              categoryId: input.categoryId,
              salePrice: input.salePrice,
            },
          });
          await F.moveStock(tx, product.id, input.defaultStock, {
            user: req.user,
            kind: "OPENING",
            reason: "Toplu əlavə: ilkin qalıq",
          });
          created.push(
            await tx.product.findUnique({ where: { id: product.id }, include }),
          );
        }
        return {
          categoryId: input.categoryId,
          createdCount: created.length,
          skippedCount: skipped.length,
          created,
          skipped,
        };
      }),
    );
  }),
);
router.patch(
  "/products/:id",
  R.route(async (req, res) => {
    const id = F.id(req.params.id),
      body = req.body || {};
    const input =
      body.archived !== undefined
        ? { id, archived: body.archived }
        : { id, ...productInput(body) };
    if (input.archived !== undefined && typeof input.archived !== "boolean")
      throw F.fail(400, "Arxiv seçimi yanlışdır.");
    res.json(
      await F.mutate(req, "product-update", input, async (tx) => {
        const existing = await tx.product.findUnique({
          where: { id },
          include: { stock: true },
        });
        if (!existing) throw F.fail(404, "Məhsul tapılmadı.");
        let data;
        if (input.archived !== undefined) {
          if (input.archived && existing.stock?.quantity)
            throw F.fail(
              409,
              "Yalnız qalığı sıfır olan məhsulu arxivləmək olar.",
            );
          data = { archivedAt: input.archived ? new Date() : null };
        } else {
          await category(tx, input.categoryId);
          const { id: ignored, ...fields } = input;
          data = fields;
        }
        return {
          product: await tx.product.update({ where: { id }, data, include }),
        };
      }),
    );
  }),
);
router.put("/stock/:productId", (req, res, next) => {
  req.method = "PATCH";
  req.url = "/" + encodeURIComponent(req.params.productId);
  require("./stock.routes")(req, res, next);
});
module.exports = router;
