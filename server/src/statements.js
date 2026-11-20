const F = require("./financial-core"),
  R = require("./records-core"),
  W = require("./workspace-core");
const localeCodes = { en: "en-US", az: "az-AZ", tr: "tr-TR", ru: "ru-RU" };
function language(req) {
  const l = String(
    req.query.locale || req.get("Accept-Language") || "en",
  ).split(/[-,;]/)[0];
  return localeCodes[l] ? l : "en";
}
function calendarDay(value, zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
function ageDays(createdAt, now, zone) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(calendarDay(now, zone)) -
        Date.parse(calendarDay(createdAt, zone))) /
        86400000,
    ),
  );
}
async function aging(tx, req, customerId, now = new Date()) {
  const customers = customerId
    ? [await R.allowedCustomer(tx, req, customerId)]
    : await tx.customer.findMany({
        where: R.customerWhere(req),
        select: { id: true, name: true, phone: true, salon: true },
      });
  const rows = [];
  const cents = [0, 0, 0];
  const all = await R.orderFinancialsMany(
    tx,
    customers.map((c) => c.id),
  );
  for (const customer of customers) {
    const { orders, amounts } = all.get(customer.id);
    for (const o of orders) {
      const debt = F.minor(amounts.get(o.id).remainingDebt);
      if (!debt) continue;
      const days = ageDays(o.createdAt, now, req.company.timezone),
        bucket = days <= 30 ? 0 : days <= 60 ? 1 : 2;
      cents[bucket] += debt;
      rows.push({
        ...o,
        customerId: customer.id,
        customerName: customer.name,
        ageDays: days,
        bucket: ["days0to30", "days31to60", "days61plus"][bucket],
        remainingDebt: F.major(debt),
      });
    }
  }
  rows.sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));
  return {
    asOf: now,
    currency: req.company.currency,
    timezone: req.company.timezone,
    days0to30: F.major(cents[0]),
    days31to60: F.major(cents[1]),
    days61plus: F.major(cents[2]),
    totalDebt: F.major(cents.reduce((a, b) => a + b, 0)),
    invoices: rows,
  };
}
async function statement(tx, req, customerId) {
  const customer = await R.allowedCustomer(tx, req, customerId);
  const range =
    W.dateRange(req.query.startDate, req.query.endDate, req.company.timezone) ||
    {};
  const max = 10000;
  const createdAt = range.lt ? { lt: range.lt } : undefined;
  const [orders, returns, payments, refunds, openingEntry] = await Promise.all([
    tx.order.findMany({
      where: { customerId, ...(createdAt ? { createdAt } : {}) },
      select: {
        id: true,
        invoiceNumber: true,
        orderNumber: true,
        totalAmount: true,
        createdAt: true,
      },
      take: max + 1,
    }),
    tx.return.findMany({
      where: { customerId, ...(createdAt ? { createdAt } : {}) },
      select: { id: true, totalAmount: true, createdAt: true },
      take: max + 1,
    }),
    tx.payment.findMany({
      where: { customerId, ...(createdAt ? { createdAt } : {}) },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        voidedAt: true,
        paymentType: true,
      },
      take: max + 1,
    }),
    tx.customerRefund.findMany({
      where: { customerId, ...(createdAt ? { createdAt } : {}) },
      select: { id: true, amount: true, createdAt: true },
      take: max + 1,
    }),
    tx.customerOpeningBalance.findUnique({where:{customerId}}),
  ]);
  if (
    orders.length +
      returns.length +
      payments.length +
      payments.filter((p) => p.voidedAt && (!range.lt || p.voidedAt < range.lt))
        .length +
      refunds.length >
    max
  )
    throw F.fail(
      413,
      "Statement exceeds 10,000 events. Choose an earlier end date.",
      "STATEMENT_LIMIT",
    );
  let events = [];
  if(openingEntry && (!range.lt || openingEntry.balanceDate < range.lt)) events.push({id:openingEntry.id,type:'OPENING_BALANCE',date:openingEntry.balanceDate,reference:openingEntry.source,debit:Math.max(F.minor(openingEntry.amount),0),credit:Math.max(-F.minor(openingEntry.amount),0)});
  for (const o of orders)
    events.push({
      id: o.id,
      type: "SALE",
      date: o.createdAt,
      reference: o.invoiceNumber || String(o.orderNumber).padStart(5, "0"),
      debit: F.minor(o.totalAmount),
      credit: 0,
    });
  for (const r of returns)
    events.push({
      id: r.id,
      type: "RETURN",
      date: r.createdAt,
      reference: r.id.slice(-8),
      debit: 0,
      credit: F.minor(r.totalAmount),
    });
  for (const p of payments) {
    events.push({
      id: p.id,
      type: "PAYMENT",
      date: p.createdAt,
      reference: p.id.slice(-8),
      debit: 0,
      credit: F.minor(p.amount),
    });
    if (p.voidedAt && (!range.lt || p.voidedAt < range.lt))
      events.push({
        id: p.id + ":void",
        type: "PAYMENT_VOID",
        date: p.voidedAt,
        reference: p.id.slice(-8),
        debit: F.minor(p.amount),
        credit: 0,
      });
  }
  for (const r of refunds)
    events.push({
      id: r.id,
      type: "REFUND",
      date: r.createdAt,
      reference: r.id.slice(-8),
      debit: F.minor(r.amount),
      credit: 0,
    });
  const order = ["OPENING_BALANCE", "SALE", "RETURN", "PAYMENT", "PAYMENT_VOID", "REFUND"];
  events.sort(
    (a, b) =>
      +a.date - +b.date ||
      order.indexOf(a.type) - order.indexOf(b.type) ||
      a.id.localeCompare(b.id),
  );
  let balance = 0,
    opening = 0,
    debits = 0,
    credits = 0;
  const rows = [];
  for (const e of events) {
    balance += e.debit - e.credit;
    if (range.gte && e.date < range.gte) {
      opening = balance;
      continue;
    }
    debits += e.debit;
    credits += e.credit;
    rows.push({
      ...e,
      debit: F.major(e.debit),
      credit: F.major(e.credit),
      balance: F.major(balance),
    });
  }
  const amounts = await R.orderFinancials(tx, customerId);
  const invoices = await tx.order.findMany({
    where: { customerId },
    select: {
      id: true,
      invoiceNumber: true,
      orderNumber: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      salon: customer.salon,
      address: customer.address,
    },
    company: {
      name: req.company.name,
      address: req.company.address,
      phone: req.company.phone,
      taxId: req.company.taxId,
    },
    currency: req.company.currency,
    timezone: req.company.timezone,
    generatedAt: new Date(),
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null,
    openingBalance: F.major(opening),
    debits: F.major(debits),
    credits: F.major(credits),
    closingBalance: F.major(balance),
    rows,
    invoices: invoices.map((o) => ({ ...o, ...amounts.get(o.id) })),
    summary: await F.account(tx, customerId),
  };
}
module.exports = { language, localeCodes, ageDays, aging, statement };
