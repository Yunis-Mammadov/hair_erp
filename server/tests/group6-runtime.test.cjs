const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {validateEnvironment,log,readiness}=require('../src/ops/runtime');
const {createPaddle}=require('../src/ops/billing');
const {verify}=require('../scripts/backup.cjs');
test('production refuses missing secrets, HTTP app URLs, relative storage and invalid proxy trust',()=>{
 assert.throws(()=>validateEnvironment({NODE_ENV:'production'}),/DATABASE_URL/);
 const env={NODE_ENV:'production',DATABASE_URL:'postgresql://localhost/test',JWT_SECRET:'x'.repeat(40),APP_URL:'https://example.com',UPLOADS_DIR:'/data/uploads',SUPPORT_EMAIL:'help@example.com',SERVICE_OPERATOR_NAME:'Test Operator'};assert.doesNotThrow(()=>validateEnvironment(env));
 assert.throws(()=>validateEnvironment({...env,APP_URL:'http://example.com'}),/HTTPS/);assert.throws(()=>validateEnvironment({...env,UPLOADS_DIR:'uploads'}),/absolute/);assert.throws(()=>validateEnvironment({...env,TRUST_PROXY_HOPS:'true'}),/TRUST_PROXY/);
});
test('Paddle environment requires matching public client tokens and private keys',()=>{
 const env={BILLING_PROVIDER:'paddle',PADDLE_ENVIRONMENT:'sandbox',PADDLE_API_KEY:'private',PADDLE_CLIENT_TOKEN:'test_public',PADDLE_WEBHOOK_SECRET:'secret',PADDLE_MONTHLY_PRICE_ID:'pri_month',PADDLE_YEARLY_PRICE_ID:'pri_year',PADDLE_CHECKOUT_URL:'https://example.com/checkout'};assert.doesNotThrow(()=>validateEnvironment(env));assert.throws(()=>validateEnvironment({...env,PADDLE_CLIENT_TOKEN:'private_api_key'}),/CLIENT_TOKEN/);assert.throws(()=>validateEnvironment({...env,PADDLE_ENVIRONMENT:'live'}),/CLIENT_TOKEN/);
});
test('structured logs omit passwords, tokens, request bodies and arbitrary errors',()=>{
 let output='';const original=process.stdout.write;process.stdout.write=value=>{output+=value;return true;};try{log('request',{requestId:'safe',status:500,password:'private-password',body:{pin:'1234'},token:'secret',message:'database URL'});}finally{process.stdout.write=original;}const parsed=JSON.parse(output);assert.equal(parsed.requestId,'safe');assert.ok(!output.includes('private-password'));assert.ok(!output.includes('1234'));assert.ok(!output.includes('database URL'));assert.ok(!output.includes('secret'));
});
test('provider transport does not leak upstream error bodies or API keys',async()=>{
 const request=createPaddle({PADDLE_ENVIRONMENT:'sandbox',PADDLE_API_KEY:'private'},async()=>new Response('private payment details',{status:500}));await assert.rejects(request('GET','/transactions/txn_test'),error=>error.status===502&&!error.message.includes('private'));const unavailable=createPaddle({PADDLE_ENVIRONMENT:'sandbox',PADDLE_API_KEY:'private'},async()=>{throw Error('credentials');});await assert.rejects(unavailable('GET','/prices/id'),error=>!error.message.includes('credentials'));
});
test('readiness returns 503 without exposing DB connection details',async()=>{
 const handler=readiness({db:{$queryRawUnsafe:async()=>{throw Error('postgresql://secret:password@private');}},uploadsRoot:'/unused'});let status=200,result;const res={set(){return this;},status(value){status=value;return this;},json(value){result=value;return this;}};await handler({},res);assert.equal(status,503);assert.deepEqual(result,{ok:false});
});
test('backup verifier rejects unsafe and incomplete manifests',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'zindex-manifest-'));try{await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({format:1,sourceDatabase:'test',files:{'../private':'x'}}));await assert.rejects(verify(root),/Unsafe/);await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({format:1,sourceDatabase:'test',files:{}}));await assert.rejects(verify(root),/archive missing/);}finally{await fs.rm(root,{recursive:true,force:true});}
});
