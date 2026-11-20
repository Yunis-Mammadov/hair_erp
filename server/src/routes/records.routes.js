const Q=require("../quantity");
const W = require("../workspace-core");
const express = require("express");

const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const F = require("../financial-core"),
  R = require("../records-core");
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));
const str = (value, max = 150) => F.text(value, max);
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
function readProducts(req) {
return rows(req.body).map((row, index) => {
      if(Object.keys(row).some(k=>!["name","category","sku","barcode","salePrice","quantity","unit","currency"].includes(k)))throw F.fail(400,`Row ${index+2}: unknown product column.`);
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
        ...(row.unit ? {unit:Q.unit(row.unit)} : {}),
        quantity: Q.quantity(row.quantity === "" || row.quantity === undefined ? 0 : row.quantity,row.unit||"PIECE",0,1000000000),
      };
    });
}
async function importProducts(tx,req,input) {
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
              unit: row.unit || "PIECE",
            },
          });
          await F.moveStock(tx, product.id, row.quantity, {
            user: req.user,
            kind: "OPENING",
            reason: "CSV: ilkin qalıq",
          });
        }
        return { imported: input.length };
}
router.post('/imports/products/preview', R.route(async(req,res)=>{
 const input=readProducts(req);
 // Exercise the exact write path, then deliberately roll it back.
 class Preview extends Error {constructor(result){super('preview');this.result=result;}}
 try{await F.transaction(async tx=>{throw new Preview(await importProducts(tx,req,input));});}
 catch(error){if(error instanceof Preview){res.json(error.result);return;}throw error;}
}));
router.post('/imports/products', R.route(async(req,res)=>{
 const input=readProducts(req);
 const result=await F.mutate(req,'import-products',input,tx=>importProducts(tx,req,input));
 res.status(result.replayed?200:201).json(result);
}));
const customerImport=require('../customer-import');
router.post('/imports/customers/preview', R.route(async(req,res)=>{
 const input=customerImport.input(req);
 const preview=await prisma.$transaction(tx=>customerImport.plan(tx,req,input),{isolationLevel:'RepeatableRead',timeout:20000});
 res.json(preview);
}));
router.post('/imports/customers', R.route(async(req,res)=>{
 const input=customerImport.input(req);
 const result=await F.mutate(req,'import-customers',input,tx=>customerImport.plan(tx,req,input,true));
 res.status(result.replayed?200:201).json(result);
}));
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
          "unit",
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
          r.unit,
        ],
      },
      customers: {
        model: "customer",
        include: {openingBalance:true},
        headers: ["externalId", "name", "phone", "salon", "address", "lat", "lng", "openingDebt", "openingCredit", "balanceDate", "currency"],
        map: (r) => [r.externalId,r.name,r.phone,r.salon,r.address,r.lat,r.lng,Math.max(Number(r.openingBalance?.amount||0),0),Math.max(-Number(r.openingBalance?.amount||0),0),r.openingBalance?W.localDay(r.openingBalance.balanceDate,req.company.timezone):'',req.company.currency],
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
