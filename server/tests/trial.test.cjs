const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite'),{PGLiteSocketServer}=require('@electric-sql/pglite-socket'),{createHmac,randomUUID}=require('node:crypto');
test('Verified trials and company subscriptions: isolation, exact expiry, conversion and rate limits',async t=>{
 const db=new PGlite();await db.waitReady;let wire,raw,server,originalSend;const originalFetch=global.fetch;
 try{
  await db.exec(await fs.readFile(path.join(__dirname,'fixtures/legacy-schema.sql'),'utf8'));await require('./helpers/current-migrations.cjs')(db,'202611070000');wire=new PGLiteSocketServer({db,port:0,host:'127.0.0.1'});await wire.start();
  Object.assign(process.env,{DATABASE_URL:`postgresql://postgres:postgres@127.0.0.1:${wire.getServerConn().split(':')[1]}/postgres?connection_limit=1`,JWT_SECRET:'trial-test-only-jwt-secret-at-least-32bytes',PLATFORM_OWNER_SECRET:'trial-test-only-operator-key-at-least-32',APP_URL:'https://app.example.invalid',NODE_ENV:'development',TRIAL_SIGNUP_ENABLED:'true',TRIAL_EMAIL_MODE:'console',TRUST_PROXY_HOPS:'1',BILLING_PROVIDER:'manual'});
  raw=require('../src/prismaClient').platformPrisma;const Mail=require('../src/trial-mail'),mail=[];originalSend=Mail.sendVerification;Mail.sendVerification=async message=>{mail.push(message);};server=require('../src/index').app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base='http://127.0.0.1:'+server.address().port;let ip=1,session,company,setupToken;
  async function api(route,method='GET',body,auth,headers={}){const r=await originalFetch(base+(route.startsWith('/webhooks')?'':'/api')+route,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':'10.1.0.'+ip,...(auth?{Authorization:'Bearer '+auth}:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
  const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
  const setup=token=>({token,code:'trial-shop',name:'Trial shop',adminName:'Trial owner',password:'PrivateTrialPassword!',pin:'684921',currency:'USD',timezone:'Asia/Baku',locale:'en',acceptedTerms:true});
  async function invitation(email,locale='en'){ip++;ok(await api('/trial/request','POST',{email,locale}));return mail.findLast(m=>m.email===email)?.token;}
  await t.test('email request creates no company, exposes no token and stores only its hash',async()=>{const count=await raw.company.count();const r=ok(await api('/trial/request','POST',{email:'Owner@trial-example.com',locale:'en'}));setupToken=mail.at(-1).token;assert.equal(mail.at(-1).email,'owner@trial-example.com');assert.equal(mail.at(-1).locale,'en');assert.equal(await raw.company.count(),count);assert.ok(!JSON.stringify(r).includes(setupToken));const p=await raw.trialInvitation.findFirst({where:{email:'owner@trial-example.com'}});assert.notEqual(p.tokenHash,setupToken);assert.equal(p.ipHash.length,64);assert.ok(!JSON.stringify(p).includes('10.1.0.'));assert.equal(ok(await api('/trial/inspect','POST',{token:setupToken})).email,'owner@trial-example.com');});
  await t.test('bad email, unsupported language and forged or expired links reject without provisioning',async()=>{for(const email of ['wrong','a@b.invalid','bad\r\nbcc:hello@example.com'])assert.equal((await api('/trial/request','POST',{email})).status,400);ip++;assert.equal((await api('/trial/request','POST',{email:'good@example.com',locale:'pl'})).status,400);assert.equal((await api('/trial/inspect','POST',{token:'bad'})).status,400);assert.equal((await api('/trial/inspect','POST',{token:'a'.repeat(64)})).status,410);const token=await invitation('expired@example.com');await raw.trialInvitation.updateMany({where:{email:'expired@example.com'},data:{expiresAt:new Date(Date.now()-1)}});assert.equal((await api('/trial/inspect','POST',{token})).status,410);assert.equal((await api('/trial/activate','POST',setup(token))).status,410);});
  await t.test('terms, private PIN, strong password and valid setup fields are mandatory',async()=>{ip++;for(const changed of [{acceptedTerms:false},{pin:'2580'},{password:'short'},{timezone:'bad/zone'},{currency:'XXX'},{code:'A@bad'},{trialConvertedAt:new Date().toISOString()}])assert.equal((await api('/trial/activate','POST',{...setup(setupToken),...changed})).status,400);assert.equal(await raw.company.count({where:{trialEmail:'owner@trial-example.com'}}),0);});
  await t.test('activation creates an empty, separate Starter workspace for exactly 336 hours',async()=>{ip++;const r=ok(await api('/trial/activate','POST',setup(setupToken)),201);company=r.company;assert.equal(company.loginEmail,'trial-shop@zindex.com');assert.equal(company.isDemo,false);assert.equal(company.trial.status,'active');assert.equal(+new Date(company.trial.endsAt)-+new Date(company.trial.startedAt),14*86400000);assert.equal(company.trial.daysRemaining,14);assert.ok(!JSON.stringify(company).includes('trialEmail'));assert.equal(await raw.user.count({where:{companyId:company.id}}),1);assert.equal(await raw.product.count({where:{companyId:company.id}}),0);assert.equal(await raw.order.count({where:{companyId:company.id}}),0);const c=await raw.company.findUnique({where:{id:company.id}});assert.equal(c.trialTermsVersion,'2026-11-28');assert.equal(c.trialEmail,'owner@trial-example.com');assert.equal(c.endsAt.toISOString(),company.trial.endsAt);});
  await t.test('lost activation responses replay one account; changed payloads cannot reuse the link',async()=>{assert.equal(ok(await api('/trial/activate','POST',setup(setupToken))).replayed,true);assert.equal(await raw.company.count({where:{trialEmail:'owner@trial-example.com'}}),1);assert.equal((await api('/trial/activate','POST',{...setup(setupToken),name:'Other name'})).status,409);assert.equal(await raw.auditEvent.count({where:{companyId:company.id,action:'TRIAL_ACTIVATED'}}),1);});
  await t.test('OTP.com verifies SMS and WhatsApp before issuing a trial invitation',async()=>{
   ip++;
   process.env.TRIAL_PHONE_ENABLED='true';
   const config=ok(await api('/trial/config'));
   assert.equal(config.phoneEnabled,false);
   assert.equal(config.trialDays,14);
   const send = (phone, extra) => api('/trial/phone/request','POST',{phone,locale:'az',consent:true,...extra});
   const verify = (challenge, code='601238') => api('/trial/phone/verify','POST',{challenge,code});
   const phone='+994000000000';
   assert.equal((await send(phone)).status,503);

   const key='otp_test_fixture';
   process.env.OTP_COM_API_KEY=key;
   const calls=[];
   let sends=0;
   let channel='sms';
   let codeBack=false;
   let sendError;
   global.fetch=async(url, options)=>{
    assert.ok(url.startsWith('https://api.otp.com/api/v1/otp/'));
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer '+key);
    const body=JSON.parse(options.body);
    calls.push({url,body});
    if(url.endsWith('/send')){
     assert.match(options.headers['idempotency-key'],/^trial:[a-f0-9]{64}$/);
     if(sendError) return Response.json({error:'Upstream details'},{status:sendError});
     return Response.json({
      otp_id:'opaque-otp-'+(++sends), channel, status:'pending', completion:'code',
      action_url:codeBack?'https://wa.me/123456789?text=verify':null,
     });
    }
    assert.ok(url.endsWith('/verify'));
    const matched=body.code==='601238';
    return Response.json({otp_id:body.otp_id,matched,status:matched?'approved':'pending'});
   };
   try{
    assert.equal(ok(await api('/trial/config')).phoneEnabled,true);
    assert.equal((await send('+16505553434')).status,400);
    assert.equal((await send(phone,{consent:false})).status,400);
    assert.equal((await verify('a'.repeat(64))).status,410);
    assert.equal(calls.length,0);
    const first=ok(await send(phone));
    assert.deepEqual(Object.keys(first).sort(),['actionUrl','challenge','channel']);
    assert.equal(first.channel,'sms');
    assert.equal(first.actionUrl,null);
    assert.deepEqual(calls[0].body,{recipient:phone,locale:'az',client_ip:'10.1.0.'+ip});

    assert.equal((await send(phone)).status,429);
    assert.equal(sends,1);
    assert.equal((await verify(first.challenge,'000000')).status,400);
    assert.equal(await raw.trialInvitation.count({where:{phone}}),0);
    const token=ok(await verify(first.challenge)).token;
    assert.deepEqual(calls.at(-1).body,{otp_id:'opaque-otp-1',code:'601238'});
    const verifiedCalls=calls.length;
    assert.equal(ok(await verify(first.challenge)).token,token);
    assert.equal((await verify(first.challenge,'000000')).status,410);
    assert.equal(calls.length,verifiedCalls);
    assert.equal(await raw.trialInvitation.count({where:{phone}}),1);

    // Allow another request after the cooldown, on the account's WhatsApp route.
    await raw.trialPhoneChallenge.updateMany({where:{phone},data:{createdAt:new Date(Date.now()-61000)}});
    channel='whatsapp';
    codeBack=true;
    const whatsapp=ok(await send(phone));
    assert.equal(whatsapp.channel,'whatsapp');
    assert.equal(whatsapp.actionUrl,'https://wa.me/123456789?text=verify');
    const parallelToken=ok(await verify(whatsapp.challenge)).token;

    assert.equal(await raw.company.count({where:{trialPhone:phone}}),0);
    const inspected=ok(await api('/trial/inspect','POST',{token}));
    assert.equal(inspected.phone,phone);
    assert.equal(inspected.trialDays,14);
    assert.equal(inspected.email,undefined);
    const input={...setup(token),code:'sms-trial-shop',currency:'AZN'};
    const activated=ok(await api('/trial/activate','POST',input),201).company;
    assert.equal(activated.market,'AZ');
    assert.equal(activated.loginEmail,'sms-trial-shop@zindex.com');
    assert.equal(activated.trial.status,'active');
    assert.equal(+new Date(activated.trial.endsAt)-+new Date(activated.trial.startedAt),14*86400000);
    assert.ok(!JSON.stringify(activated).includes(phone));
    const stored=await raw.company.findUnique({where:{trialPhone:phone}});
    assert.equal(stored.trialEmail,null);
    assert.equal(stored.trialPhone,phone);
    assert.equal(ok(await api('/trial/activate','POST',input)).replayed,true);
    assert.equal((await api('/trial/activate','POST',{...input,token:parallelToken,code:'sms-trial-again'})).status,409);

    await raw.trialPhoneChallenge.updateMany({where:{phone},data:{createdAt:new Date(Date.now()-61000)}});
    const used=ok(await send(phone));
    assert.equal((await verify(used.challenge)).status,409);
    const login=ok(await api('/auth/company-login','POST',{email:activated.loginEmail,password:input.password}));
    const {token:localSession}=ok(await api('/auth/pin-login','POST',{pin:input.pin},login.loginToken));
    const billing=ok(await api('/billing','GET',null,localSession));
    assert.equal(billing.billingEmail,'');
    assert.deepEqual(billing.offers,{currency:'AZN',MONTHLY:5000,YEARLY:50000});

    ip++;
    sendError=402;
    const failed=await send('+994000000001');
    assert.equal(failed.status,503);
    assert.ok(!JSON.stringify(failed).includes('Upstream details'));
    sendError=undefined;
    const limited=ok(await send('+994000000002'));
    for(let attempt=0;attempt<5;attempt++) assert.equal((await verify(limited.challenge,'000000')).status,400);
    const before=calls.length;
    assert.equal((await verify(limited.challenge)).status,410);
    assert.equal(calls.length,before);
   }finally{
    global.fetch=originalFetch;
    delete process.env.TRIAL_PHONE_ENABLED;
    delete process.env.OTP_COM_API_KEY;
   }
  });
  await t.test('claimed emails cannot restart a trial and bot honeypots send nothing',async()=>{ip++;const n=mail.length;ok(await api('/trial/request','POST',{email:'owner@trial-example.com'}));ok(await api('/trial/request','POST',{email:'bot@example.com',website:'https://spam.example.com'}));assert.equal(mail.length,n);assert.equal(await raw.trialInvitation.count({where:{email:'bot@example.com'}}),0);});
  await t.test('cooldowns and IP limits also count successful requests',async()=>{ip++;const n=mail.length;for(let k=0;k<3;k++)ok(await api('/trial/request','POST',{email:'cooldown@example.com'}));assert.equal(mail.length,n+1);for(let k=0;k<5;k++)ok(await api('/trial/request','POST',{email:`ip-limit-${k}@example.com`}));assert.equal((await api('/trial/request','POST',{email:'ip-over@example.com'})).status,429);});
  await t.test('company-code collisions roll back all writes and leave the verification link usable',async()=>{const token=await invitation('code-clash@example.com');assert.equal((await api('/trial/activate','POST',setup(token))).status,409);assert.equal((await raw.trialInvitation.findFirst({where:{email:'code-clash@example.com'}})).usedAt,null);assert.notEqual(ok(await api('/trial/activate','POST',{...setup(token),code:'another-shop'}),201).company.id,company.id);});
  await t.test('choosing Azerbaijani before or after verification creates a local billing offer', async () => {
   assert.equal(company.market, 'GLOBAL');
   assert.deepEqual(company.subscriptionPrice, {currency: 'USD', amountMinor: 0});
   for (const [requestLocale, setupLocale] of [['az', 'en'], ['en', 'az']]) {
    const code = 'local-shop-' + requestLocale;
    const token = await invitation(code + '@example.com', requestLocale);
    assert.equal(mail.at(-1).locale, requestLocale);
    const input = {...setup(token), code, locale: setupLocale};
    const {company: local} = ok(await api('/trial/activate', 'POST', input), 201);
    assert.equal(local.market, 'AZ');
    assert.equal(local.currency, 'USD');
    assert.deepEqual(local.subscriptionPrice, {currency: 'AZN', amountMinor: 0});
    const login = ok(await api('/auth/company-login', 'POST', {email: local.loginEmail, password: input.password}));
    const {token: localSession} = ok(await api('/auth/pin-login', 'POST', {pin: input.pin}, login.loginToken));
    const billing = ok(await api('/billing', 'GET', null, localSession));
    assert.deepEqual(billing.offers, {currency: 'AZN', MONTHLY: 5000, YEARLY: 50000});
    assert.equal(billing.enabled, false);
   }
  });
  await t.test('trial login retains password plus PIN and the Starter three-user limit',async()=>{ip++;const c=ok(await api('/auth/company-login','POST',{email:company.loginEmail,password:setup('').password}));session=ok(await api('/auth/pin-login','POST',{pin:'684921'},c.loginToken)).token;assert.equal(ok(await api('/auth/me','GET',null,session)).company.trial.status,'active');for(const [fullName,pin,role]of [['Warehouse','684922','WAREHOUSE'],['Sales','684923','EXPEDITOR']])ok(await api('/users','POST',{fullName,pin,role},session),201);assert.equal((await api('/users','POST',{fullName:'Fourth account',pin:'684924',role:'EXPEDITOR'},session)).status,409);const foreign=await raw.customer.create({data:{companyId:'legacy-company',name:'Foreign customer'}});assert.equal((await api(`/customers/${foreign.id}/profile`,'GET',null,session)).status,404);});
  let checkout;
  await t.test('active trials can open a future Paddle checkout without becoming paid prematurely',async()=>{ip++;Object.assign(process.env,{BILLING_PROVIDER:'paddle',PADDLE_ENVIRONMENT:'sandbox',PADDLE_MONTHLY_PRICE_ID:'pri_trial_month',PADDLE_YEARLY_PRICE_ID:'pri_trial_year',PADDLE_WEBHOOK_SECRET:'trial-test-only-webhook',PADDLE_CHECKOUT_URL:'https://app.example.invalid/checkout'});global.fetch=async(url,options)=>{if(String(url).startsWith('https://sandbox-api.paddle.com/prices/'))return {ok:true,json:async()=>({data:{status:'active',unit_price:{currency_code:'USD',amount:'1999'},billing_cycle:{frequency:1,interval:'month'},trial_period:null}})};if(String(url)==='https://sandbox-api.paddle.com/transactions')return {ok:true,json:async()=>({data:{id:'txn_trialtest',checkout:{url:'https://checkout.example.invalid/pay'}}})};return originalFetch(url,options);};assert.equal(ok(await api('/billing/checkout','POST',{cycle:'MONTHLY',email:'owner@trial-example.com'},session)).url,'https://checkout.example.invalid/pay');checkout=await raw.billingCheckout.findFirst({where:{companyId:company.id}});assert.equal((await raw.company.findUnique({where:{id:company.id}})).trialConvertedAt,null);assert.equal(await raw.payment.count({where:{companyId:company.id}}),0);});
  await t.test('an unpaid canceled checkout cannot shorten the original free trial',async()=>{const c=await raw.company.findUnique({where:{loginEmail:'another-shop@zindex.com'}});await raw.billingAccount.create({data:{companyId:c.id,subscriptionId:'sub_unpaid',customerId:'ctm_unpaid',status:'trialing'}});await raw.$transaction(tx=>require('../src/ops/billing').applyEvent(tx,{event_type:'subscription.canceled',occurred_at:new Date().toISOString(),data:{id:'sub_unpaid',customer_id:'ctm_unpaid',status:'canceled'}}));const after=await raw.company.findUnique({where:{id:c.id}});assert.equal(+after.endsAt,+c.endsAt);assert.equal(after.trialConvertedAt,null);});
  await t.test('deadline blocks old sessions and login even when normal subscription expiry is extended directly',async()=>{await raw.customer.create({data:{companyId:company.id,name:'Trial data retained'}});await raw.company.update({where:{id:company.id},data:{trialStartedAt:new Date(Date.now()-15*86400000),trialEndsAt:new Date(Date.now()-1000),endsAt:new Date(Date.now()+30*86400000)}});assert.equal((await api('/auth/me','GET',null,session)).status,403);assert.equal((await api('/customers','POST',{name:'Blocked after expiry'},session)).status,403);assert.equal((await api('/auth/company-login','POST',{email:company.loginEmail,password:setup('').password})).status,403);assert.equal(await raw.customer.count({where:{companyId:company.id}}),1);});
  let renewal;
  await t.test('expired trials retain restricted renewal access and verified billing email',async()=>{ip++;renewal=ok(await api('/billing/renewal-login','POST',{email:company.loginEmail,password:setup('').password,pin:'684921'})).token;const r=ok(await api('/billing','GET',null,renewal));assert.equal(r.company.trial.status,'expired');assert.equal(r.billingEmail,'owner@trial-example.com');assert.equal((await api('/customers','GET',null,renewal)).status,401);});
  await t.test('a valid payment event converts the same company and preserves records; forged events cannot',async()=>{const event={event_id:'evt_trialpaid',event_type:'subscription.activated',occurred_at:new Date().toISOString(),data:{id:'sub_trialtest',customer_id:'ctm_trialtest',transaction_id:checkout.transactionId,custom_data:{checkout_ref:checkout.id},status:'active',items:[{quantity:1,price:{id:'pri_trial_month'}}],current_billing_period:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+30*86400000).toISOString()}}};const body=JSON.stringify(event),ts=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',process.env.PADDLE_WEBHOOK_SECRET).update(ts+':'+body).digest('hex');assert.equal((await api('/webhooks/paddle','POST',body,null,{'Paddle-Signature':'bad'})).status,400);assert.equal((await raw.company.findUnique({where:{id:company.id}})).trialConvertedAt,null);ok(await api('/webhooks/paddle','POST',body,null,{'Paddle-Signature':`ts=${ts};h1=${sig}`}));await require('../src/ops/billing').processEvents(raw);const c=await raw.company.findUnique({where:{id:company.id}});assert.ok(c.trialConvertedAt);assert.equal(c.trialEmail,'owner@trial-example.com');assert.equal(await raw.customer.count({where:{companyId:company.id}}),1);assert.equal(ok(await api('/auth/me','GET',null,session)).company.trial.status,'converted');assert.equal(await raw.payment.count({where:{companyId:company.id}}),0);});
  await t.test('operator manual activation converts a trial without faking a payment',async()=>{process.env.BILLING_PROVIDER='manual';const c=await raw.company.findUnique({where:{loginEmail:'another-shop@zindex.com'}});const r=ok(await api(`/operator/companies/${c.id}/subscription`,'PATCH',{expectedAuthVersion:c.authVersion,endsOn:'2030-01-01',billingCycle:'YEARLY',reason:'Manual subscription access'},process.env.PLATFORM_OWNER_SECRET,{'Idempotency-Key':randomUUID()}));assert.ok(r.company.trialConvertedAt);assert.equal(await raw.payment.count({where:{companyId:c.id}}),0);});
  await t.test('operator-created plans persist their prices and allow renewal at the assigned terms', async () => {
   const owner=process.env.PLATFORM_OWNER_SECRET;
   const baseInput={name:'Operator provisioned store',password:'OperatorTestPassword!',pins:{ADMIN:'683417',WAREHOUSE:'683418',EXPEDITOR:'683419'},market:'AZ',currency:'USD',timezone:'Asia/Baku'};
   const create=(subscriptionType,extra={})=>api('/operator/companies','POST',{...baseInput,code:'provision-'+subscriptionType.toLowerCase(),subscriptionType,...extra},owner);
   ip++;
   assert.equal((await create('CUSTOM')).status,400);
   assert.equal((await create('CUSTOM',{customMonthlyPriceMinor:0})).status,400);
   assert.equal((await create('CUSTOM',{customMonthlyPriceMinor:3550,market:'GLOBAL'})).status,400);
   assert.equal((await create('YEARLY',{customMonthlyPriceMinor:3550})).status,400);
   for (const [type, amountMinor] of [['TRIAL',0],['MONTHLY',5000],['YEARLY',50000],['CUSTOM',3550]]) {
    ip++;
    const {company:created}=ok(await create(type,type==='CUSTOM'?{customMonthlyPriceMinor:amountMinor}:{}),201);
    const login=ok(await api('/auth/company-login','POST',{email:created.loginEmail,password:baseInput.password}));
    const {token}=ok(await api('/auth/pin-login','POST',{pin:baseInput.pins.ADMIN},login.loginToken));
    const billing=ok(await api('/billing','GET',null,token));
    assert.equal(billing.company.subscriptionType,type);
    assert.equal(billing.company.billingCycle,type==='YEARLY'?'YEARLY':'MONTHLY');
    assert.equal(billing.company.currency,'USD');
    assert.deepEqual(billing.company.subscriptionPrice,{currency:'AZN',amountMinor});
    const current=await raw.company.findUniqueOrThrow({where:{id:created.id}});
    assert.equal(await raw.user.count({where:{companyId:created.id}}),3);

    if(type==='TRIAL'){
     assert.equal(+current.endsAt-+current.startsAt,14*86400000);
     assert.equal(+current.endsAt,+current.trialEndsAt);
     assert.equal(billing.company.trial.status,'active');
     assert.equal(await raw.payment.count({where:{companyId:created.id}}),0);
    }else{
     assert.equal(current.trialStartedAt,null);
     assert.ok(+current.endsAt-+current.startsAt>=(type==='YEARLY'?365:28)*86400000);
    }
    if(type==='CUSTOM'){
     assert.deepEqual(billing.offers,{currency:'AZN',MONTHLY:3550});
     assert.equal(billing.enabled,false);
     const renew=(input)=>api('/operator/companies/'+created.id+'/subscription','PATCH',input,owner,{'Idempotency-Key':randomUUID()});
     const renewal={endsOn:'2030-01-31',billingCycle:'MONTHLY',reason:'Manual renewal',expectedAuthVersion:current.authVersion};
     const kept=ok(await renew(renewal)).company;
     assert.equal(kept.subscriptionType,'CUSTOM');
     assert.deepEqual(kept.subscriptionPrice,{currency:'AZN',amountMinor:3550});
     const yearly=ok(await renew({...renewal,billingCycle:'YEARLY',expectedAuthVersion:kept.authVersion})).company;
     assert.equal(yearly.customMonthlyPriceMinor,null);
     assert.deepEqual(yearly.subscriptionPrice,{currency:'AZN',amountMinor:50000});
    }
   }
  });
  await t.test('SMTP errors do not expose a token or create a company; retry is possible after cooldown',async()=>{ip++;const count=await raw.company.count(),n=mail.length;Mail.sendVerification=async()=>{throw Error('SMTP private credential failure');};const r=ok(await api('/trial/request','POST',{email:'mail-fail@example.com'}));assert.ok(!JSON.stringify(r).includes('SMTP'));assert.equal(await raw.company.count(),count);assert.equal(mail.length,n);Mail.sendVerification=async message=>{mail.push(message);};await raw.trialInvitation.updateMany({where:{email:'mail-fail@example.com'},data:{createdAt:new Date(Date.now()-70000)}});ok(await api('/trial/request','POST',{email:'mail-fail@example.com'}));assert.equal(mail.length,n+1);});
  await t.test('console delivery is development-only, signup can be disabled and scoped clients cannot read tokens',async()=>{assert.equal(require('../src/trial-mail').mode({...process.env,NODE_ENV:'production'}),null);assert.throws(()=>require('../src/ops/runtime').validateEnvironment({...process.env,NODE_ENV:'production'}),/SMTP/);await assert.rejects(require('../src/tenant-context').runWithCompany(company.id,async()=>await require('../src/prismaClient').prisma.trialInvitation.findMany()),/icazəli/);process.env.TRIAL_SIGNUP_ENABLED='false';assert.equal(ok(await api('/trial/config')).enabled,false);assert.equal((await api('/trial/request','POST',{email:'disabled@example.com'})).status,503);});
 }finally{global.fetch=originalFetch;if(originalSend)require('../src/trial-mail').sendVerification=originalSend;if(server)await new Promise(r=>server.close(r));if(raw)await raw.$disconnect();if(wire)await wire.stop();await db.close();}
});
