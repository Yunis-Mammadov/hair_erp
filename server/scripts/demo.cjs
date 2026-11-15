require("dotenv").config({ quiet: true });
const bcrypt = require("bcrypt"),
  { platformPrisma: db } = require("../src/prismaClient");
const Q = require("../src/quantity");
async function createDemo(client, input) {
  const email = String(input.email || "")
      .trim()
      .toLowerCase(),
    password = input.password,
    pin = input.pin;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72 ||
    typeof pin !== "string" ||
    !/^\d{4,8}$/.test(pin)
  )
    throw Error(
      "Set DEMO_EMAIL, DEMO_PASSWORD (12-72 bytes) and DEMO_PIN (4-8 digits).",
    );
  if (await client.company.findUnique({ where: { loginEmail: email } }))
    throw Error(
      "This email already exists. Demo creation never overwrites an existing workspace.",
    );
  const passwordHash = await bcrypt.hash(password, 12),
    pinHash = await bcrypt.hash(pin, 12);
  return client.$transaction(
    async (tx) => {
      const company = await tx.company.create({
          data: {
            name: "z-Index Demo",
            loginEmail: email,
            passwordHash,
            plan: "BASIC",
            market: "GLOBAL",
            currency: "USD",
            currencyConfigured: true,
            locale: "en",
            timezone: "UTC",
            isActive: true,
            isDemo: true,
            endsAt: new Date(Date.now() + 7 * 86400000),
          },
        }),
        companyId = company.id;
      const admin = await tx.user.create({
        data: { companyId, fullName: "Demo Admin", role: "ADMIN", pinHash },
      });
      const category = await tx.category.create({
        data: { companyId, name: "Demo products" },
      });
      const products = [];
      for (const p of [
        { name: "Coffee", unit: "KG", salePrice: 12.5 },
        { name: "Shampoo", unit: "PIECE", salePrice: 8 },
      ]) {
        const product = await tx.product.create({
          data: { ...p, companyId, categoryId: category.id },
        });
        products.push(product);
        await tx.stock.create({
          data: { companyId, productId: product.id, quantity: 100 },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: product.id,
            userId: admin.id,
            actorName: admin.fullName,
            kind: "OPENING",
            delta: 100,
            before: 0,
            after: 100,
            reason: "Demo opening stock",
          },
        });
      }
      let number = 0;
      for (const days of [5, 40, 75]) {
        const customer = await tx.customer.create({
            data: {
              companyId,
              name: `Demo customer ${++number}`,
              salon: "Demo store",
              address: "Sample address",
            },
          }),
          createdAt = new Date(Date.now() - days * 86400000),
          pricing = Q.priced(
            [
              {
                productId: products[0].id,
                quantity: 1.5,
                unitPrice: 12.5,
                isGift: false,
              },
            ],
            5,
            10,
          );
        const order = await tx.order.create({
          data: {
            companyId,
            customerId: customer.id,
            createdById: admin.id,
            orderNumber: number,
            invoiceNumber: "DEMO-" + String(number).padStart(5, "0"),
            currency: "USD",
            paymentType: "REALİZASİYA",
            createdAt,
            ...pricing.amounts,
            customerSnapshot: {
              id: customer.id,
              name: customer.name,
              address: customer.address,
            },
            companySnapshot: {
              name: company.name,
              currency: "USD",
              timezone: "UTC",
              issuedBy: admin.fullName,
            },
          },
        });
        await tx.orderItem.create({
          data: {
            companyId,
            orderId: order.id,
            ...pricing.items[0],
            unit: "KG",
            productName: products[0].name,
            categoryName: category.name,
          },
        });
        const stock = await tx.stock.update({
          where: { productId: products[0].id },
          data: { quantity: { decrement: 1.5 }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: products[0].id,
            userId: admin.id,
            actorName: admin.fullName,
            kind: "SALE",
            delta: -1.5,
            before: Q.add(stock.quantity, 1.5),
            after: stock.quantity,
            reason: "Demo sale",
            documentId: order.id,
            createdAt,
          },
        });
        if (number === 1)
          await tx.payment.create({
            data: {
              companyId,
              customerId: customer.id,
              orderId: order.id,
              createdById: admin.id,
              amount: 5,
              paymentType: "CASH",
              note: "Demo partial payment",
            },
          });
      }
      await tx.invoiceCounter.create({
        data: { companyId, value: number, currency: "USD" },
      });
      return {
        id: company.id,
        loginEmail: company.loginEmail,
        isDemo: true,
        expiresAt: company.endsAt,
      };
    },
    { isolationLevel: "Serializable", timeout: 20000 },
  );
}
if (require.main === module)
  createDemo(db, {
    email: process.env.DEMO_EMAIL,
    password: process.env.DEMO_PASSWORD,
    pin: process.env.DEMO_PIN,
  })
    .then((r) => console.table(r))
    .catch((e) => {
      console.error(
        e.code === "P2002"
          ? "Demo email already exists. Nothing was overwritten."
          : e.message,
      );
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
module.exports = { createDemo };
