const express = require("express");
const { prisma } = require("../prismaClient");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

function calcOrderTotal(orders = []) {
  return orders.reduce((sum, order) => {
    const itemsTotal = (order.items || []).reduce((itemSum, item) => {
      if (item.isGift) return itemSum;
      return itemSum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);

    return sum + itemsTotal;
  }, 0);
}

function calcPaymentTotal(payments = []) {
  return payments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);
}

function calcReturnTotal(returns = []) {
  return returns.reduce((sum, ret) => {
    const itemsTotal = (ret.items || []).reduce((itemSum, item) => {
      return itemSum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);

    return sum + itemsTotal;
  }, 0);
}

function attachCustomerSummary(customer) {
  const orderTotal = calcOrderTotal(customer.orders);
  const paymentTotal = calcPaymentTotal(customer.payments);
  const returnTotal = calcReturnTotal(customer.returns);
  const debt = Math.max(orderTotal - paymentTotal - returnTotal, 0);

  return {
    ...customer,
    summary: {
      orderTotal,
      paymentTotal,
      returnTotal,
      debt,
      ordersCount: customer.orders?.length || 0,
      returnsCount: customer.returns?.length || 0,
      paymentsCount: customer.payments?.length || 0,
    },
  };
}

function buildOrderFinancials(customer) {
  const orders = [...(customer.orders || [])]
    .map((order) => {
      const totalAmount = (order.items || []).reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
      }, 0);

      return {
        ...order,
        totalAmount,
        allocatedPayment: 0,
        allocatedReturn: 0,
        remainingDebt: totalAmount,
        financialStatus: "BORCLU",
      };
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let paymentPool = (customer.payments || []).reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);

  let returnPool = (customer.returns || []).reduce((sum, ret) => {
    const returnTotal = (ret.items || []).reduce((itemSum, item) => {
      return itemSum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);

    return sum + returnTotal;
  }, 0);

  for (const order of orders) {
    if (paymentPool > 0) {
      const paymentAllocated = Math.min(order.remainingDebt, paymentPool);
      order.allocatedPayment += paymentAllocated;
      order.remainingDebt -= paymentAllocated;
      paymentPool -= paymentAllocated;
    }

    if (returnPool > 0) {
      const returnAllocated = Math.min(order.remainingDebt, returnPool);
      order.allocatedReturn += returnAllocated;
      order.remainingDebt -= returnAllocated;
      returnPool -= returnAllocated;
    }

    order.remainingDebt = Math.max(order.remainingDebt, 0);

    if (order.remainingDebt <= 0) {
      order.financialStatus = "ODENIB";
    } else if (order.allocatedPayment > 0 || order.allocatedReturn > 0) {
      order.financialStatus = "QISMEN_ODENIB";
    } else {
      order.financialStatus = "BORCLU";
    }
  }

  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// GET /customers
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const isExpeditor = req.user.role === "EXPEDITOR";
      const { search = "", expeditorId = "" } = req.query;

      const where = {};

      if (isExpeditor) {
        where.assignedExpeditorId = req.user.userId;
      } else if (expeditorId && String(expeditorId).trim()) {
        where.assignedExpeditorId = String(expeditorId).trim();
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();

        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { salon: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where,
        include: {
          assignedExpeditor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          orders: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
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
            orderBy: {
              createdAt: "desc",
            },
          },
          returns: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
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
            orderBy: {
              createdAt: "desc",
            },
          },
          payments: {
            include: {
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
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const customersWithSummary = customers.map(attachCustomerSummary);

      return res.json({ customers: customersWithSummary });
    } catch (error) {
      console.error("GET_CUSTOMERS_ERROR:", error);
      return res.status(500).json({ message: "Müştərilər alınmadı" });
    }
  },
);

// GET /customers/:id
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const isExpeditor = req.user.role === "EXPEDITOR";

      const customerWhere = { id };

      if (isExpeditor) {
        customerWhere.assignedExpeditorId = req.user.userId;
      }

      const customer = await prisma.customer.findFirst({
        where: customerWhere,
        include: {
          assignedExpeditor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          orders: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
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
            orderBy: {
              createdAt: "desc",
            },
          },
          returns: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
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
            orderBy: {
              createdAt: "desc",
            },
          },
          payments: {
            include: {
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
          },
        },
      });

      if (!customer) {
        return res.status(404).json({ message: "Müştəri tapılmadı" });
      }

      const customerWithSummary = attachCustomerSummary(customer);
      const ordersWithFinancials = buildOrderFinancials(customerWithSummary);

      return res.json({
        customer: {
          ...customerWithSummary,
          orders: ordersWithFinancials,
        },
        summary: customerWithSummary.summary,
      });
    } catch (error) {
      console.error("GET_CUSTOMER_DETAIL_ERROR:", error);
      return res.status(500).json({
        message: "Müştəri detalı gətirilə bilmədi",
      });
    }
  },
);

// POST /customers
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  async (req, res) => {
    try {
      const { name, phone, salon, address, lat, lng } = req.body;

      if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ message: "name invalid" });
      }

      if (!phone || !String(phone).trim()) {
        return res.status(400).json({ message: "phone required" });
      }

      if (!salon || !String(salon).trim()) {
        return res.status(400).json({ message: "salon required" });
      }

      if (!address || !String(address).trim()) {
        return res.status(400).json({ message: "address required" });
      }

      if (
        lat === null ||
        lat === undefined ||
        lng === null ||
        lng === undefined
      ) {
        return res.status(400).json({ message: "location required" });
      }

      const customer = await prisma.customer.create({
        data: {
          name: String(name).trim(),
          phone: String(phone).trim(),
          salon: String(salon).trim(),
          address: String(address).trim(),
          lat: Number(lat),
          lng: Number(lng),
          assignedExpeditorId:
            req.user.role === "EXPEDITOR" ? req.user.userId : null,
        },
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
      });

      return res.status(201).json({ customer });
    } catch (error) {
      console.error("Create customer error:", error);
      return res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

// DELETE /customers/reset-all-test-data
router.delete(
  "/reset-all-test-data",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const deletedPayments = await tx.payment.deleteMany({});
        const deletedReturnItems = await tx.returnItem.deleteMany({});
        const deletedReturns = await tx.return.deleteMany({});
        const deletedOrderItems = await tx.orderItem.deleteMany({});
        const deletedOrders = await tx.order.deleteMany({});
        const deletedCustomers = await tx.customer.deleteMany({});

        return {
          payments: deletedPayments.count,
          returnItems: deletedReturnItems.count,
          returns: deletedReturns.count,
          orderItems: deletedOrderItems.count,
          orders: deletedOrders.count,
          customers: deletedCustomers.count,
        };
      });

      return res.json({
        message: "All test customer-related data deleted",
        deleted: result,
      });
    } catch (error) {
      console.error("Reset customer-related data error:", error);
      return res.status(500).json({ message: error.message || "Server error" });
    }
  },
);

module.exports = router;
