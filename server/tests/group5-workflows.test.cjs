const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Group 5: initial payments, invoice allocation, reversals and refunds", async (t) => {
  const uploads = await fs.mkdtemp(path.join(os.tmpdir(), "z-index-group2-"));
  process.env.UPLOADS_DIR = uploads;
  const db = new PGlite();
  await db.waitReady;
  let wire, raw, server;
  try {
    await db.exec(
      await fs.readFile(
        path.join(__dirname, "fixtures/legacy-schema.sql"),
        "utf8",
      ),
    );
    for (const migration of [
      "202611070001_company_basic_login",
      "202611100001_group1_financials",
      "202611100002_group3_records",
      "202611100003_group4_global_setup",
      "202611110001_group5_workflows",
      "202611120001_group6_operations",
    ])
      await db.exec(
        await fs.readFile(
          path.join(
            __dirname,
            "../prisma/migrations",
            migration,
            "migration.sql",
          ),
          "utf8",
        ),
      );
    wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
    await wire.start();
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:" +
      wire.getServerConn().split(":")[1] +
      "/postgres?connection_limit=1";
    process.env.JWT_SECRET = "group2-test-only-secret-with-at-least-32-bytes";
    ({ platformPrisma: raw } = require("../src/prismaClient"));
    const { app } = require("../src/index"),
      { signToken } = require("../src/auth-security");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    async function api(url, method = "GET", body, token, headers = {}) {
      const res = await fetch(base + "/api" + url, {
        method,
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          "Idempotency-Key": randomUUID(),
          ...headers,
        },
        ...(body
          ? { body: typeof body === "string" ? body : JSON.stringify(body) }
          : {}),
      });
      return {
        status: res.status,
        headers: res.headers,
        body: res.headers.get("content-type")?.includes("json")
          ? await res.json()
          : await res.text(),
      };
    }
    function token(company, user, expires = "1h") {
      return signToken(
        {
          companyId: company.id,
          userId: user.id,
          companyVersion: company.authVersion,
          userVersion: user.authVersion,
        },
        "session",
        expires,
      );
    }
    async function fixture(plan = "BASIC") {
      const company = await raw.company.create({
        data: {
          name: "Group3",
          loginEmail: randomUUID() + "@zindex.invalid",
          passwordHash: "fixture",
          plan,
          isActive: true,
          endsAt: new Date(Date.now() + 86400000),
        },
      });
      const admin = await raw.user.create({
        data: { companyId: company.id, fullName: "Admin", role: "ADMIN" },
      });
      const rep = await raw.user.create({
        data: { companyId: company.id, fullName: "Rep", role: "EXPEDITOR" },
      });
      const warehouse = await raw.user.create({
        data: {
          companyId: company.id,
          fullName: "Warehouse",
          role: "WAREHOUSE",
        },
      });
      const category = await raw.category.create({
        data: { companyId: company.id, name: "Products" },
      });
      const product = await raw.product.create({
        data: {
          companyId: company.id,
          name: "Product",
          categoryId: category.id,
          salePrice: 10,
        },
      });
      await raw.stock.create({
        data: { companyId: company.id, productId: product.id, quantity: 10 },
      });
      const customer = await raw.customer.create({
        data: {
          companyId: company.id,
          name: "Customer",
          assignedExpeditorId: rep.id,
        },
      });
      return {
        company,
        admin,
        rep,
        warehouse,
        product,
        category,
        customer,
        token: token(company, admin),
        repToken: token(company, rep),
        warehouseToken: token(company, warehouse),
        sale: (price = 10, gift = false) => ({
          customerId: customer.id,
          paymentType: "NAĞD",
          items: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: price,
              isGift: gift,
            },
          ],
        }),
      };
    }

    const stock = async (f) =>
      (await raw.stock.findUnique({ where: { productId: f.product.id } }))
        .quantity;
    function ok(response, status = 200) {
      assert.equal(response.status, status, JSON.stringify(response.body));
      return response.body;
    }
    async function account(f){return ok(await api('/customers/'+f.customer.id+'/profile','GET',null,f.token)).summary;}
    async function createCredit(f){
      ok(await api('/orders','POST',f.sale(),f.token),201);
      ok(await api('/payments','POST',{customerId:f.customer.id,amount:10,paymentType:'CASH'},f.token),201);
      ok(await api('/returns','POST',{customerId:f.customer.id,items:[{productId:f.product.id,quantity:1}]},f.token),201);
      assert.equal((await account(f)).credit,10);
    }
    await t.test('full initial payment, customer and stock commit once and replay together',async()=>{
      const f=await fixture(),key=randomUUID(),body={...f.sale(),initialPayment:{amount:10,method:'CASH'}};
      const result=ok(await api('/orders','POST',body,f.token,{'Idempotency-Key':key}),201);
      assert.equal(result.summary.debt,0);assert.equal(result.payment.orderId,result.order.id);assert.equal(await stock(f),9);
      const again=ok(await api('/orders','POST',body,f.token,{'Idempotency-Key':key}));assert.equal(again.replayed,true);assert.equal(again.payment.id,result.payment.id);assert.equal(await stock(f),9);
      assert.equal(await raw.payment.count({where:{companyId:f.company.id}}),1);
      assert.equal((await api('/orders','POST',{...body,initialPayment:{amount:4,method:'CASH'}},f.token,{'Idempotency-Key':key})).status,409);
    });
    await t.test('partial initial payment is allocated to its invoice rather than older debt',async()=>{
      const f=await fixture();const old=ok(await api('/orders','POST',f.sale(),f.token),201).order;
      const fresh=ok(await api('/orders','POST',{...f.sale(),initialPayment:{amount:4,method:'BANK'}},f.token),201).order;
      const oldView=ok(await api('/orders/'+old.id,'GET',null,f.token)).order,newView=ok(await api('/orders/'+fresh.id,'GET',null,f.token)).order;
      assert.equal(oldView.remainingDebt,10);assert.equal(oldView.allocatedPayment,0);assert.equal(newView.allocatedPayment,4);assert.equal(newView.remainingDebt,6);assert.equal((await account(f)).debt,16);
      const list=ok(await api('/customers/'+f.customer.id+'/orders','GET',null,f.token));assert.equal(list.orders.find(o=>o.id===fresh.id).remainingDebt,6);
    });
    await t.test('invalid initial payment rolls back new customer, order, payment and stock',async()=>{
      const f=await fixture();const body={...f.sale(),newCustomer:{name:'Should not exist'},initialPayment:{amount:11,method:'CASH'}};delete body.customerId;
      assert.equal((await api('/orders','POST',body,f.token)).status,409);assert.equal(await stock(f),10);assert.equal(await raw.order.count({where:{companyId:f.company.id}}),0);assert.equal(await raw.customer.count({where:{companyId:f.company.id,name:'Should not exist'}}),0);
      body.initialPayment.amount=5;const created=ok(await api('/orders','POST',body,f.token),201);assert.equal(created.summary.debt,5);assert.equal(created.order.customer.name,'Should not exist');
    });
    await t.test('existing credit is applied before an initial payment can be collected',async()=>{
      const f=await fixture();await createCredit(f);assert.equal((await api('/orders','POST',{...f.sale(),initialPayment:{amount:1,method:'CASH'}},f.token)).status,409);
      assert.equal(await stock(f),10);assert.equal((await account(f)).credit,10);
      const order=ok(await api('/orders','POST',f.sale(),f.token),201).order;assert.equal((await account(f)).debt,0);assert.equal((await account(f)).credit,0);assert.equal(ok(await api('/orders/'+order.id,'GET',null,f.token)).order.remainingDebt,0);
    });
    await t.test('explicit invoice payment validates ownership and invoice balance',async()=>{
      const f=await fixture(),other=await fixture();const sale=ok(await api('/orders','POST',f.sale(),f.token),201).order,foreign=ok(await api('/orders','POST',other.sale(),other.token),201).order;
      const body={customerId:f.customer.id,orderId:sale.id,amount:4};ok(await api('/payments','POST',body,f.token),201);
      assert.equal((await api('/payments','POST',{...body,amount:7},f.token)).status,409);
      assert.equal((await api('/payments','POST',{...body,orderId:foreign.id},f.token)).status,404);assert.equal((await account(f)).debt,6);
    });
    await t.test('admin void keeps original payment, restores balance and replays safely',async()=>{
      const f=await fixture();const sale=ok(await api('/orders','POST',{...f.sale(),initialPayment:{amount:10,method:'CASH'}},f.token),201);
      const url='/payments/'+sale.payment.id+'/void';assert.equal((await api(url,'POST',{reason:'Correction'},f.repToken)).status,403);assert.equal((await api(url,'POST',{reason:''},f.token)).status,400);
      const key=randomUUID(),headers={'Idempotency-Key':key};const result=ok(await api(url,'POST',{reason:'Duplicate cash entry'},f.token,headers));assert.equal(result.summary.debt,10);assert.equal(await stock(f),9);
      assert.equal(ok(await api(url,'POST',{reason:'Duplicate cash entry'},f.token,headers)).replayed,true);
      assert.equal((await api(url,'POST',{reason:'Another void'},f.token)).status,409);assert.equal(await raw.payment.count({where:{companyId:f.company.id}}),1);
      const stored=await raw.payment.findUnique({where:{id:sale.payment.id}});assert.ok(stored.voidedAt);assert.equal(stored.voidedById,f.admin.id);assert.equal(Number(stored.amount),10);
      assert.equal(ok(await api('/orders/'+sale.order.id,'GET',null,f.token)).order.remainingDebt,10);
      const list=ok(await api('/customers','GET',null,f.token));assert.equal(list.customers[0].summary.debt,10);
    });
    await t.test('voiding a payment releases paid-product reservations without changing stock',async()=>{
      const f=await fixture(),sale=f.sale();sale.items[0].quantity=2;ok(await api('/orders','POST',sale,f.token),201);
      const payment=ok(await api('/payments','POST',{customerId:f.customer.id,amount:10,soldItems:[{productId:f.product.id,quantity:1}]},f.token),201).payment;
      assert.equal(ok(await api('/customers/'+f.customer.id+'/returnable-products','GET',null,f.token)).products[0].returnableQty,1);
      ok(await api('/payments/'+payment.id+'/void','POST',{reason:'Wrong product collection'},f.token));
      assert.equal(ok(await api('/customers/'+f.customer.id+'/returnable-products','GET',null,f.token)).products[0].returnableQty,2);assert.equal(await stock(f),8);
    });
    await t.test('refunds are capped by credit, admin-only, immutable and replay safe',async()=>{
      const f=await fixture();await createCredit(f);const body={customerId:f.customer.id,amount:4,method:'BANK',note:'Returned customer credit'};
      assert.equal((await api('/payments/refunds','POST',body,f.repToken)).status,403);assert.equal((await api('/payments/refunds','POST',{...body,amount:11},f.token)).status,409);
      for(const bad of [{amount:-1},{amount:0.001},{note:''},{method:'INVALID'}])assert.equal((await api('/payments/refunds','POST',{...body,...bad},f.token)).status,400);
      const key=randomUUID(),headers={'Idempotency-Key':key},result=ok(await api('/payments/refunds','POST',body,f.token,headers),201);assert.equal(result.summary.credit,6);assert.equal(result.summary.refundTotal,4);assert.equal(result.summary.netPaidTotal,6);
      assert.equal(ok(await api('/payments/refunds','POST',body,f.token,headers)).replayed,true);assert.equal((await account(f)).credit,6);assert.equal(await raw.customerRefund.count({where:{companyId:f.company.id}}),1);
      const history=ok(await api('/customers/'+f.customer.id+'/refunds','GET',null,f.token));assert.equal(history.refunds[0].createdBy.fullName,'Admin');assert.equal(history.pagination.total,1);
      const order=ok(await api('/orders','POST',f.sale(),f.token),201).order;assert.equal((await account(f)).debt,4);assert.equal(ok(await api('/orders/'+order.id,'GET',null,f.token)).order.allocatedPayment,6);
    });
    await t.test('a refunded payment cannot be voided to create a fictitious debt',async()=>{
      const f=await fixture();await createCredit(f);const original=await raw.payment.findFirst({where:{companyId:f.company.id}});
      ok(await api('/payments/refunds','POST',{customerId:f.customer.id,amount:10,note:'Full refund',method:'CASH'},f.token),201);
      const result=await api('/payments/'+original.id+'/void','POST',{reason:'Attempted void'},f.token);assert.equal(result.status,409);assert.equal(result.body.code,'REFUNDED_PAYMENT');assert.equal((await account(f)).debt,0);assert.equal((await account(f)).credit,0);
    });
    await t.test('invoice debts still add up after an old payment is voided following a refund and a new initial payment',async()=>{
      const f=await fixture();await createCredit(f);
      const original=await raw.payment.findFirst({where:{companyId:f.company.id}});
      ok(await api('/payments/refunds','POST',{customerId:f.customer.id,amount:5,note:'Partial refund',method:'CASH'},f.token),201);
      ok(await api('/orders','POST',{...f.sale(),initialPayment:{amount:5,method:'CASH'}},f.token),201);
      ok(await api('/payments/'+original.id+'/void','POST',{reason:'Old payment corrected'},f.token));
      const balance=await account(f),history=ok(await api('/customers/'+f.customer.id+'/orders','GET',null,f.token));
      assert.equal(balance.debt,10);assert.equal(history.orders.reduce((n,o)=>n+o.remainingDebt,0),balance.debt);
      assert.equal(history.orders.reduce((n,o)=>n+o.allocatedPayment,0),balance.netPaidTotal);
    });
    await t.test('payment and return histories paginate, filter dates and export void audit fields',async()=>{
      const f=await fixture();const sale=ok(await api('/orders','POST',{...f.sale(),initialPayment:{amount:10,method:'CASH'}},f.token),201);
      ok(await api('/payments/'+sale.payment.id+'/void','POST',{reason:'Export correction'},f.token));
      const list=ok(await api('/payments?customerId='+f.customer.id+'&page=1&limit=1','GET',null,f.token));assert.equal(list.payments.length,1);assert.equal(list.pagination.total,1);assert.ok(list.payments[0].voidedAt);
      assert.equal((await api('/payments?startDate=2026-99-99','GET',null,f.token)).status,400);
      ok(await api('/returns','POST',{customerId:f.customer.id,items:[{productId:f.product.id,quantity:1}]},f.token),201);
      const returns=ok(await api('/returns?search=Customer&page=1&limit=1','GET',null,f.token));assert.equal(returns.returns.length,1);assert.equal(returns.pagination.total,1);
      const empty=ok(await api('/returns?search=NoSuchCustomer','GET',null,f.token));assert.equal(empty.pagination.total,0);
      assert.equal((await api('/returns?endDate=2026-99-99','GET',null,f.token)).status,400);
      const csv=await api('/records/exports/payments','GET',null,f.token);assert.equal(csv.status,200);assert.match(csv.body,/voidedAt/);assert.match(csv.body,/VOIDED/);assert.match(csv.body,/Export correction/);
    });
    await t.test('cross-tenant refund, void and financial history are refused',async()=>{
      const f=await fixture(),other=await fixture();await createCredit(other);const payment=await raw.payment.findFirst({where:{companyId:other.company.id}});
      assert.equal((await api('/payments/refunds','POST',{customerId:other.customer.id,amount:1,method:'CASH',note:'Foreign credit'},f.token)).status,404);
      assert.equal((await api('/payments/'+payment.id+'/void','POST',{reason:'Foreign payment'},f.token)).status,404);
      assert.equal((await api('/customers/'+other.customer.id+'/refunds','GET',null,f.token)).status,404);assert.equal((await account(other)).credit,10);
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));if(raw)await raw.$disconnect();if(wire)await wire.stop();await db.close();await fs.rm(uploads,{recursive:true,force:true});
  }
});
