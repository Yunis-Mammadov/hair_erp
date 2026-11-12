const W = require("../workspace-core");
const express = require("express");

const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const F = require("../financial-core"),
  R = require("../records-core");
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));
const str = (value, max = 150) => F.text(value, max);
function number(value, min, max) {
  return F.integer(value === "" || value === undefined ? 0 : value, min, max);
}
function coordinate(value, max) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > max)
    throw F.fail(400, "Koordinat yanlışdır.");
  return n;
}
function rows(body) {
  if (
    !Array.isArray(body?.rows) ||
    body.rows.length < 1 ||
    body.rows.length > 200
  )
    throw F.fail(400, "Bir faylda 1–200 sətir olmalıdır.");
  if (body.rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)))
    throw F.fail(400, "CSV sətrləri yanlışdır.");
  return body.rows;
}
router.post(
  "/imports/products",
  R.route(async (req, res) => {
    const input = rows(req.body).map((row, index) => {
      if (row.currency && row.currency !== req.company.currency) throw F.fail(409, "CSV currency does not match the company currency.", "CURRENCY_MISMATCH");
      const name = str(row.name),
        category = str(row.category);
      if (!name || !category)
        throw F.fail(400, `Sətir ${index + 2}: ad və kateqoriya lazımdır.`);
      return {
        name,
        category,
        sku: str(row.sku, 80),
        barcode: str(row.barcode, 80),
        salePrice: F.money(
          row.salePrice === "" || row.salePrice === undefined
            ? 0
            : row.salePrice,
          true,
        ),
        quantity: number(row.quantity, 0, 1000000000),
      };
    });
    res.status(201).json(
      await F.mutate(req, "import-products", input, async (tx) => {
        for (let i = 0; i < input.length; i++) {
          const row = input[i];
          let category = await tx.category.findFirst({
            where: { name: { equals: row.category, mode: "insensitive" } },
          });
          if (!category)
            category = await tx.category.create({
              data: { name: row.category },
            });
          const duplicate = await tx.product.findFirst({
            where: {
              OR: [
                { name: row.name, categoryId: category.id },
                ...(row.sku ? [{ sku: row.sku }] : []),
                ...(row.barcode ? [{ barcode: row.barcode }] : []),
              ],
            },
          });
          if (duplicate)
            throw F.fail(
              409,
              `Sətir ${i + 2}: məhsul, SKU və ya barkod artıq var. Heç bir sətir əlavə edilmədi.`,
            );
          const product = await tx.product.create({
            data: {
              name: row.name,
              categoryId: category.id,
              sku: row.sku,
              barcode: row.barcode,
              salePrice: row.salePrice,
            },
          });
          await F.moveStock(tx, product.id, row.quantity, {
            user: req.user,
            kind: "OPENING",
            reason: "CSV: ilkin qalıq",
          });
        }
        return { imported: input.length };
      }),
    );
  }),
);
router.post(
  "/imports/customers",
  R.route(async (req, res) => {
    const input = rows(req.body).map((row, index) => {
      const name = str(row.name);
      if (!name || name.length < 2)
        throw F.fail(400, `Sətir ${index + 2}: müştəri adı lazımdır.`);
      const lat = coordinate(row.lat, 90),
        lng = coordinate(row.lng, 180);
      if ((lat === null) !== (lng === null))
        throw F.fail(400, "Hər iki koordinatı yaz.");
      return {
        name,
        phone: str(row.phone, 80)?.replace(/^'(?=[+\d])/, "") || null,
        salon: str(row.salon),
        address: str(row.address, 500),
        lat,
        lng,
      };
    });
    res.status(201).json(
      await F.mutate(req, "import-customers", input, async (tx) => {
        for (let i = 0; i < input.length; i++) {
          const row = input[i];
          if (
            await tx.customer.findFirst({
              where: row.phone
                ? { phone: row.phone }
                : { name: row.name, salon: row.salon },
            })
          )
            throw F.fail(
              409,
              `Sətir ${i + 2}: müştəri artıq var. Heç bir sətir əlavə edilmədi.`,
            );
          await tx.customer.create({ data: row });
        }
        return { imported: input.length };
      }),
    );
  }),
);
// Prefix formula-like strings before CSV quoting; Excel must never execute user data.
function cell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
const line = (values) => values.map(cell).join(",") + "\r\n";
router.get(
  "/exports/:kind",
  R.route(async (req, res) => {
    const configs = {
      products: {
        model: "product",
        include: { category: true, stock: true },
        headers: [
          "name",
          "category",
          "sku",
          "barcode",
          "salePrice",
          "quantity",
          "archived",
          "currency",
        ],
        map: (r) => [
          r.name,
          r.category.name,
          r.sku,
          r.barcode,
          r.salePrice,
          r.stock?.quantity || 0,
          !!r.archivedAt,
          req.company.currency,
        ],
      },
      customers: {
        model: "customer",
        headers: ["name", "phone", "salon", "address", "lat", "lng"],
        map: (r) => [r.name, r.phone, r.salon, r.address, r.lat, r.lng],
      },
      sales: {
        model: "order",
        headers: [
          "invoiceNumber",
          "date",
          "customer",
          "seller",
          "currency",
          "total",
        ],
        map: (r) => [
          r.invoiceNumber,
          r.createdAt.toISOString(),
          r.customerSnapshot?.name,
          r.companySnapshot?.issuedBy,
          r.currency,
          r.totalAmount,
        ],
      },
      payments: {
        model: "payment",
        include: { customer: true },
        headers: ["date", "customer", "amount", "currency", "method", "note", "status", "voidedAt", "voidReason"],
        map: (r) => [
          r.createdAt.toISOString(),
          r.customer.name,
          r.amount,
          req.company.currency,
          r.paymentType,
          r.note,
          r.voidedAt ? "VOIDED" : "ACTIVE",
          r.voidedAt?.toISOString() || "",
          r.voidReason || "",
        ],
      },
    };
    const config = configs[req.params.kind];
    if (!config) throw F.fail(404, "Export tapılmadı.");
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${req.params.kind}.csv"`,
      "Cache-Control": "no-store",
    });
    let closed = false;
    res.on("close", () => {
      closed = true;
    });
    async function write(text) {
      if (closed) return false;
      if (!res.write(text)) {
        await new Promise((resolve) => {
          const done = () => {
            res.off("drain", done);
            res.off("close", done);
            resolve();
          };
          res.once("drain", done);
          res.once("close", done);
        });
      }
      return !closed;
    }
    await write("\uFEFF" + line(config.headers));
    let cursor;
    while (!closed) {
      const batch = await prisma[config.model].findMany({
        ...(config.include ? { include: config.include } : {}),
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length) break;
      for (const row of batch) if (!(await write(line(config.map(row))))) break;
      cursor = batch.at(-1).id;
      if (batch.length < 200) break;
    }
    if (!closed) res.end();
  }),
);
module.exports = router;
module.exports.csvCell = cell;
