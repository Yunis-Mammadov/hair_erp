const router = require("express").Router(),
  { prisma } = require("../prismaClient"),
  F = require("../financial-core"),
  R = require("../records-core"),
  S = require("../statements");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
router.use(requireAuth);
router.get(
  "/aging",
  requireRole("ADMIN"),
  R.route(async (req, res) => {
    const data = await prisma.$transaction((tx) => S.aging(tx, req), {
      isolationLevel: "RepeatableRead",
      timeout: 20000,
    });
    const p = R.page(req.query);
    res.json({
      ...data,
      invoices: data.invoices.slice(p.skip, p.skip + p.take),
      pagination: R.pagination(p, data.invoices.length),
    });
  }),
);
router.get(
  "/customers/:id/aging",
  requireRole("ADMIN", "EXPEDITOR"),
  R.route(async (req, res) =>
    res.json(
      await prisma.$transaction((tx) => S.aging(tx, req, F.id(req.params.id)), {
        isolationLevel: "RepeatableRead",
      }),
    ),
  ),
);
router.get(
  "/customers/:id/statement",
  requireRole("ADMIN", "EXPEDITOR"),
  R.route(async (req, res) => {
    const data = await prisma.$transaction(
        (tx) => S.statement(tx, req, F.id(req.params.id)),
        { isolationLevel: "RepeatableRead", timeout: 20000 },
      ),
      p = R.page(req.query);
    res.json({
      ...data,
      rows: data.rows.slice(p.skip, p.skip + p.take),
      pagination: R.pagination(p, data.rows.length),
    });
  }),
);
router.get(
  "/customers/:id/statement.csv",
  requireRole("ADMIN", "EXPEDITOR"),
  R.route(async (req, res) => {
    const data = await prisma.$transaction(
        (tx) => S.statement(tx, req, F.id(req.params.id)),
        { isolationLevel: "RepeatableRead", timeout: 20000 },
      ),
      cell = require("./records.routes").csvCell;
    const rows = [
      ["type", "date", "reference", "debit", "credit", "balance", "currency"],
      [
        "OPENING",
        data.startDate || "",
        "",
        0,
        0,
        data.openingBalance,
        data.currency,
      ],
      ...data.rows.map((r) => [
        r.type,
        r.date.toISOString(),
        r.reference,
        r.debit,
        r.credit,
        r.balance,
        data.currency,
      ]),
      [
        "CLOSING",
        data.endDate || "",
        "",
        data.debits,
        data.credits,
        data.closingBalance,
        data.currency,
      ],
    ];
    res
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="statement.csv"',
        "Cache-Control": "no-store",
      })
      .send("\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n"));
  }),
);
router.get(
  "/invoices/:id.pdf",
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  R.route(async (req, res) => {
    const order = await prisma.$transaction(
      async (tx) => {
        const row = await tx.order.findFirst({
          where: { id: F.id(req.params.id), ...R.orderWhere(req) },
          include: R.orderInclude,
        });
        if (!row) throw F.fail(404, "Invoice not found.");
        return {
          ...R.presentOrder(row),
          ...(await R.orderFinancials(tx, row.customerId)).get(row.id),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    const buffer = await require("../pdf-documents").invoice(
      order,
      S.language(req),
    );
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="invoice.pdf"',
        "Cache-Control": "no-store",
      })
      .send(buffer);
  }),
);
router.get(
  "/customers/:id/statement.pdf",
  requireRole("ADMIN", "EXPEDITOR"),
  R.route(async (req, res) => {
    const data = await prisma.$transaction(
      (tx) => S.statement(tx, req, F.id(req.params.id)),
      { isolationLevel: "RepeatableRead", timeout: 20000 },
    );
    const buffer = await require("../pdf-documents").statement(
      data,
      S.language(req),
    );
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="statement.pdf"',
        "Cache-Control": "no-store",
      })
      .send(buffer);
  }),
);
router.use(require("./reminders.routes"));
module.exports = router;
