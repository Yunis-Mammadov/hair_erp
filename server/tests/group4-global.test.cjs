const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Group 4: languages, currency, international customers and local dates", async (t) => {
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
    await t.test('only admins change settings; tenants cannot change each other',async()=>{
      const f=await fixture(),other=await fixture();assert.equal(ok(await api('/workspace/settings','GET',null,f.repToken)).company.id,f.company.id);
      for(const tk of [f.repToken,f.warehouseToken])assert.equal((await api('/workspace/settings','PATCH',{name:'Changed'},tk)).status,403);
      for(const body of [{companyId:other.company.id},{plan:'PREMIUM'},{authVersion:0}])assert.equal((await api('/workspace/settings','PATCH',body,f.token)).status,400);
    });
    await t.test('currency, profile, prefix and invoice snapshots preserve amounts',async()=>{
      const f=await fixture();ok(await api('/workspace/settings','PATCH',{name:'Example GmbH',currency:'EUR',timezone:'Europe/Berlin',phone:'+49 (30) 12345678',address:'Main Street 1',taxId:'DE123',invoicePrefix:'DE-'},f.token));
      assert.equal(Number((await raw.product.findUnique({where:{id:f.product.id}})).salePrice),10);
      const order=ok(await api('/orders','POST',f.sale(),f.token,{'X-Workspace-Currency':'EUR'}),201).order;
      assert.equal(order.currency,'EUR');assert.equal(order.invoiceNumber,'DE-00001');assert.equal(Number(order.totalAmount),10);assert.equal(order.companySnapshot.taxId,'DE123');assert.equal(order.companySnapshot.phone,'+493012345678');
      const locked=await api('/workspace/settings','PATCH',{currency:'USD'},f.token);assert.equal(locked.status,409);assert.equal(locked.body.code,'CURRENCY_LOCKED');
      ok(await api('/workspace/settings','PATCH',{name:'New name',timezone:'UTC'},f.token));const saved=ok(await api('/orders/'+order.id,'GET',null,f.token)).order;assert.equal(saved.companySnapshot.name,'Example GmbH');assert.equal(saved.companySnapshot.timezone,'Europe/Berlin');assert.equal(saved.currency,'EUR');
    });
    await t.test('upload logo and save the complete settings form on a company with existing sales', async () => {
      const f = await fixture();
      ok(await api('/orders', 'POST', f.sale(), f.token), 201);
      const before = ok(await api('/workspace/settings', 'GET', null, f.token));
      assert.equal(before.currencyLocked, true);
      const image = await require('sharp')({create:{width:12,height:8,channels:3,background:'red'}}).png().toBuffer();
      const form = new FormData();
      form.append('file', new Blob([image], {type:'image/png'}), 'logo.png');
      const uploaded = await fetch(base+'/api/uploads', {method:'POST',headers:{Authorization:'Bearer '+f.token},body:form});
      assert.equal(uploaded.status, 201);
      const file = (await uploaded.json()).file;
      const values = {...before.company, logoUrl:file.url, timezone:'Asia/Baku'};
      const payload = Object.fromEntries(['name','address','phone','supportEmail','taxId','invoicePrefix','timezone','logoUrl'].map(k=>[k, values[k]??null]));
      const saved = ok(await api('/workspace/settings', 'PATCH', payload, f.token));
      assert.equal(saved.company.timezone, 'Asia/Baku');
      assert.equal(saved.company.currency, before.company.currency);
      assert.equal(saved.company.invoicePrefix, '');
      assert.equal((await fetch(saved.company.logoUrl)).status, 200);
      const stored = await raw.company.findUnique({where:{id:f.company.id}});
      assert.equal(stored.logoUrl, '/uploads/'+f.company.id+'/'+file.filename);
      assert.equal(stored.supportEmail, null);
      ok(await api('/workspace/settings', 'PATCH', {...payload,logoUrl:null}, f.token));
    });
    await t.test('stale browser currency cannot create a mislabeled sale',async()=>{
      const f=await fixture();ok(await api('/workspace/settings','PATCH',{currency:'USD'},f.token));
      const stale=await api('/orders','POST',f.sale(),f.token,{'X-Workspace-Currency':'AZN'});assert.equal(stale.status,409);assert.equal(stale.body.code,'WORKSPACE_CHANGED');assert.equal(await stock(f),10);
      ok(await api('/orders','POST',f.sale(),f.token,{'X-Workspace-Currency':'USD'}),201);
    });
    await t.test('purchases lock currency before the first sale',async()=>{
      const f=await fixture();ok(await api('/purchases','POST',{items:[{productId:f.product.id,quantity:1,unitCost:2,salePrice:10}]},f.token),201);assert.equal(ok(await api('/workspace/settings','GET',null,f.token)).currencyLocked,true);assert.equal((await api('/workspace/settings','PATCH',{currency:'GBP'},f.token)).status,409);
    });
    await t.test('invalid settings reject atomically',async()=>{
      const f=await fixture();for(const body of [{currency:'FAKE'},{timezone:'Mars/Crater'},{supportEmail:'bad'},{invoicePrefix:'bad / path'},{name:'x'},{logoUrl:'data:image/png;base64,iVBORw0KGgo='}])assert.equal((await api('/workspace/settings','PATCH',body,f.token)).status,400);
      assert.equal((await raw.company.findUnique({where:{id:f.company.id}})).name,'Group3');
    });
    await t.test('name-only standalone customer and atomic new-customer sale work',async()=>{
      const f=await fixture();const c=ok(await api('/customers','POST',{name:'Simple buyer'},f.token),201).customer;assert.equal(c.phone,null);assert.equal(c.salon,null);assert.equal(c.lat,null);
      const payload={...f.sale(),newCustomer:{name:'New buyer'}};delete payload.customerId;const r=ok(await api('/orders','POST',payload,f.token),201);assert.equal(r.order.customer.name,'New buyer');assert.equal(r.order.customer.address,null);assert.equal(await stock(f),9);
    });
    await t.test('international and national phone numbers normalize without +994',async()=>{
      const f=await fixture();for(const [phone,expected]of [['+1 (415) 555-2671','+14155552671'],['0090 532 123 45 67','+905321234567'],['+7 916 123-45-67','+79161234567'],['020 7946 0958','02079460958']])assert.equal(ok(await api('/customers','POST',{name:'Phone test',phone},f.token),201).customer.phone,expected);
      for(const phone of ['abc','+1','++14155552671','1234567890123456'])assert.equal((await api('/customers','POST',{name:'Bad phone',phone},f.token)).status,400);
    });
    await t.test('optional coordinates accept zero and reject invalid pairs',async()=>{
      const f=await fixture();const c=ok(await api('/customers','POST',{name:'Zero point',lat:0,lng:0},f.token),201).customer;assert.equal(c.lat,0);assert.equal(c.lng,0);
      for(const body of [{lat:1},{lat:91,lng:0},{lat:0,lng:181},{areaId:'foreign-area'}])assert.equal((await api('/customers','POST',{name:'Bad point',...body},f.token)).status,400);
      const edited=ok(await api('/customers/'+c.id,'PUT',{phone:'+44 20 7946 0958',areaId:null,lat:null,lng:null},f.token)).customer;assert.equal(edited.phone,'+442079460958');assert.equal(edited.lat,null);
    });
    await t.test('API defaults to EN, supports AZ TR RU and preserves business names',async()=>{
      for(const [lang,message]of Object.entries({en:'Please sign in.',az:'Daxil olmaq lazımdır.',tr:'Giriş yapman gerekiyor.',ru:'Войдите в систему.'})){const r=await api('/workspace/settings','GET',null,null,lang==='en'?{}:{'Accept-Language':lang});assert.equal(r.status,401);assert.equal(r.body.message,message);assert.equal(r.headers.get('content-language'),lang);}
      const f=await fixture();const c=ok(await api('/customers','POST',{name:'Müştəri',salon:'Satış'},f.token,{'Accept-Language':'ru'}),201).customer;assert.equal(c.name,'Müştəri');assert.equal(c.salon,'Satış');
      assert.match((await api('/customers','POST',{name:'a'},f.token,{'Accept-Language':'ru'})).body.message,/Имя клиента/);
    });
    await t.test('local-day filters handle DST and validate calendar dates',()=>{
      const W=require('../src/workspace-core');assert.equal(W.zonedDay('2026-11-10','Asia/Baku').toISOString(),'2026-11-09T20:00:00.000Z');
      for(const [day,hours]of [['2026-03-08',23],['2026-11-01',25]])assert.equal((W.zonedDay(day,'America/New_York',true)-W.zonedDay(day,'America/New_York'))/3600000,hours);
      for(const [start,end]of [['2026-02-30',''],['2026-11-11','2026-11-10'],['bad','']])assert.throws(()=>W.dateRange(start,end,'UTC'));
    });
    await t.test('sales API filters actual company-local dates',async()=>{
      const f=await fixture();ok(await api('/workspace/settings','PATCH',{timezone:'Asia/Baku'},f.token));const order=ok(await api('/orders','POST',f.sale(),f.token),201).order;await raw.order.update({where:{id:order.id},data:{createdAt:new Date('2026-11-09T22:00:00Z')}});
      assert.equal(ok(await api('/orders?startDate=2026-11-10&endDate=2026-11-10','GET',null,f.token)).orders.length,1);assert.equal(ok(await api('/orders?startDate=2026-11-09&endDate=2026-11-09','GET',null,f.token)).orders.length,0);assert.equal((await api('/orders?startDate=2026-02-30','GET',null,f.token)).status,400);
    });
    await t.test('onboarding and USD Starter billing are independent of TRY transactions',async()=>{
      const f=await fixture();await raw.company.update({where:{id:f.company.id},data:{market:'GLOBAL',billingCycle:'YEARLY'}});assert.equal(ok(await api('/workspace/onboarding','GET',null,f.token)).currencyConfigured,false);
      const company=ok(await api('/workspace/settings','PATCH',{currency:'TRY'},f.token)).company;assert.deepEqual(company.subscriptionPrice,{currency:'USD',amountMinor:14999});assert.equal(company.currency,'TRY');
      ok(await api('/orders','POST',f.sale(),f.token),201);const d=ok(await api('/workspace/onboarding','GET',null,f.token));assert.equal(d.sales,1);assert.equal(d.currencyConfigured,true);
    });
    await t.test('CSV accepts international exported phones and rejects foreign currency',async()=>{
      const f=await fixture();ok(await api('/records/imports/customers','POST',{rows:[{name:'UK buyer',phone:"'+442079460958"}]},f.token),201);assert.equal((await raw.customer.findFirst({where:{companyId:f.company.id,name:'UK buyer'}})).phone,'+442079460958');
      const bad=await api('/records/imports/products','POST',{rows:[{name:'USD item',category:'Demo',salePrice:'12.50',currency:'USD'}]},f.token);assert.equal(bad.status,409);assert.equal(bad.body.code,'CURRENCY_MISMATCH');assert.equal(await raw.product.count({where:{companyId:f.company.id,name:'USD item'}}),0);
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));if(raw)await raw.$disconnect();if(wire)await wire.stop();await db.close();await fs.rm(uploads,{recursive:true,force:true});
  }
});
