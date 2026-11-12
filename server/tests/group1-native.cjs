const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);

test(
  "Group 1 native PostgreSQL migration and concurrency",
  { skip: !process.env.NATIVE_DATABASE_URL },
  async (t) => {
    const anchor = new URL(process.env.NATIVE_DATABASE_URL);
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(anchor.hostname),
      "Native test requires a local database server.",
    );
    assert.ok(
      anchor.pathname.endsWith("_test"),
      "Set NATIVE_DATABASE_URL to a dedicated *_test database.",
    );
    const suffix = randomUUID().replaceAll("-", "");
    const name = "zindex_" + suffix + "_test";
    const admin = new Client({ connectionString: anchor.toString() });
    await admin.connect();
    let client, server, raw;
    const uploadDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "z-index-native-images-"),
    );
    process.env.UPLOADS_DIR = uploadDirectory;
    try {
      await admin.query('CREATE DATABASE "' + name + '"');
      const url = new URL(anchor);
      url.pathname = "/" + name;
      client = new Client({ connectionString: url.toString() });
      await client.connect();
      const root = path.resolve(__dirname, "../prisma/migrations");
      const migrations = (await fs.readdir(root, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      for (const migration of migrations.filter(
        (m) =>
          ![
            "202611100001_group1_financials",
            "202611100002_group3_records",
            "202611100003_group4_global_setup",
            "202611110001_group5_workflows",
            "202611120001_group6_operations",
          ].includes(m),
      ))
        await client.query(
          await fs.readFile(
            path.join(root, migration, "migration.sql"),
            "utf8",
          ),
        );
      await client.query(`
      INSERT INTO "User" (id,"companyId","fullName","pinHash",role,"updatedAt") VALUES ('preserved-user','legacy-company','Migration Admin','preserved-pin-hash','ADMIN',NOW());
      INSERT INTO "Category" (id,"companyId",name,"updatedAt") VALUES ('preserved-category','legacy-company','Legacy',NOW());
      INSERT INTO "Product" (id,"companyId",name,"categoryId","salePrice","updatedAt") VALUES ('preserved-product','legacy-company','Original product','preserved-category',12.50,NOW());
      INSERT INTO "Stock" ("companyId","productId",quantity,"updatedAt") VALUES ('legacy-company','preserved-product',17,NOW());
      INSERT INTO "Customer" (id,"companyId",name,phone,"updatedAt") VALUES ('preserved-customer','legacy-company','Original customer','+14155552671',NOW());
      INSERT INTO "Order" (id,"companyId","orderNumber","customerId","createdById","paymentType","updatedAt") VALUES ('preserved-order','legacy-company',23,'preserved-customer','preserved-user','NAĞD',NOW());
      INSERT INTO "OrderItem" (id,"companyId","orderId","productId",quantity,"unitPrice","returnedQty") VALUES ('preserved-item','legacy-company','preserved-order','preserved-product',2,12.50,1);
      INSERT INTO "Payment" (id,"companyId","customerId",amount) VALUES ('preserved-payment','legacy-company','preserved-customer',5);
      INSERT INTO "Return" (id,"companyId","customerId","createdById") VALUES ('preserved-return','legacy-company','preserved-customer','preserved-user');
      INSERT INTO "ReturnItem" (id,"companyId","returnId","orderItemId","productId",quantity,"unitPrice") VALUES ('preserved-return-item','legacy-company','preserved-return','preserved-item','preserved-product',1,12.50);
    `);
      await client.query(
        await fs.readFile(
          path.join(root, "202611100001_group1_financials/migration.sql"),
          "utf8",
        ),
      );
      await client.query(
        await fs.readFile(
          path.join(root, "202611100002_group3_records/migration.sql"),
          "utf8",
        ),
      );
      await client.query(await fs.readFile(path.join(root, "202611100003_group4_global_setup/migration.sql"), "utf8"));
      await client.query(await fs.readFile(path.join(root,"202611110001_group5_workflows/migration.sql"),"utf8"));
      await client.query(await fs.readFile(path.join(root,"202611120001_group6_operations/migration.sql"),"utf8"));
      process.env.DATABASE_URL =
        url.toString() + (url.search ? "&" : "?") + "connection_limit=12";
      process.env.JWT_SECRET = "native-test-only-secret-with-at-least-32-bytes";
      ({ platformPrisma: raw } = require("../src/prismaClient"));
      const { app } = require("../src/index"),
        { signToken } = require("../src/auth-security");
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.on("listening", r));
      const base = "http://127.0.0.1:" + server.address().port;
      async function call(route, body, token, key = randomUUID()) {
        const res = await fetch(base + "/api" + route, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(body),
        });
        return { status: res.status, body: await res.json() };
      }
      async function fixture(stock = 5) {
        const company = await raw.company.create({
          data: {
            name: "Native company",
            loginEmail: randomUUID() + "@zindex.invalid",
            passwordHash: "not-used-in-signed-fixture",
            isActive: true,
            endsAt: new Date(Date.now() + 86400000),
            market: "GLOBAL",
            currency: "USD",
          },
        });

        const user = await raw.user.create({
          data: {
            companyId: company.id,
            fullName: "Native Admin",
            role: "ADMIN",
          },
        });
        const category = await raw.category.create({
          data: { companyId: company.id, name: "General" },
        });
        const product = await raw.product.create({
          data: {
            companyId: company.id,
            categoryId: category.id,
            name: "Native product",
            salePrice: 10,
          },
        });
        await raw.stock.create({
          data: {
            companyId: company.id,
            productId: product.id,
            quantity: stock,
          },
        });
        const customer = await raw.customer.create({
          data: { companyId: company.id, name: "Native customer" },
        });
        const token = signToken(
          {
            companyId: company.id,
            userId: user.id,
            companyVersion: 0,
            userVersion: 0,
          },
          "session",
          "1h",
        );
        return {
          company,
          user,
          product,
          customer,
          token,
          sale: (quantity = 1) => ({
            customerId: customer.id,
            paymentType: "NAĞD",
            items: [{ productId: product.id, quantity, unitPrice: 10 }],
          }),
        };
      }
      await t.test(
        "28 real migrations preserve legacy IDs, money, PIN and stock",
        async () => {
          assert.equal(migrations.length, 28);
          const order = await raw.order.findUnique({
            where: { id: "preserved-order" },
          });
          assert.equal(order.orderNumber, 23);
          assert.equal(order.invoiceNumber, "00023");
          assert.equal(Number(order.totalAmount), 25);
          assert.equal(order.customerSnapshot.name, "Original customer");
          const opening = await raw.stockMovement.findFirst({
            where: { productId: "preserved-product" },
          });
          assert.deepEqual(
            [opening.kind, opening.before, opening.after, opening.delta],
            ["OPENING", 0, 17, 17],
          );
          assert.equal(
            (
              await raw.invoiceCounter.findUnique({
                where: { companyId: "legacy-company" },
              })
            ).value,
            23,
          );

          assert.equal(
            (await raw.user.findUnique({ where: { id: "preserved-user" } }))
              .pinHash,
            "preserved-pin-hash",
          );
          assert.equal(
            (
              await raw.stock.findUnique({
                where: { productId: "preserved-product" },
              })
            ).quantity,
            17,
          );
          assert.equal(
            Number(
              (
                await raw.payment.findUnique({
                  where: { id: "preserved-payment" },
                })
              ).amount,
            ),
            5,
          );
        },
      );
      await t.test(
        "applied migrations match the checked-in Prisma schema",
        async () => {
          await execFile(
            process.execPath,
            [
              require.resolve("prisma/build/index.js"),
              "migrate",
              "diff",
              "--from-url",
              url.toString(),
              "--to-schema-datamodel",
              path.resolve(__dirname, "../prisma/schema.prisma"),
              "--exit-code",
            ],
            {
              cwd: path.resolve(__dirname, ".."),
              env: process.env,
              timeout: 30000,
            },
          ).catch(error=>{error.message+='\n'+(error.stdout||'');throw error;});
        },
      );
      await t.test(
        "10 parallel sales cannot oversell five available units",
        async () => {
          const f = await fixture(5);
          const responses = await Promise.all(
            Array.from({ length: 10 }, () =>
              call("/orders", f.sale(), f.token),
            ),
          );
          assert.equal(
            responses.filter((r) => r.status === 201).length,
            5,
            JSON.stringify(responses),
          );
          assert.ok(responses.every((r) => [201, 409].includes(r.status)));
          assert.equal(
            (await raw.stock.findUnique({ where: { productId: f.product.id } }))
              .quantity,
            0,
          );
          assert.equal(
            await raw.order.count({ where: { companyId: f.company.id } }),
            5,
          );
        },
      );
      await t.test(
        "parallel invoice numbers are unique and sequential within each company",
        async () => {
          const a = await fixture(20),
            b = await fixture(20);
          const results = await Promise.all([
            call("/orders", a.sale(), a.token),
            call("/orders", a.sale(), a.token),
            call("/orders", b.sale(), b.token),
            call("/orders", b.sale(), b.token),
          ]);
          assert.ok(
            results.every((r) => r.status === 201),
            JSON.stringify(results),
          );
          for (const f of [a, b]) {
            const orders = await raw.order.findMany({
              where: { companyId: f.company.id },
              orderBy: { orderNumber: "asc" },
            });
            assert.deepEqual(
              orders.map((o) => o.orderNumber),
              [1, 2],
            );
            assert.deepEqual(
              orders.map((o) => o.invoiceNumber),
              ["00001", "00002"],
            );
          }
        },
      );
      await t.test(
        "two parallel stock counts cannot both overwrite the same version",
        async () => {
          const f = await fixture(10);
          const count = async (quantity) => {
            const r = await fetch(base + "/api/stock/" + f.product.id, {
              method: "PATCH",
              headers: {
                Authorization: "Bearer " + f.token,
                "Content-Type": "application/json",
                "Idempotency-Key": randomUUID(),
              },
              body: JSON.stringify({
                quantity,
                expectedVersion: 0,
                reason: "Physical count",
              }),
            });
            return r.status;
          };
          const statuses = await Promise.all([count(12), count(15)]);
          assert.deepEqual(statuses.sort(), [200, 409]);
          assert.equal(
            await raw.stockMovement.count({
              where: { companyId: f.company.id, kind: "ADJUSTMENT" },
            }),
            1,
          );
        },
      );
      await t.test(
        "parallel payments cannot overpay a ten-dollar balance",
        async () => {
          const f = await fixture(2);
          assert.equal((await call("/orders", f.sale(), f.token)).status, 201);
          const responses = await Promise.all([
            call(
              "/payments",
              { customerId: f.customer.id, amount: 6 },
              f.token,
            ),
            call(
              "/payments",
              { customerId: f.customer.id, amount: 6 },
              f.token,
            ),
          ]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
          assert.equal(
            Number(
              (
                await raw.payment.aggregate({
                  where: { companyId: f.company.id },
                  _sum: { amount: true },
                })
              )._sum.amount,
            ),
            6,
          );
        },
      );
      await t.test(
        "parallel full returns can only restore goods once",
        async () => {
          const f = await fixture(2);
          await call("/orders", f.sale(2), f.token);
          const body = {
            customerId: f.customer.id,
            items: [{ productId: f.product.id, quantity: 2 }],
          };
          const responses = await Promise.all([
            call("/returns", body, f.token),
            call("/returns", body, f.token),
          ]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
          assert.equal(
            (await raw.stock.findUnique({ where: { productId: f.product.id } }))
              .quantity,
            2,
          );
          assert.equal(
            (
              await raw.orderItem.findFirst({
                where: { companyId: f.company.id },
              })
            ).returnedQty,
            2,
          );
        },
      );
      await t.test(
        "simultaneous identical request keys produce one sale",
        async () => {
          const f = await fixture(2),
            key = randomUUID();
          const responses = await Promise.all([
            call("/orders", f.sale(), f.token, key),
            call("/orders", f.sale(), f.token, key),
          ]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
          assert.equal(
            await raw.order.count({ where: { companyId: f.company.id } }),
            1,
          );
          assert.equal(
            (await raw.stock.findUnique({ where: { productId: f.product.id } }))
              .quantity,
            1,
          );
        },
      );
      await t.test("parallel refunds cannot spend the same customer credit twice",async()=>{
        const f=await fixture(2);
        const sale=await call('/orders',{...f.sale(),initialPayment:{amount:10,method:'CASH'}},f.token);assert.equal(sale.status,201);
        assert.equal((await call('/returns',{customerId:f.customer.id,items:[{productId:f.product.id,quantity:1}]},f.token)).status,201);
        const body={customerId:f.customer.id,amount:6,method:'CASH',note:'Credit refund'};
        const responses=await Promise.all([call('/payments/refunds',body,f.token),call('/payments/refunds',body,f.token)]);
        assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
        assert.equal(Number((await raw.customerRefund.aggregate({where:{companyId:f.company.id},_sum:{amount:true}}))._sum.amount),6);
      });
      await t.test("parallel voids preserve one reversal and one original payment",async()=>{
        const f=await fixture(2);const result=await call('/orders',{...f.sale(),initialPayment:{amount:10,method:'CASH'}},f.token);assert.equal(result.status,201);
        const payment=await raw.payment.findFirst({where:{companyId:f.company.id}});
        const responses=await Promise.all([call('/payments/'+payment.id+'/void',{reason:'Cash correction'},f.token),call('/payments/'+payment.id+'/void',{reason:'Cash correction'},f.token)]);
        assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(await raw.payment.count({where:{companyId:f.company.id}}),1);
        assert.ok((await raw.payment.findUnique({where:{id:payment.id}})).voidedAt);
      });
      await t.test('large customer and sales lists stay paginated with 1000 customers and 3000 invoices',async()=>{
        const f=await fixture(20),prefix=randomUUID().replaceAll('-','');
        const customers=Array.from({length:1000},(_,i)=>({id:prefix+'c'+i,companyId:f.company.id,name:'Load customer '+i}));
        await raw.customer.createMany({data:customers});
        const orders=Array.from({length:3000},(_,i)=>({id:prefix+'o'+i,companyId:f.company.id,customerId:customers[i%1000].id,createdById:f.user.id,orderNumber:100000+i,paymentType:'NAĞD',totalAmount:10}));
        await raw.order.createMany({data:orders});
        await raw.orderItem.createMany({data:orders.map(o=>({companyId:f.company.id,orderId:o.id,productId:f.product.id,quantity:1,unitPrice:10}))});
        const started=performance.now();
        const customersResponse=await fetch(base+'/api/customers?page=1&limit=25',{headers:{Authorization:'Bearer '+f.token}}),customerPage=await customersResponse.json();
        assert.equal(customersResponse.status,200);assert.equal(customerPage.customers.length,25);assert.equal(customerPage.pagination.total,1001);
        const orderResponse=await fetch(base+'/api/orders?page=1&limit=25',{headers:{Authorization:'Bearer '+f.token}}),orderPage=await orderResponse.json();
        assert.equal(orderResponse.status,200);assert.equal(orderPage.orders.length,25);assert.equal(orderPage.pagination.total,3000);assert.ok(JSON.stringify(orderPage).length<150000);
        t.diagnostic('1000 customers / 3000 invoices / 3000 lines: two paginated reads '+Math.round(performance.now()-started)+' ms on this runner; not a production latency guarantee.');
      });
      await t.test("currency setup racing with the first sale never relabels money", async () => {
        for (let i=0;i<3;i++) {
          const f=await fixture();
          async function request(method,url,body) {
            const response=await fetch(base+"/api"+url,{method,headers:{Authorization:"Bearer "+f.token,"Content-Type":"application/json","Idempotency-Key":randomUUID(),"X-Workspace-Currency":"USD"},body:JSON.stringify(body)});
            return {status:response.status,body:await response.json()};
          }
          const [settings,sale]=await Promise.all([request("PATCH","/workspace/settings",{currency:"EUR"}),request("POST","/orders",f.sale())]);
          assert.ok((settings.status===200 && sale.status===409)||(settings.status===409 && sale.status===201),JSON.stringify({settings,sale}));
          const current=await raw.company.findUnique({where:{id:f.company.id}});
          const orders=await raw.order.findMany({where:{companyId:f.company.id}});
          for(const order of orders){assert.equal(order.currency,current.currency);assert.equal(Number(order.totalAmount),10);}
        }
      });
    } finally {
      if (server) await new Promise((r) => server.close(r));
      if (raw) await raw.$disconnect();
      if (client) await client.end();
      await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
      await admin.end();
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  },
);
