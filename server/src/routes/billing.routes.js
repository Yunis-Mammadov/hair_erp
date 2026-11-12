const {Router,raw}=require('express');
const bcrypt=require('bcrypt');
const {platformPrisma:db}=require('../prismaClient');
const {signToken,verifyToken,bearerToken,attemptLimiter}=require('../auth-security');
const {publicCompany,subscriptionIsActive}=require('../config/plans');
const {verifySignature,createPaddle,fail}=require('../ops/billing');
const router=Router();
const route=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
const publicService=()=>({operator:process.env.SERVICE_OPERATOR_NAME||null,supportEmail:process.env.SUPPORT_EMAIL||null,privacyEmail:process.env.PRIVACY_EMAIL||process.env.SUPPORT_EMAIL||null,dataRegion:process.env.DATA_REGION||null,retentionDays:Number(process.env.DATA_RETENTION_DAYS)||null,billingProvider:process.env.BILLING_PROVIDER==='paddle'?'paddle':'manual',checkout:process.env.BILLING_PROVIDER==='paddle'&&/^(test_|live_)/.test(process.env.PADDLE_CLIENT_TOKEN||'')?{clientToken:process.env.PADDLE_CLIENT_TOKEN,environment:process.env.PADDLE_ENVIRONMENT}:null});
router.get(['/public/service','/api/public/service'],(_req,res)=>res.json(publicService()));
router.post('/webhooks/paddle',raw({type:'application/json',limit:'256kb'}),route(async(req,res)=>{
 if(process.env.BILLING_PROVIDER!=='paddle')throw fail(503,'Billing is not configured.','BILLING_DISABLED');
 if(!verifySignature(req.body,req.get('Paddle-Signature'),process.env.PADDLE_WEBHOOK_SECRET))throw fail(400,'Invalid webhook signature.','INVALID_SIGNATURE');
 let event;try{event=JSON.parse(req.body.toString('utf8'));}catch{throw fail(400,'Invalid webhook payload.');}
 if(!/^evt_[a-z0-9]+$/.test(event.event_id||'')||typeof event.event_type!=='string'||!Number.isFinite(+new Date(event.occurred_at))||!event.data||typeof event.data!=='object')throw fail(400,'Invalid webhook event.');
 try{await db.billingEvent.create({data:{id:event.event_id,type:event.event_type,occurredAt:new Date(event.occurred_at),payload:event}});}catch(e){if(e.code!=='P2002')throw e;}
 res.json({received:true});
}));
const renewalLimiter=attemptLimiter(5,15*60000,req=>String(req.body?.email||'').toLowerCase());
router.post('/api/billing/renewal-login',require('express').json({limit:'4kb'}),renewalLimiter,route(async(req,res)=>{
 const {email,password,pin}=req.body||{};
 if(typeof email!=='string'||email.length>254||typeof password!=='string'||Buffer.byteLength(password)>72||typeof pin!=='string'||!/^\d{4,8}$/.test(pin))throw fail(400,'Enter company email, password and admin PIN.');
 const company=await db.company.findUnique({where:{loginEmail:email.trim().toLowerCase()}});
 const dummy='$2b$04$R69NAN1YzCqwL89mYKjS0ukIuEaGYo/M0R9sG6PJpN6ke0o.5FVJm';
 if(!await bcrypt.compare(password,company?.passwordHash||dummy)||!company?.isActive)throw fail(401,'Company credentials or admin PIN are incorrect.');
 const users=await db.user.findMany({where:{companyId:company.id,isActive:true,role:'ADMIN'}});let user;
 for(const candidate of users)if(candidate.pinHash&&await bcrypt.compare(pin,candidate.pinHash))user=candidate;
 if(!user)throw fail(401,'Company credentials or admin PIN are incorrect.');
 const token=signToken({companyId:company.id,userId:user.id,userVersion:user.authVersion,companyVersion:company.authVersion},'renewal','15m');
 res.set('Cache-Control','no-store').json({token});
}));
async function billingAuth(req,res,next){
 try{
  let token;try{token=verifyToken(bearerToken(req),'session');}catch{token=verifyToken(bearerToken(req),'renewal');}
  const user=await db.user.findFirst({where:{id:token.userId,companyId:token.companyId,isActive:true},include:{company:true}});
  if(!user||user.role!=='ADMIN'||!user.company.isActive||user.authVersion!==token.userVersion||user.company.authVersion!==token.companyVersion)throw Error('AUTH');
  req.billingCompany=user.company;next();
 }catch(e){if(e.name?.startsWith('Prisma'))return next(e);res.status(401).json({message:'Administrator sign-in is required.'});}
}
router.use('/api/billing',billingAuth,(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/api/billing',route(async(req,res)=>{
 const company=req.billingCompany,account=await db.billingAccount.findUnique({where:{companyId:company.id}});
 res.json({company:publicCompany(company),active:subscriptionIsActive(company),status:account?.status||'manual',cancelAt:account?.cancelAt,enabled:process.env.BILLING_PROVIDER==='paddle'&&company.market==='GLOBAL'&&company.plan==='BASIC',hasSubscription:!!account?.subscriptionId,support:publicService()});
}));
router.post('/api/billing/checkout',require('express').json({limit:'4kb'}),route(async(req,res)=>{
 const company=req.billingCompany,{cycle,email}=req.body||{};
 if(process.env.BILLING_PROVIDER!=='paddle')throw fail(503,'Contact support to renew your plan.','BILLING_DISABLED');
 if(company.market!=='GLOBAL'||company.plan!=='BASIC')throw fail(403,'Contact support for this plan.');
 if(!['MONTHLY','YEARLY'].includes(cycle)||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/\.invalid$/i.test(email))throw fail(400,'Choose a billing cycle and a real billing email.');
 const old=await db.billingAccount.findUnique({where:{companyId:company.id}});
 if(old?.subscriptionId&&!['canceled'].includes(old.status))throw fail(409,'Manage the existing subscription instead.');
 if(!old?.subscriptionId&&subscriptionIsActive(company))throw fail(409,'Your prepaid plan is still active. Contact support for early renewal.');
 const pending=await db.billingCheckout.findUnique({where:{activeKey:company.id}});
 const paddle=createPaddle();
 if(pending){
  if(!pending.transactionId)throw fail(409,'Checkout confirmation is pending. Contact support before starting another payment.');
  const transaction=await paddle('GET','/transactions/'+pending.transactionId);
  if(['draft','ready'].includes(transaction.status)&&transaction.checkout?.url){if(pending.cycle!==cycle)throw fail(409,'An existing checkout uses another billing cycle. Finish or cancel it first.');return res.json({url:transaction.checkout.url});}
  if(transaction.status!=='canceled')throw fail(409,'Payment is being confirmed. Refresh your subscription status.');
  await db.billingCheckout.update({where:{id:pending.id},data:{activeKey:null}});
 }
 const priceId=process.env[cycle==='MONTHLY'?'PADDLE_MONTHLY_PRICE_ID':'PADDLE_YEARLY_PRICE_ID'];
 const price=await paddle('GET','/prices/'+priceId);
 if(price.status!=='active'||price.unit_price?.currency_code!=='USD'||price.unit_price?.amount!==(cycle==='MONTHLY'?'1499':'14999')||price.billing_cycle?.frequency!==1||price.billing_cycle?.interval!==(cycle==='MONTHLY'?'month':'year')||price.trial_period)throw fail(503,'Billing price configuration must be reviewed.','PRICE_CONFIGURATION');
 const attempt=await db.$transaction(async tx=>{
  const current=await tx.billingAccount.findUnique({where:{companyId:company.id}});
  if(current?.subscriptionId&&!['canceled'].includes(current.status))throw fail(409,'Manage the existing subscription instead.');
  return tx.billingCheckout.create({data:{activeKey:company.id,companyId:company.id,cycle,email:email.trim().toLowerCase()}});
 },{isolationLevel:'Serializable'});
 let transaction;
 try{transaction=await paddle('POST','/transactions',{items:[{price_id:priceId,quantity:1}],collection_mode:'automatic',custom_data:{checkout_ref:attempt.id},checkout:{url:process.env.PADDLE_CHECKOUT_URL}});}catch(error){if(error.definitive)await db.billingCheckout.update({where:{id:attempt.id},data:{activeKey:null}});throw error;}
 await db.billingCheckout.update({where:{id:attempt.id},data:{transactionId:transaction.id}});
 if(!transaction.checkout?.url)throw fail(502,'Billing checkout is not available.');
 res.json({url:transaction.checkout.url});
}));
router.post('/api/billing/portal',route(async(req,res)=>{
 if(process.env.BILLING_PROVIDER!=='paddle')throw fail(503,'Contact support to manage your plan.');
 const account=await db.billingAccount.findUnique({where:{companyId:req.billingCompany.id}});
 if(!account?.customerId||!account.subscriptionId)throw fail(404,'No linked subscription was found.');
 const session=await createPaddle()('POST','/customers/'+account.customerId+'/portal-sessions',{subscription_ids:[account.subscriptionId]});
 res.json({url:session.urls?.general?.overview});
}));
module.exports={router,billingAuth,publicService};
