const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// Create Order (Sale) - transactional stock decrement
router.post(
  "/orders",
  requireAuth,
  requireRole("EXPEDITOR", "ADMIN"),
  async (req, res) => {
    const { customer, paymentType, note, items } = req.body;

    if (!customerId && (!customerName || !customerPhone)) {
      return res
        .status(400)
        .json({ message: "customer name and phone required" });
    }
    if (!paymentType) {
      return res.status(400).json({ message: "paymentType required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items required" });
    }

    // items: [{productId, quantity}]
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0) {
        return res.status(400).json({ message: "Invalid item payload" });
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // upsert customer by phone (simple rule)
        const existingCustomer = await tx.customer.findFirst({
          where: { phone: customer.phone },
        });

        const cust = existingCustomer
          ? await tx.customer.update({
              where: { id: existingCustomer.id },
              data: {
                name: customer.name,
                salon: customer.salon ?? null,
                address: customer.address ?? null,
              },
            })
          : await tx.customer.create({
              data: {
                name: customer.name,
                phone: customer.phone,
                salon: customer.salon ?? null,
                address: customer.address ?? null,
              },
            });

        // stock check + decrement
        for (const it of items) {
          const stock = await tx.stock.findUnique({
            where: { productId: it.productId },
          });
          const currentQty = stock?.quantity ?? 0;
          if (currentQty < it.quantity) {
            throw new Error(`OUT_OF_STOCK:${it.productId}:${currentQty}`);
          }
          await tx.stock.upsert({
            where: { productId: it.productId },
            update: { quantity: { decrement: it.quantity } },
            create: { productId: it.productId, quantity: 0 - it.quantity },
          });
        }

        const order = await tx.order.create({
          data: {
            customerId: cust.id,
            createdById: req.user.userId,
            paymentType,
            note: note ?? null,
            items: {
              create: items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
              })),
            },
          },
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        });

        return order;
      });

      return res.json({ order: result });
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.startsWith("OUT_OF_STOCK:")) {
        const [, productId, currentQty] = msg.split(":");
        return res.status(409).json({
          message: "Out of stock",
          productId,
          currentQty: Number(currentQty),
        });
      }
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

// Create Return - transactional stock increment
router.post(
  "/returns",
  requireAuth,
  requireRole("EXPEDITOR", "ADMIN"),
  async (req, res) => {
    const { customerId, note, items } = req.body;

    if (!customerId)
      return res.status(400).json({ message: "customerId required" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items required" });
    }
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0) {
        return res.status(400).json({ message: "Invalid item payload" });
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // stock increment
        for (const it of items) {
          await tx.stock.upsert({
            where: { productId: it.productId },
            update: { quantity: { increment: it.quantity } },
            create: { productId: it.productId, quantity: it.quantity },
          });
        }

        const ret = await tx.return.create({
          data: {
            customerId,
            createdById: req.user.userId,
            note: note ?? null,
            items: {
              create: items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
              })),
            },
          },
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        });

        return ret;
      });

      return res.json({ return: result });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
