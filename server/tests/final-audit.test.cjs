const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Final audit: authorization, ledger invariants, currency and validation", async (t) => {
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
      "202611130001_group7_extras",
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
    await require("./helpers/current-migrations.cjs")(db, "202611130001_group7_extras");
    wire = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
    await wire.start();
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:" +
      wire.getServerConn().split(":")[1] +
      "/postgres?connection_limit=1";
    process.env.JWT_SECRET = "group2-test-only-secret-with-at-least-32-bytes";
    process.env.APP_URL = 'https://audit-app.example.invalid';
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
          currencyConfigured: true,
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

    const png = async color => 'data:image/png;base64,' + (await require('sharp')({create:{width:40,height:15,channels:4,background:color}}).png().toBuffer()).toString('base64');
    await t.test('F06 configured application origin can use the API; unrelated origins are blocked',async()=>{
      const f=await fixture();const headers={Origin:process.env.APP_URL};
      const r=await api('/orders','POST',f.sale(),f.token,headers);assert.equal(r.status,201);assert.equal(r.headers.get('access-control-allow-origin'),process.env.APP_URL);
      assert.equal((await api('/orders','GET',null,f.token,{Origin:'https://unrelated.example.invalid'})).status,403);
    });
    await t.test('F02 all normal/legacy signature URLs enforce Basic and Business feature gates',async()=>{
      for (const plan of ['BASIC','BUSINESS']) {
        const f=await fixture(plan),sale=ok(await api('/orders','POST',f.sale(),f.token),201).order;
        for(const prefix of ['/orders/','/exp/orders/'])for(const kind of ['signature','seller-signature'])for(const tk of [f.token,f.repToken,f.warehouseToken])
          assert.equal((await api(prefix+sale.id+'/'+kind,'POST',{signature:'audit'},tk)).status,403);
        assert.equal((await raw.order.findUnique({where:{id:sale.id}})).sellerSignature,null);
      }
    });
    await t.test('F03 signatures validate bytes, enforce roles, audit first save and refuse replacement',async()=>{
      const f=await fixture('PREMIUM'),sale=ok(await api('/orders','POST',f.sale(),f.token),201).order,image=await png('black'),other=await png('red');
      for(const tk of [f.warehouseToken,f.repToken])assert.equal((await api('/exp/orders/'+sale.id+'/seller-signature','POST',{signature:image},tk)).status,403);
      for(const signature of ['forged','data:image/png;base64,aGVsbG8=','data:image/svg+xml;base64,PHN2Zy8+'])assert.equal((await api('/orders/'+sale.id+'/seller-signature','POST',{signature},f.token)).status,400);
      ok(await api('/orders/'+sale.id+'/seller-signature','POST',{signature:image},f.token));
      ok(await api('/exp/orders/'+sale.id+'/seller-signature','POST',{signature:image},f.token));
      assert.equal(await raw.orderEditLog.count({where:{orderId:sale.id}}),1);
      const edit=await api('/orders/'+sale.id,'PUT',f.sale(),f.token);assert.equal(edit.status,409);assert.equal(edit.body.code,'SIGNED_INVOICE');
      assert.equal((await api('/orders/'+sale.id+'/seller-signature','POST',{signature:other},f.token)).status,409);
      assert.equal((await api('/orders/'+sale.id+'/signature','POST',{signature:other},f.warehouseToken)).status,403);
      const second=await fixture('PREMIUM');assert.equal((await api('/orders/'+sale.id+'/seller-signature','POST',{signature:image},second.token)).status,404);
    });
    await t.test('F04 paid product quantities survive invoice reductions, removal and gift edits',async()=>{
      const f=await fixture(),body=f.sale();body.items[0].quantity=5;
      const sale=ok(await api('/orders','POST',body,f.token),201).order;
      const payment=ok(await api('/payments','POST',{customerId:f.customer.id,amount:10,soldItems:[{productId:f.product.id,quantity:5}]},f.token),201).payment;
      const p=await raw.product.create({data:{companyId:f.company.id,categoryId:f.category.id,name:'Other',salePrice:10}});
      await raw.stock.create({data:{companyId:f.company.id,productId:p.id,quantity:5}});
      for(const items of [[{...body.items[0],quantity:1}],[{...body.items[0],isGift:true,unitPrice:0}],[{productId:p.id,quantity:1,unitPrice:10}]]){
        const r=await api('/orders/'+sale.id,'PUT',{...body,items},f.token);assert.equal(r.status,409);assert.equal(r.body.code,'SOLD_ITEM_LIMIT');
      }
      assert.equal(await stock(f),5);assert.equal(await raw.orderEditLog.count({where:{orderId:sale.id}}),0);
      assert.equal((await raw.orderItem.findFirst({where:{orderId:sale.id}})).quantity,5);
      ok(await api('/payments/'+payment.id+'/void','POST',{reason:'Correct reservation'},f.token));
      ok(await api('/orders/'+sale.id,'PUT',{...body,items:[{...body.items[0],quantity:1}]},f.token));assert.equal(await stock(f),9);
    });
    await t.test('F04 reservations are validated across other invoices without over-blocking',async()=>{
      const f=await fixture(),body=f.sale();body.items[0].quantity=5;
      const sale=ok(await api('/orders','POST',body,f.token),201).order;
      ok(await api('/orders','POST',{...body,items:[{...body.items[0],quantity:4}]},f.token),201);
      ok(await api('/payments','POST',{customerId:f.customer.id,amount:10,soldItems:[{productId:f.product.id,quantity:5}]},f.token),201);
      ok(await api('/orders/'+sale.id,'PUT',{...body,items:[{...body.items[0],quantity:1}]},f.token));
      const product=ok(await api('/customers/'+f.customer.id+'/returnable-products','GET',null,f.token)).products[0];
      assert.equal(product.totalQty,5);assert.equal(product.soldQty,5);
    });
    await t.test('F05 assigned-customer and Basic shared history use consistent list/detail policies',async()=>{
      for(const plan of ['BASIC','BUSINESS']){
        const f=await fixture(plan),sale=ok(await api('/orders','POST',f.sale(),f.token),201).order;
        assert.equal(ok(await api('/orders','GET',null,f.repToken)).orders.some(o=>o.id===sale.id),true);
        ok(await api('/orders/'+sale.id,'GET',null,f.repToken));ok(await api('/exp/orders/'+sale.id,'GET',null,f.repToken));
        const returned=ok(await api('/returns','POST',{customerId:f.customer.id,items:[{productId:f.product.id,quantity:1}]},f.token),201).returnDoc;
        ok(await api('/returns/'+returned.id,'GET',null,f.repToken));
        if(plan==='BUSINESS'){
          await raw.customer.update({where:{id:f.customer.id},data:{assignedExpeditorId:null}});
          assert.equal(ok(await api('/orders','GET',null,f.repToken)).orders.length,0);
          assert.equal((await api('/orders/'+sale.id,'GET',null,f.repToken)).status,404);
          assert.equal((await api('/returns/'+returned.id,'GET',null,f.repToken)).status,404);
        }
      }
    });
    await t.test('F05 old creator access ends when the customer is reassigned; tenant boundaries remain',async()=>{
      const f=await fixture('BUSINESS'),sale=ok(await api('/orders','POST',f.sale(),f.repToken),201).order;
      await raw.customer.update({where:{id:f.customer.id},data:{assignedExpeditorId:null}});
      assert.equal((await api('/orders/'+sale.id,'GET',null,f.repToken)).status,404);
      assert.equal((await api('/exp/orders/'+sale.id,'GET',null,f.repToken)).status,404);
      const other=await fixture();assert.equal((await api('/orders/'+sale.id,'GET',null,other.token)).status,404);
    });
    await t.test('F07 empty workspace requires currency confirmation; declined sale is retryable after setup',async()=>{
      const f=await fixture();await raw.company.update({where:{id:f.company.id},data:{currencyConfigured:false}});
      const key=randomUUID();
      const declined=await api('/orders','POST',f.sale(),f.token,{'Idempotency-Key':key});assert.equal(declined.status,409);assert.equal(declined.body.code,'CURRENCY_NOT_CONFIGURED');
      assert.equal((await api('/purchases','POST',{ supplier: "Fixture Supplier", purchaseDate: "2026-11-01", items:[{productId:f.product.id,quantity:1,unitCost:2,salePrice:10}]},f.token)).status,409);
      assert.equal(await stock(f),10);assert.equal(await raw.order.count({where:{companyId:f.company.id}}),0);assert.equal(await raw.operationRequest.count({where:{companyId:f.company.id}}),0);
      ok(await api('/workspace/settings','PATCH',{currency:'USD'},f.token));
      const order=ok(await api('/orders','POST',f.sale(),f.token,{'Idempotency-Key':key}),201).order;assert.equal(order.currency,'USD');
      assert.equal((await api('/workspace/settings','PATCH',{currency:'EUR'},f.token)).status,409);
    });
    await t.test('F07 existing historical accounts remain usable without relabeling their currency',async()=>{
      const f=await fixture();ok(await api('/orders','POST',f.sale(),f.token),201);
      await raw.company.update({where:{id:f.company.id},data:{currencyConfigured:false}});
      ok(await api('/payments','POST',{customerId:f.customer.id,amount:1},f.token),201);
      assert.equal((await api('/workspace/settings','PATCH',{currency:'EUR'},f.token)).status,409);
    });
    await t.test('F08 invalid enum and repeated query filter values are client errors',async()=>{
      const f=await fixture();for(const query of ['NOT_A_PAYMENT','NA%C4%9ED&paymentType=NA%C4%9ED']){
        const r=await api('/orders?paymentType='+query,'GET',null,f.token);assert.equal(r.status,400);assert.equal(r.body.code,'INVALID_PAYMENT_TYPE');
      }
    });
    await t.test('F09 customer flag requires real booleans and bounded text',async()=>{
      const f=await fixture();for(const value of ['false',0,null,[],{}])assert.equal((await api('/customers/'+f.customer.id,'PUT',{isProblematic:value},f.token)).status,400);
      ok(await api('/customers/'+f.customer.id,'PUT',{isProblematic:true,problemNote:'Late payment'},f.token));
      assert.ok((await raw.customer.findUnique({where:{id:f.customer.id}})).problemMarkedAt);
      assert.equal((await api('/customers/'+f.customer.id,'PUT',{isProblematic:false,problemNote:'x'.repeat(1001)},f.token)).status,400);
      const cleared=ok(await api('/customers/'+f.customer.id,'PUT',{isProblematic:false,problemNote:null},f.token)).customer;
      assert.equal(cleared.isProblematic,false);assert.equal(cleared.problemMarkedAt,null);
    });
    await t.test('F10 missing and fake images reject atomically; real uploaded receipts and logos work',async()=>{
      const f=await fixture();ok(await api('/orders','POST',f.sale(),f.token),201);
      const absent='/uploads/'+f.company.id+'/absent.webp';
      assert.equal((await api('/payments','POST',{customerId:f.customer.id,amount:1,imageUrl:absent},f.token)).status,400);
      assert.equal((await api('/orders','POST',{...f.sale(),initialPayment:{amount:1,method:'CASH',imageUrl:absent}},f.token)).status,400);
      assert.equal((await api('/workspace/settings','PATCH',{logoUrl:absent},f.token)).status,400);
      assert.equal(await stock(f),9);assert.equal(await raw.payment.count({where:{companyId:f.company.id}}),0);
      await fs.mkdir(path.join(uploads,f.company.id),{recursive:true});await fs.writeFile(path.join(uploads,f.company.id,'fake.webp'),'not an image');
      assert.equal((await api('/payments','POST',{customerId:f.customer.id,amount:1,imageUrl:'/uploads/'+f.company.id+'/fake.webp'},f.token)).status,400);
      const form=new FormData();form.append('file',new Blob([Buffer.from((await png('black')).split(',')[1],'base64')],{type:'image/png'}),'receipt.png');
      const upload=await fetch(base+'/api/uploads',{method:'POST',headers:{Authorization:'Bearer '+f.token},body:form});assert.equal(upload.status,201);const url=(await upload.json()).file.url;
      const payment=ok(await api('/payments','POST',{customerId:f.customer.id,amount:1,imageUrl:url},f.token),201).payment;
      assert.equal((await fetch(payment.imageUrl)).status,200);ok(await api('/workspace/settings','PATCH',{logoUrl:url},f.token));
      const key=randomUUID(),body={customerId:f.customer.id,amount:1,imageUrl:url};ok(await api('/payments','POST',body,f.token,{'Idempotency-Key':key}),201);
      await fs.unlink(path.join(uploads,new URL(url).pathname.split('/').slice(-2).join('/')));
      assert.equal(ok(await api('/payments','POST',body,f.token,{'Idempotency-Key':key})).replayed,true);
    });
    await t.test('F11 email whitespace/case cannot reset renewal admin PIN attempts',async()=>{
      const f=await fixture(),bcrypt=require('bcrypt'),email='renew-'+randomUUID()+'@zindex.invalid';
      await raw.company.update({where:{id:f.company.id},data:{loginEmail:email,passwordHash:await bcrypt.hash('known-staff-password',4)}});
      await raw.user.update({where:{id:f.admin.id},data:{pinHash:await bcrypt.hash('8642',4)}});
      for(let i=0;i<5;i++)assert.equal((await api('/billing/renewal-login','POST',{email,password:'known-staff-password',pin:'0000'})).status,401);
      for(const variant of [email,' '+email,email+' ',email.toUpperCase(),'\t'+email+'\n'])assert.equal((await api('/billing/renewal-login','POST',{email:variant,password:'known-staff-password',pin:'0000'})).status,429);
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));if(raw)await raw.$disconnect();if(wire)await wire.stop();await db.close();await fs.rm(uploads,{recursive:true,force:true});
  }
});
