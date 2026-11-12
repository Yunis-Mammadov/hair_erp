const {log}=require("../ops/runtime");
const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const { hasFeature } = require("../config/plans");

const F = require("../financial-core");
const R = require("../records-core"), W = require("../workspace-core");
const router = express.Router();

/**
 * GET /returns
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const where = {};
      const page=R.page(req.query);
      if(req.query.startDate||req.query.endDate)where.createdAt=W.dateRange(req.query.startDate,req.query.endDate,req.company.timezone);
      const search=F.text(req.query.search,150);
      if(search)where.OR=[{customer:{name:{contains:search,mode:"insensitive"}}},{customer:{phone:{contains:search}}},{customer:{salon:{contains:search,mode:"insensitive"}}},{note:{contains:search,mode:"insensitive"}}];

      if (
        hasFeature(req.company, "customerAssignments") &&
        req.user.role === "EXPEDITOR"
      ) {
        where.customer = {
          assignedExpeditorId: req.user.userId,
        };
      }

      const total=await prisma.return.count({where});
      const returns = await prisma.return.findMany({
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
          items: {
            include: {
              product: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({ returns, pagination:R.pagination(page,total) });
    } catch (error) {
      log("GET_RETURNS_ERROR:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      F.errorResponse(res,error);
    }
  },
);

/**
 * GET /returns/:id
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const where = { id };

      if (
        hasFeature(req.company, "customerAssignments") &&
        req.user.role === "EXPEDITOR"
      ) {
        where.createdById = req.user.userId;
      }

      const returnData = await prisma.return.findFirst({
        where,
        include: {
          customer: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      res.json({ return: returnData });
    } catch (error) {
      log("Get single return error:",{code:error.code||error.type||"REQUEST_FAILED",name:error.name,status:error.status||error.statusCode||500});
      res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

// POST /returns — combine duplicates before allocation; lock against payment/edit/return races.
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE"),
  async (req, res) => {
    try {
      const input = {
        customerId: F.id(req.body?.customerId),
        note: F.text(req.body?.note),
        items: F.combine(req.body?.items),
      };
      const result = await F.mutate(req, "return", input, async (tx) => {
        await F.lockCustomer(tx, input.customerId, req);
        const allocations = [];
        for (const requested of input.items) {
          const state = await F.returnable(
            tx,
            input.customerId,
            requested.productId,
          );
          if (requested.quantity > state.available)
            throw F.fail(
              409,
              `Bu məhsul üçün maksimum ${state.available} ədəd qaytarmaq olar.`,
              "RETURN_LIMIT",
            );
          let skip = state.sold,
            left = requested.quantity;
          for (const item of state.items) {
            let available = Math.max(item.quantity - item.returnedQty, 0);
            const reserved = Math.min(skip, available);
            skip -= reserved;
            available -= reserved;
            const quantity = Math.min(left, available);
            if (!quantity) continue;
            allocations.push({
              orderItemId: item.id,
              productId: item.productId,
              quantity,
              unitPrice: item.unitPrice,
              previousReturned: item.returnedQty,
            });
            left -= quantity;
            if (!left) break;
          }
          if (left)
            throw F.fail(409, "Qaytarma miqdarı dəyişib. Yenidən cəhd et.");
        }
        const doc = await tx.return.create({
          data: {
            customerId: input.customerId,
            createdById: req.user.id,
            note: input.note,
            totalAmount: F.major(
              allocations.reduce(
                (sum, item) => sum + F.minor(item.unitPrice) * item.quantity,
                0,
              ),
            ),
          },
        });
        for (const { previousReturned, ...item } of allocations) {
          const updated = await tx.orderItem.updateMany({
            where: { id: item.orderItemId, returnedQty: previousReturned },
            data: { returnedQty: { increment: item.quantity } },
          });
          if (updated.count !== 1)
            throw F.fail(409, "Qaytarma miqdarı dəyişib. Yenidən cəhd et.");
          await tx.returnItem.create({ data: { ...item, returnId: doc.id } });
          await F.moveStock(tx, item.productId, item.quantity, {
            user: req.user,
            kind: "RETURN",
            reason: input.note || "Müştəri qaytarması",
            documentId: doc.id,
          });
        }
        const returnDoc = await tx.return.findUnique({
          where: { id: doc.id },
          include: {
            customer: true,
            createdBy: { select: { id: true, fullName: true, role: true } },
            items: {
              include: {
                product: { include: { category: true } },
                orderItem: true,
              },
            },
          },
        });
        return { returnDoc, summary: await F.account(tx, input.customerId) };
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return F.errorResponse(res, error);
    }
  },
);
module.exports = router;
