const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
const path=require('node:path');

test('Native PostgreSQL: concurrent trial activation, hard expiry and signup integrity', {skip:!process.env.NATIVE_DATABASE_URL,timeout:60000}, async t=>{
 const anchor=new URL(process.env.NATIVE_DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(anchor.hostname));assert.ok(anchor.pathname.endsWith('_test'));
 const admin=new Client({connectionString:anchor.href}),name='trial_'+randomUUID().replaceAll('-','')+'_test';
 let db,server,originalSend;await admin.connect();
 try {
  await admin.query('CREATE DATABASE "'+name+'"');const url=new URL(anchor);url.pathname='/'+name;
  Object.assign(process.env,{DATABASE_URL:url.href+'?connection_limit=12',NODE_ENV:'development',JWT_SECRET:'native-trial-test-only-at-least-32-bytes',TRIAL_SIGNUP_ENABLED:'true',TRIAL_EMAIL_MODE:'console',APP_URL:'http://localhost:5173',TRUST_PROXY_HOPS:'1',BILLING_PROVIDER:'manual'});
  await execFile(process.execPath,[path.resolve(__dirname,'../node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:path.resolve(__dirname,'..'),env:process.env});
  db=require('../src/prismaClient').platformPrisma;
  const Mail=require('../src/trial-mail'),sent=[];originalSend=Mail.sendVerification;Mail.sendVerification=async m=>sent.push(m);
  server=require('../src/index').app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  const base='http://127.0.0.1:'+server.address().port+'/api/trial';let ip=1;
  async function call(route,body){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'10.9.0.'+ip},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
  const body=(token,code)=>({token,code,name:'Concurrent company',adminName:'Owner',password:'TestOnlyNativePassword!',pin:'694821',currency:'EUR',timezone:'Europe/Warsaw',locale:'en',acceptedTerms:true});
  async function invite(email){ip++;assert.equal((await call('/request',{email})).status,200);return sent.at(-1).token;}
  await t.test('simultaneous activation of one token creates exactly one company and owner',async()=>{
   const token=await invite('native-one@example.com'),results=await Promise.all([call('/activate',body(token,'native-one')),call('/activate',body(token,'native-one'))]);
   assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));assert.ok(results.every(r=>[200,201,409].includes(r.status)),JSON.stringify(results));
   const company=await db.company.findUnique({where:{trialEmail:'native-one@example.com'}});assert.equal(await db.user.count({where:{companyId:company.id}}),1);assert.equal(await db.auditEvent.count({where:{companyId:company.id,action:'TRIAL_ACTIVATED'}}),1);
   assert.equal((await call('/activate',body(token,'native-one'))).status,200);
  });
  await t.test('two valid links for one email cannot create two workspaces in parallel',async()=>{
   const email='native-two@example.com',a=await invite(email);await db.trialInvitation.updateMany({where:{email},data:{createdAt:new Date(Date.now()-70000)}});const b=await invite(email);
   const results=await Promise.all([call('/activate',body(a,'native-two-a')),call('/activate',body(b,'native-two-b'))]);
   assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));assert.ok(results.every(r=>[201,409].includes(r.status)),JSON.stringify(results));assert.equal(await db.company.count({where:{trialEmail:email}}),1);
   assert.equal(await db.company.count({where:{loginEmail:{in:['native-two-a@zindex.com','native-two-b@zindex.com']}}}),1);
  });
  await t.test('concurrent phone requests send one code and create one invitation',async()=>{
   const originalFetch=global.fetch;
   let sends=0,checks=0;
   process.env.TRIAL_PHONE_ENABLED='true';
   process.env.OTP_COM_API_KEY='otp_test_fixture';
   global.fetch=async(url,options)=>{
    if(!url.startsWith('https://api.otp.com/api/v1/otp/')) return originalFetch(url,options);
    if(url.endsWith('/send')){
     sends++;
     return Response.json({otp_id:'native-fixture',channel:'sms',status:'pending',completion:'code'});
    }
    checks++;
    return Response.json({otp_id:'native-fixture',status:'approved',matched:true});
   };
   try{
    ip++;
    const phone='+994000000000';
    const results=await Promise.all(Array.from({length:4},()=>call('/phone/request',{phone,consent:true})));
    assert.deepEqual(results.map(result=>result.status).sort(),[200,429,429,429]);
    assert.equal(sends,1);
    const challenge=results.find(result=>result.status===200).data.challenge;
    const resultsVerify=await Promise.all(Array.from({length:2},()=>call('/phone/verify',{challenge,code:'601238'})));
    assert.ok(resultsVerify.some(result=>result.status===200));
    assert.ok(resultsVerify.every(result=>[200,429].includes(result.status)));
    assert.equal(checks,1);
    assert.equal(await db.trialInvitation.count({where:{phone}}),1);
   }finally{
    global.fetch=originalFetch;
    delete process.env.TRIAL_PHONE_ENABLED;
    delete process.env.OTP_COM_API_KEY;
   }
  });
  await t.test('database refuses partial dates; exact boundary revokes access without deleting records',async()=>{
   const c=await db.company.findUnique({where:{trialEmail:'native-one@example.com'}}),{subscriptionIsActive}=require('../src/config/plans');
   assert.equal(subscriptionIsActive(c,new Date(+c.trialEndsAt-1)),true);assert.equal(subscriptionIsActive(c,c.trialEndsAt),false);
   await assert.rejects(db.company.update({where:{id:c.id},data:{trialEndsAt:null}}));assert.equal(await db.user.count({where:{companyId:c.id}}),1);
  });
 } finally {
  if(originalSend)require('../src/trial-mail').sendVerification=originalSend;
  if(server)await new Promise(r=>server.close(r));if(db)await db.$disconnect();
  await admin.query('DROP DATABASE IF EXISTS "'+name+'" WITH (FORCE)');await admin.end();
 }
});
