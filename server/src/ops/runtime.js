const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
function log(event, fields={}) {
 const safe={time:new Date().toISOString(),event};
 for(const key of ['requestId','method','route','status','durationMs','code','name','eventId','pending'])if(fields[key]!=null)safe[key]=String(fields[key]).slice(0,150);
 process.stdout.write(JSON.stringify(safe)+'\n');
}
function requestLog(req,res,next){req.requestId=randomUUID();res.set('X-Request-ID',req.requestId);const start=performance.now();res.once('finish',()=>log('http',{requestId:req.requestId,method:req.method,route:(req.baseUrl||'')+(req.route?.path||'/unmatched'),status:res.statusCode,durationMs:Math.round(performance.now()-start)}));next();}
function validateEnvironment(env=process.env){
 if(env.TRUST_PROXY_HOPS&&!/^[0-3]$/.test(env.TRUST_PROXY_HOPS))throw Error('TRUST_PROXY_HOPS must be an integer from 0 to 3.');
 if(env.NODE_ENV==='production'){
  for(const key of ['DATABASE_URL','JWT_SECRET','APP_URL','UPLOADS_DIR','SUPPORT_EMAIL','SERVICE_OPERATOR_NAME'])if(!env[key])throw Error(key+' is required in production.');
  if(!/^https:\/\//.test(env.APP_URL))throw Error('APP_URL must use HTTPS in production.');
  if(!path.isAbsolute(env.UPLOADS_DIR))throw Error('UPLOADS_DIR must be an absolute persistent path.');
 }
 if(env.NODE_ENV==='production'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL))throw Error('SUPPORT_EMAIL must be a real contact email.');
 if(env.BILLING_PROVIDER==='paddle'){
  for(const key of ['PADDLE_API_KEY','PADDLE_CLIENT_TOKEN','PADDLE_WEBHOOK_SECRET','PADDLE_MONTHLY_PRICE_ID','PADDLE_YEARLY_PRICE_ID','PADDLE_CHECKOUT_URL'])if(!env[key])throw Error(key+' is required when Paddle billing is enabled.');
  if(!(env.PADDLE_ENVIRONMENT==='sandbox'?/^test_/:/^live_/).test(env.PADDLE_CLIENT_TOKEN||''))throw Error('PADDLE_CLIENT_TOKEN does not match the Paddle environment.');
  if(!['sandbox','live'].includes(env.PADDLE_ENVIRONMENT))throw Error('Choose sandbox or live for PADDLE_ENVIRONMENT.');
  if(!/^https:\/\//.test(env.PADDLE_CHECKOUT_URL))throw Error('PADDLE_CHECKOUT_URL must use HTTPS.');
 }
}
function readiness({db,uploadsRoot}){
 let inFlight=null;
 return async(_req,res)=>{
  if(!inFlight)inFlight=(async()=>{
   await db.$queryRawUnsafe('SELECT 1');
   await db.company.findFirst({select:{id:true,timezone:true}});
   await db.billingEvent.count();
   const failures=await db.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL');
   if(failures[0]?.count)throw Error('MIGRATION_FAILED');
   await fs.mkdir(uploadsRoot,{recursive:true});const file=path.join(uploadsRoot,'.ready-'+randomUUID());await fs.writeFile(file,'ready',{flag:'wx'});await fs.unlink(file);
  })().finally(()=>{inFlight=null;});
  let timer;
  try{await Promise.race([inFlight,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('READINESS_TIMEOUT')),3000);})]);res.set('Cache-Control','no-store').json({ok:true});}
  catch{res.set('Cache-Control','no-store').status(503).json({ok:false});}finally{clearTimeout(timer);}
 };
}
module.exports={log,requestLog,validateEnvironment,readiness};
