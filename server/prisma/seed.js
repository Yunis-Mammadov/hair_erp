const bcrypt = require("bcrypt");
const { prisma } = require("../src/prismaClient");

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

async function clearDatabase() {
  await prisma.driverLiveSession.deleteMany();
  await prisma.orderEditLog.deleteMany();

  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();

  await prisma.paymentSoldItem.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();

  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  await prisma.customer.deleteMany();
  await prisma.area.deleteMany();

  await prisma.user.deleteMany();
}

async function createUsers() {
  const [adminPin, expeditorPin, warehousePin, driverPin] = await Promise.all([
    bcrypt.hash("1234", 10),
    bcrypt.hash("1111", 10),
    bcrypt.hash("2222", 10),
    bcrypt.hash("3333", 10),
  ]);

  const admin = await prisma.user.create({
    data: {
      fullName: "Admin",
      role: "ADMIN",
      pinHash: adminPin,
      isActive: true,
      email: "admin@minierp.local",
    },
  });

  const expeditor = await prisma.user.create({
    data: {
      fullName: "Rəşad Məmmədov",
      role: "EXPEDITOR",
      pinHash: expeditorPin,
      isActive: true,
      email: "expeditor@minierp.local",
    },
  });

  const warehouse = await prisma.user.create({
    data: {
      fullName: "Anbar Operatoru",
      role: "WAREHOUSE",
      pinHash: warehousePin,
      isActive: true,
      email: "warehouse@minierp.local",
    },
  });

  const driver = await prisma.user.create({
    data: {
      fullName: "Elvin Sürücü",
      role: "DRIVER",
      pinHash: driverPin,
      isActive: true,
      email: "driver@minierp.local",
    },
  });

  return { admin, expeditor, warehouse, driver };
}

async function createAreas() {
  const areasData = [
    { name: "Nərimanov", routeZone: "Bakı Mərkəz", routeDay: 1, sortOrder: 1 },
    { name: "Nəsimi", routeZone: "Bakı Mərkəz", routeDay: 1, sortOrder: 2 },
    { name: "Yasamal", routeZone: "Bakı Qərb", routeDay: 2, sortOrder: 3 },
    { name: "Xətai", routeZone: "Bakı Şərq", routeDay: 2, sortOrder: 4 },
    { name: "Binəqədi", routeZone: "Bakı Şimal", routeDay: 3, sortOrder: 5 },
    { name: "Sumqayıt", routeZone: "Region", routeDay: 4, sortOrder: 6 },
  ];

  const areas = {};

  for (const item of areasData) {
    areas[item.name] = await prisma.area.create({ data: item });
  }

  return areas;
}

async function createProductsAndStock() {
  const categoriesData = [
    {
      name: "Şampunlar",
      products: [
        { name: "Keratin Şampun 500ml", salePrice: 18, stock: 72 },
        { name: "Bərpaedici Şampun 1000ml", salePrice: 24, stock: 45 },
        { name: "Rəng qoruyucu Şampun 750ml", salePrice: 21, stock: 9 },
      ],
    },
    {
      name: "Saç Boyaları",
      products: [
        { name: "Professional Boya 7.1", salePrice: 12, stock: 120 },
        { name: "Professional Boya 8.0", salePrice: 12, stock: 88 },
        { name: "Oksidant 6% 1000ml", salePrice: 9, stock: 16 },
      ],
    },
    {
      name: "Baxım Məhsulları",
      products: [
        { name: "Keratin Maskası 500ml", salePrice: 32, stock: 28 },
        { name: "Argan Yağı 100ml", salePrice: 19, stock: 7 },
        { name: "Saç Serumu 150ml", salePrice: 22, stock: 34 },
      ],
    },
    {
      name: "Aksesuarlar",
      products: [
        { name: "Boyama Fırçası", salePrice: 3, stock: 150 },
        { name: "Salon Dəsmalı", salePrice: 6, stock: 60 },
        { name: "Folqa Rulonu", salePrice: 14, stock: 12 },
      ],
    },
  ];

  const categories = {};
  const products = {};

  for (const categoryData of categoriesData) {
    const category = await prisma.category.create({
      data: { name: categoryData.name },
    });

    categories[categoryData.name] = category;

    for (const productData of categoryData.products) {
      const product = await prisma.product.create({
        data: {
          name: productData.name,
          categoryId: category.id,
          salePrice: productData.salePrice,
          stock: {
            create: {
              quantity: productData.stock,
            },
          },
        },
      });

      products[product.name] = product;
    }
  }

  return { categories, products };
}

async function createCustomers(areas, users) {
  const customersData = [
    {
      name: "Aysel Beauty Studio",
      phone: "+994501112233",
      salon: "Aysel Beauty",
      address: "Nərimanov r., Təbriz küçəsi",
      area: "Nərimanov",
      lat: 40.4012,
      lng: 49.8617,
    },
    {
      name: "Lale Hair Salon",
      phone: "+994552223344",
      salon: "Lale Hair",
      address: "Nəsimi r., 28 May",
      area: "Nəsimi",
      lat: 40.3797,
      lng: 49.8468,
    },
    {
      name: "Nigar Studio",
      phone: "+994703334455",
      salon: "Nigar Studio",
      address: "Yasamal r., İnşaatçılar",
      area: "Yasamal",
      lat: 40.3914,
      lng: 49.8015,
    },
    {
      name: "Royal Beauty",
      phone: "+994774445566",
      salon: "Royal Beauty",
      address: "Xətai r., Ağ Şəhər",
      area: "Xətai",
      lat: 40.3833,
      lng: 49.8751,
    },
    {
      name: "Glamour Salon",
      phone: "+994505556677",
      salon: "Glamour",
      address: "Binəqədi r., Azadlıq pr.",
      area: "Binəqədi",
      lat: 40.4319,
      lng: 49.8241,
      isProblematic: true,
      problemNote: "Ödənişləri gecikdirir",
      problemMarkedAt: daysAgo(3),
    },
    {
      name: "Sumqayıt Beauty House",
      phone: "+994556667788",
      salon: "Beauty House",
      address: "Sumqayıt, 9-cu mikrorayon",
      area: "Sumqayıt",
      lat: 40.5897,
      lng: 49.6686,
    },
  ];

  const customers = {};

  for (const item of customersData) {
    const customer = await prisma.customer.create({
      data: {
        name: item.name,
        phone: item.phone,
        salon: item.salon,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        areaId: areas[item.area].id,
        assignedExpeditorId: users.expeditor.id,
        isProblematic: item.isProblematic || false,
        problemNote: item.problemNote || null,
        problemMarkedAt: item.problemMarkedAt || null,
      },
    });

    customers[item.name] = customer;
  }

  return customers;
}

async function createPurchases(users, products) {
  const purchase1 = await prisma.purchase.create({
    data: {
      createdById: users.warehouse.id,
      supplier: "Baku Cosmetics MMC",
      invoiceNo: "INV-2026-001",
      note: "İyul ayı əsas stok girişi",
      createdAt: daysAgo(12),
      items: {
        create: [
          {
            productId: products["Keratin Şampun 500ml"].id,
            quantity: 90,
            unitCost: 11,
          },
          {
            productId: products["Bərpaedici Şampun 1000ml"].id,
            quantity: 60,
            unitCost: 15,
          },
          {
            productId: products["Keratin Maskası 500ml"].id,
            quantity: 40,
            unitCost: 21,
          },
        ],
      },
    },
  });

  const purchase2 = await prisma.purchase.create({
    data: {
      createdById: users.warehouse.id,
      supplier: "SalonPro Təchizat",
      invoiceNo: "INV-2026-002",
      note: "Boya və aksesuar məhsulları",
      createdAt: daysAgo(8),
      items: {
        create: [
          {
            productId: products["Professional Boya 7.1"].id,
            quantity: 150,
            unitCost: 7,
          },
          {
            productId: products["Professional Boya 8.0"].id,
            quantity: 120,
            unitCost: 7,
          },
          {
            productId: products["Boyama Fırçası"].id,
            quantity: 180,
            unitCost: 1.5,
          },
          {
            productId: products["Folqa Rulonu"].id,
            quantity: 25,
            unitCost: 8,
          },
        ],
      },
    },
  });

  return { purchase1, purchase2 };
}

async function createOrders(users, customers, areas, products) {
  const order1 = await prisma.order.create({
    data: {
      customerId: customers["Aysel Beauty Studio"].id,
      createdById: users.expeditor.id,
      paymentType: "NAĞD",
      note: "Müştəri məhsulları salona çatdırılmadan öncə təsdiqlədi",
      areaId: areas["Nərimanov"].id,
      deliveryStatus: "DELIVERED",
      deliveredAt: daysAgo(1),
      createdAt: daysAgo(2),
      sellerSignature: "Rəşad Məmmədov",
      sellerSignedAt: daysAgo(2),
      customerSignature: "Aysel Beauty Studio",
      signedAt: daysAgo(1),
      items: {
        create: [
          {
            productId: products["Keratin Şampun 500ml"].id,
            quantity: 6,
            unitPrice: "18.00",
          },
          {
            productId: products["Keratin Maskası 500ml"].id,
            quantity: 3,
            unitPrice: "32.00",
          },
          {
            productId: products["Boyama Fırçası"].id,
            quantity: 10,
            unitPrice: "3.00",
            isGift: true,
          },
        ],
      },
    },
    include: { items: true },
  });

  const order2 = await prisma.order.create({
    data: {
      customerId: customers["Lale Hair Salon"].id,
      createdById: users.expeditor.id,
      paymentType: "REALİZASİYA",
      note: "Realizasiya ilə verildi, həftə sonu ödəniş gözlənilir",
      areaId: areas["Nəsimi"].id,
      deliveryStatus: "ON_BOARD",
      createdAt: daysAgo(1),
      items: {
        create: [
          {
            productId: products["Professional Boya 7.1"].id,
            quantity: 12,
            unitPrice: "12.00",
          },
          {
            productId: products["Oksidant 6% 1000ml"].id,
            quantity: 4,
            unitPrice: "9.00",
          },
        ],
      },
    },
    include: { items: true },
  });

  const order3 = await prisma.order.create({
    data: {
      customerId: customers["Glamour Salon"].id,
      createdById: users.expeditor.id,
      paymentType: "HİSSƏLİ",
      note: "Müştəri 50% indi, qalanı növbəti həftə ödəyəcək",
      areaId: areas["Binəqədi"].id,
      deliveryStatus: "IN_WAREHOUSE",
      createdAt: new Date(),
      items: {
        create: [
          {
            productId: products["Argan Yağı 100ml"].id,
            quantity: 5,
            unitPrice: "19.00",
          },
          {
            productId: products["Saç Serumu 150ml"].id,
            quantity: 4,
            unitPrice: "22.00",
          },
          {
            productId: products["Salon Dəsmalı"].id,
            quantity: 8,
            unitPrice: "6.00",
          },
        ],
      },
    },
    include: { items: true },
  });

  const order4 = await prisma.order.create({
    data: {
      customerId: customers["Royal Beauty"].id,
      createdById: users.expeditor.id,
      paymentType: "NAĞD",
      note: "Təcili çatdırılma",
      areaId: areas["Xətai"].id,
      deliveryStatus: "DELIVERED",
      deliveredAt: new Date(),
      createdAt: new Date(),
      items: {
        create: [
          {
            productId: products["Rəng qoruyucu Şampun 750ml"].id,
            quantity: 3,
            unitPrice: "21.00",
          },
          {
            productId: products["Folqa Rulonu"].id,
            quantity: 2,
            unitPrice: "14.00",
          },
        ],
      },
    },
    include: { items: true },
  });

  return { order1, order2, order3, order4 };
}

async function createPayments(users, customers, products) {
  await prisma.payment.create({
    data: {
      customerId: customers["Aysel Beauty Studio"].id,
      createdById: users.expeditor.id,
      amount: 204,
      paymentType: "NAĞD",
      paymentDate: daysAgo(1),
      note: "Nağd ödəniş tam alındı",
      createdAt: daysAgo(1),
      soldItems: {
        create: [
          {
            productId: products["Keratin Şampun 500ml"].id,
            quantity: 6,
            note: "Satış üzrə ödəniş",
          },
          {
            productId: products["Keratin Maskası 500ml"].id,
            quantity: 3,
            note: "Satış üzrə ödəniş",
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      customerId: customers["Glamour Salon"].id,
      createdById: users.expeditor.id,
      amount: 115,
      paymentType: "HİSSƏLİ",
      paymentDate: new Date(),
      note: "İlkin hissəvi ödəniş",
      createdAt: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      customerId: customers["Royal Beauty"].id,
      createdById: users.expeditor.id,
      amount: 91,
      paymentType: "NAĞD",
      paymentDate: new Date(),
      note: "Tam ödəniş",
      createdAt: new Date(),
    },
  });
}

async function createReturns(users, customers, products, orders) {
  const returnedOrderItem = orders.order2.items.find(
    (item) => item.productId === products["Oksidant 6% 1000ml"].id
  );

  await prisma.return.create({
    data: {
      customerId: customers["Lale Hair Salon"].id,
      createdById: users.expeditor.id,
      note: "1 ədəd oksidant qapaq zədəsi səbəbilə geri alındı",
      createdAt: new Date(),
      items: {
        create: [
          {
            orderItemId: returnedOrderItem?.id,
            productId: products["Oksidant 6% 1000ml"].id,
            quantity: 1,
            unitPrice: "9.00",
          },
        ],
      },
    },
  });

  if (returnedOrderItem) {
    await prisma.orderItem.update({
      where: { id: returnedOrderItem.id },
      data: {
        returnedQty: 1,
      },
    });
  }
}

async function createOrderLogs(users, orders) {
  await prisma.orderEditLog.create({
    data: {
      orderId: orders.order2.id,
      editedById: users.admin.id,
      reason: "Demo audit log: çatdırılma statusu dəyişdirildi",
      beforeSnapshot: {
        deliveryStatus: "IN_WAREHOUSE",
      },
      afterSnapshot: {
        deliveryStatus: "ON_BOARD",
      },
      createdAt: new Date(),
    },
  });
}

async function createDriverLocation(users) {
  await prisma.driverLiveSession.create({
    data: {
      driverId: users.driver.id,
      lat: 40.4093,
      lng: 49.8671,
      isActive: true,
      startedAt: new Date(),
    },
  });
}

async function main() {
  console.log("Seed başladı...");

  await clearDatabase();

  const users = await createUsers();
  const areas = await createAreas();
  const { products } = await createProductsAndStock();

  const customers = await createCustomers(areas, users);

  await createPurchases(users, products);

  const orders = await createOrders(users, customers, areas, products);

  await createPayments(users, customers, products);
  await createReturns(users, customers, products, orders);
  await createOrderLogs(users, orders);
  await createDriverLocation(users);

  console.log("Seed tamamlandı ✅");
  console.log("Login PIN-lər:");
  console.log("Admin: 1234");
  console.log("Ekspeditor: 1111");
  console.log("Anbar: 2222");
  console.log("Sürücü: 3333");
}

main()
  .catch((error) => {
    console.error("SEED_ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });