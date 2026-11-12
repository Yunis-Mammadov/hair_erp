const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

test("Group 6: operations, team and subscription provisioning", async (t) => {
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
    const {createHmac}=require('node:crypto'),{processEvents,verifySignature}=require('../src/ops/billing');
    process.env.PADDLE_WEBHOOK_SECRET='test-notification-secret';process.env.PADDLE_MONTHLY_PRICE_ID='pri_month';process.env.PADDLE_YEARLY_PRICE_ID='pri_year';
    function signed(event,ts=String(Math.floor(Date.now()/1000))){const body=JSON.stringify(event),signature='ts='+ts+';h1='+createHmac('sha256',process.env.PADDLE_WEBHOOK_SECRET).update(ts+':'+body).digest('hex');return {body,signature};}
    async function notify(event,signature){const data=signed(event);const r=await fetch(base+'/webhooks/paddle',{method:'POST',headers:{'Content-Type':'application/json','Paddle-Signature':signature||data.signature},body:data.body});return {status:r.status,body:await r.json()};}
    async function billingFixture(){const f=await fixture();f.company=await raw.company.update({where:{id:f.company.id},data:{market:'GLOBAL',endsAt:new Date(Date.now()-10000)}});return f;}
    async function eventFor(f,overrides={}){const ref=await raw.billingCheckout.create({data:{companyId:f.company.id,activeKey:f.company.id,cycle:'MONTHLY',email:'buyer@example.com',transactionId:'txn_'+randomUUID().replaceAll('-','')}});return {event_id:'evt_'+randomUUID().replaceAll('-',''),event_type:'subscription.activated',occurred_at:new Date().toISOString(),data:{id:'sub_'+randomUUID().replaceAll('-',''),customer_id:'ctm_'+randomUUID(),transaction_id:ref.transactionId,custom_data:{checkout_ref:ref.id},items:[{quantity:1,price:{id:'pri_month'}}],status:'active',current_billing_period:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+30*86400000).toISOString()}},...overrides};}
    await t.test('readiness checks database schema, migrations and persistent image storage',async()=>{
      await db.exec('CREATE TABLE "_prisma_migrations" (finished_at TIMESTAMPTZ, rolled_back_at TIMESTAMPTZ)');
      let r=await fetch(base+'/ready');assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
      await db.exec('INSERT INTO "_prisma_migrations" VALUES (NULL,NULL)');r=await fetch(base+'/ready');assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});await db.exec('DELETE FROM "_prisma_migrations"');
    });
    await t.test('team management is admin-only, scoped and exposes limits without PIN hashes',async()=>{
      const f=await fixture(),other=await fixture();const result=ok(await api('/users/manage','GET',null,f.token));assert.equal(result.activeCount,3);assert.equal(result.maxUsers,3);assert.equal(result.users.some(u=>u.id===other.admin.id),false);assert.equal(JSON.stringify(result).includes('pinHash'),false);assert.equal((await api('/users/manage','GET',null,f.repToken)).status,403);
      assert.equal((await api('/users','POST',{fullName:'Fourth',role:'EXPEDITOR',pin:'7890'},f.token)).status,409);
      ok(await api('/users/'+f.rep.id,'PATCH',{isActive:false},f.token));assert.equal((await api('/stock','GET',null,f.repToken)).status,401);
      ok(await api('/users','POST',{fullName:'New member',role:'EXPEDITOR',pin:'7890'},f.token),201);
      assert.equal((await api('/users/'+other.admin.id,'PATCH',{pin:'1234'},f.token)).status,404);
    });
    await t.test('expired-company admin renewal login cannot access business APIs',async()=>{
      const f=await billingFixture(),bcrypt=require('bcrypt');await raw.company.update({where:{id:f.company.id},data:{passwordHash:await bcrypt.hash('renewal-pass',4)}});await raw.user.update({where:{id:f.admin.id},data:{pinHash:await bcrypt.hash('4826',4)}});
      const result=ok(await api('/billing/renewal-login','POST',{email:f.company.loginEmail,password:'renewal-pass',pin:'4826'},null));
      const status=ok(await api('/billing','GET',null,result.token));assert.equal(status.active,false);assert.equal(status.company.id,f.company.id);
      assert.equal((await api('/customers','GET',null,result.token)).status,401);
      assert.equal((await api('/billing/renewal-login','POST',{email:f.company.loginEmail,password:'bad',pin:'4826'},null)).status,401);
    });
    await t.test('signed webhooks are queued once and provision only a server-linked paid subscription',async()=>{
      process.env.BILLING_PROVIDER='paddle';const f=await billingFixture(),event=await eventFor(f);
      assert.equal((await notify(event,'ts=1;h1='+'0'.repeat(64))).status,400);assert.equal(await raw.billingEvent.count(),0);
      assert.equal((await notify(event)).status,200);assert.equal((await notify(event)).status,200);assert.equal(await raw.billingEvent.count(),1);
      assert.equal((await raw.company.findUnique({where:{id:f.company.id}})).endsAt<f.company.startsAt,true);
      await processEvents(raw);const company=await raw.company.findUnique({where:{id:f.company.id}});assert.equal(company.endsAt.toISOString(),event.data.current_billing_period.ends_at);assert.equal((await raw.billingEvent.findUnique({where:{id:event.event_id}})).state,'processed');assert.equal((await raw.billingCheckout.findUnique({where:{activeKey:f.company.id}})),null);
      const unknown={...event,event_id:'evt_'+randomUUID().replaceAll('-',''),data:{...event.data,id:'sub_unknown',custom_data:{company_id:f.company.id}}};await notify(unknown);await processEvents(raw);assert.equal((await raw.billingEvent.findUnique({where:{id:unknown.event_id}})).state,'ignored');
    });
    await t.test('failed renewal does not extend access; older events cannot reactivate canceled subscription',async()=>{
      const f=await billingFixture(),event=await eventFor(f);await notify(event);await processEvents(raw);const end=event.data.current_billing_period.ends_at;
      const late={...event,event_id:'evt_late'+randomUUID().replaceAll('-',''),event_type:'subscription.past_due',occurred_at:new Date(Date.now()+1000).toISOString(),data:{...event.data,status:'past_due',current_billing_period:{...event.data.current_billing_period,ends_at:new Date(Date.now()+60*86400000).toISOString()}}};await notify(late);await processEvents(raw);assert.equal((await raw.company.findUnique({where:{id:f.company.id}})).endsAt.toISOString(),end);
      const cancel={...event,event_id:'evt_cancel'+randomUUID().replaceAll('-',''),event_type:'subscription.canceled',occurred_at:new Date(Date.now()+2000).toISOString(),data:{...event.data,status:'canceled',current_billing_period:null}};await notify(cancel);await processEvents(raw);const after=await raw.company.findUnique({where:{id:f.company.id}});assert.ok(after.endsAt<new Date(Date.now()+3000));
      await notify({...event,event_id:'evt_old'+randomUUID().replaceAll('-','')});await processEvents(raw);assert.equal((await raw.company.findUnique({where:{id:f.company.id}})).endsAt.toISOString(),after.endsAt.toISOString());
    });
    await t.test('wrong prices and forged company references never grant access',async()=>{
      const f=await billingFixture(),event=await eventFor(f);event.data.items[0].price.id='pri_unknown';await notify(event);await processEvents(raw);assert.ok((await raw.company.findUnique({where:{id:f.company.id}})).endsAt<new Date());assert.equal((await raw.billingEvent.findUnique({where:{id:event.event_id}})).attempts,1);
    });
    await t.test('lost provider response can be linked only to the matching provider reference and replayed safely',async()=>{
      const f=await billingFixture(),event=await eventFor(f),ref=event.data.custom_data.checkout_ref;
      await raw.billingCheckout.update({where:{id:ref},data:{transactionId:null}});await notify(event);await processEvents(raw);assert.equal((await raw.billingEvent.findUnique({where:{id:event.event_id}})).state,'ignored');
      const {linkCheckout}=require('../src/ops/billing');await assert.rejects(linkCheckout(raw,async()=>({custom_data:{checkout_ref:'another'}}),ref,event.data.transaction_id),/does not match/);
      await linkCheckout(raw,async()=>({custom_data:{checkout_ref:ref}}),ref,event.data.transaction_id);await processEvents(raw);assert.equal((await raw.billingEvent.findUnique({where:{id:event.event_id}})).state,'processed');assert.equal((await raw.billingAccount.findUnique({where:{companyId:f.company.id}})).subscriptionId,event.data.id);
    });
    await t.test('signature checks exact bytes, age and rotated signatures',async()=>{
      const input=Buffer.from('{"a":1}'),ts=String(Math.floor(Date.now()/1000)),h=createHmac('sha256','key').update(ts+':').update(input).digest('hex');
      assert.equal(verifySignature(input,'ts='+ts+';h1='+'0'.repeat(64)+';h1='+h,'key'),true);assert.equal(verifySignature(Buffer.from('{ "a":1}'),'ts='+ts+';h1='+h,'key'),false);assert.equal(verifySignature(input,'ts='+ts+';h1='+h,'key',Date.now()+10000),false);
    });
    await t.test('concurrent checkout requests create one provider transaction and reuse its URL',async()=>{
      const f=await billingFixture();process.env.PADDLE_ENVIRONMENT='sandbox';process.env.PADDLE_API_KEY='test';process.env.PADDLE_CHECKOUT_URL='https://example.com/checkout';
      const original=global.fetch;let created=0,transaction;
      global.fetch=async(url,options)=>{if(!String(url).startsWith('https://sandbox-api.paddle.com'))return original(url,options);let data;
        if(String(url).includes('/prices/'))data={status:'active',unit_price:{currency_code:'USD',amount:'1499'},billing_cycle:{interval:'month',frequency:1},trial_period:null};
        else if(options.method==='POST'){created++;transaction={id:'txn_one'+randomUUID(),status:'ready',checkout:{url:'https://checkout.paddle.com/test'}};data=transaction;}
        else data=transaction;return new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});};
      try{const body={cycle:'MONTHLY',email:'buyer@example.com'};const results=await Promise.all([api('/billing/checkout','POST',body,f.token),api('/billing/checkout','POST',body,f.token)]);assert.ok(results.some(r=>r.status===200));assert.equal(created,1);assert.ok(results.every(r=>[200,409].includes(r.status)));assert.equal(ok(await api('/billing/checkout','POST',body,f.token)).url,'https://checkout.paddle.com/test');assert.equal(created,1);}finally{global.fetch=original;delete process.env.BILLING_PROVIDER;}
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));if(raw)await raw.$disconnect();if(wire)await wire.stop();await db.close();await fs.rm(uploads,{recursive:true,force:true});
  }
});
