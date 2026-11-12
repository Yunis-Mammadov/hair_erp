const {log}=require("../ops/runtime");
const W = require("../workspace-core");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const { normalizeUploadUrl } = require("../upload-access");
const { hasFeature } = require("../config/plans");

const F = require("../financial-core");
const R = require("../records-core");
const router = express.Router();

// GET /payments
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const {
        search = "",
        startDate = "",
        endDate = "",
        expeditorId = "",
      } = req.query;

      const where = {};
      if (req.query.customerId) where.customerId=F.id(req.query.customerId);
      const page=R.page(req.query);

      if (
        hasFeature(req.company, "customerAssignments") &&
        req.user.role === "EXPEDITOR"
      ) {
        where.customer = {
          assignedExpeditorId: req.user.userId,
        };
      } else if (
        hasFeature(req.company, "customerAssignments") &&
        expeditorId &&
        String(expeditorId).trim()
      ) {
        where.customer = {
          assignedExpeditorId: String(expeditorId).trim(),
        };
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.customer = {
          ...(where.customer || {}),
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { salon: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        };
      }

      if (startDate || endDate) where.createdAt = W.dateRange(startDate, endDate, req.company.timezone);

      const total=await prisma.payment.count({where});
      const payments = await prisma.payment.findMany({
        skip:page.skip,take:page.take,
        where,
        include: {
          customer: {
            include: {
              assignedExpeditor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          soldItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json({ payments, pagination:R.pagination(page,total) });
    } catch (error) {
      log("GET_PAYMENTS_ERROR:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      return F.errorResponse(res, error);
    }
  },
);

// POST /payments — exact money, customer lock, bounded sold-items and persistent retries.
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const b = req.body || {};
      if (b.soldItems !== undefined && !Array.isArray(b.soldItems))
        throw F.fail(400, "soldItems siyahı olmalıdır.");
      const input = {
        customerId: F.id(b.customerId),
        ...(b.orderId ? {orderId:F.id(b.orderId)} : {}),
        amount: F.money(b.amount),
        note: F.text(b.note),
        paymentType: F.text(b.paymentType, 100),
        date: b.date || null,
        imageUrl: b.imageUrl
          ? normalizeUploadUrl(b.imageUrl, req.company)
          : null,
        soldItems: (b.soldItems || []).length ? F.combine(b.soldItems) : [],
      };
      input.soldItems = input.soldItems.map((item) => ({
        ...item,
        note: F.text(
          (b.soldItems || [])
            .filter((x) => x.productId === item.productId)
            .map((x) => F.text(x.note, 300))
            .filter(Boolean)
            .join(" | "),
          1000,
        ),
      }));
      if (
        input.date &&
        (typeof input.date !== "string" ||
          !Number.isFinite(new Date(input.date).getTime()))
      )
        throw F.fail(400, "Ödəniş tarixi yanlışdır.");
      const result = await F.mutate(req, "payment", input, async (tx) => {
        await F.lockCustomer(tx, input.customerId, req);
        if (input.orderId) {
          if (!await tx.order.findFirst({where:{id:input.orderId,customerId:input.customerId},select:{id:true}})) throw F.fail(404,"Invoice not found.");
          const invoice=(await R.orderFinancials(tx,input.customerId)).get(input.orderId);
          if(F.minor(input.amount)>F.minor(invoice.remainingDebt))throw F.fail(409,"Payment exceeds the invoice balance.","PAYMENT_LIMIT");
        }
        const balance = await F.account(tx, input.customerId);
        if (F.minor(input.amount) > F.minor(balance.debt))
          throw F.fail(
            409,
            `Ödəniş qalan borcu aşır. Qalan borc ${balance.debt.toFixed(2)}-dir.`,
            "PAYMENT_LIMIT",
          );
        for (const item of input.soldItems) {
          const available = await F.returnable(
            tx,
            input.customerId,
            item.productId,
          );
          if (item.quantity > available.available)
            throw F.fail(
              409,
              "Satılmış məhsul miqdarı qalan uyğun miqdarı aşır.",
              "SOLD_ITEM_LIMIT",
            );
        }
        const payment = await tx.payment.create({
          data: {
            customerId: input.customerId,
            orderId: input.orderId || null,
            amount: input.amount,
            note: input.note,
            paymentType: input.paymentType,
            paymentDate: input.date ? (/^\d{4}-\d{2}-\d{2}$/.test(input.date) ? W.zonedDay(input.date, req.company.timezone) : new Date(input.date)) : new Date(),
            imageUrl: input.imageUrl,
            createdById: req.user.id,
            soldItems: { create: input.soldItems },
          },
          include: {
            customer: {
              include: {
                assignedExpeditor: {
                  select: { id: true, fullName: true, role: true },
                },
              },
            },
            createdBy: { select: { id: true, fullName: true, role: true } },
            soldItems: { include: { product: true } },
          },
        });
        return { payment, summary: await F.account(tx, input.customerId) };
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return F.errorResponse(res, error);
    }
  },
);
router.post("/:id/void", requireAuth, requireRole("ADMIN"), R.route(async(req,res)=>{
 const input={paymentId:F.id(req.params.id),reason:F.text(req.body?.reason,300)};
 if(!input.reason || input.reason.length<3)throw F.fail(400,"Enter a reason of at least three characters.","REASON_REQUIRED");
 const result=await F.mutate(req,"void-payment:"+input.paymentId,input,async tx=>{
  const payment=await tx.payment.findUnique({where:{id:input.paymentId}});
  if(!payment)throw F.fail(404,"Payment not found.");
  await F.lockCustomer(tx,payment.customerId,req);
  if(payment.voidedAt)throw F.fail(409,"This payment has already been voided.","ALREADY_VOIDED");
  const balance=await F.account(tx,payment.customerId);
  if(F.minor(balance.paymentTotal)-F.minor(payment.amount)<F.minor(balance.refundTotal))throw F.fail(409,"This payment has been refunded and cannot be voided.","REFUNDED_PAYMENT");
  const updated=await tx.payment.update({where:{id:payment.id},data:{voidedAt:new Date(),voidedById:req.user.id,voidReason:input.reason}});
  return {payment:updated,summary:await F.account(tx,payment.customerId)};
 });res.json(result);
}));
router.post("/refunds", requireAuth, requireRole("ADMIN"), R.route(async(req,res)=>{
 const input={customerId:F.id(req.body?.customerId),amount:F.money(req.body?.amount),method:F.text(req.body?.method,20)||"CASH",note:F.text(req.body?.note,300)};
 if(!["CASH","BANK","CARD"].includes(input.method))throw F.fail(400,"Choose a payment method.");
 if(!input.note || input.note.length<3)throw F.fail(400,"Enter a reason of at least three characters.","REASON_REQUIRED");
 const result=await F.mutate(req,"customer-refund",input,async tx=>{
  await F.lockCustomer(tx,input.customerId,req);
  const balance=await F.account(tx,input.customerId);
  if(F.minor(input.amount)>F.minor(balance.credit))throw F.fail(409,"Refund exceeds the available customer credit.","REFUND_LIMIT");
  const refund=await tx.customerRefund.create({data:{...input,createdById:req.user.id}});
  return {refund,summary:await F.account(tx,input.customerId)};
 });res.status(result.replayed?200:201).json(result);
}));
module.exports = router;
