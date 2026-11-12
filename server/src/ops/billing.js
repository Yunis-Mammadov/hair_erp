const {createHmac,timingSafeEqual}=require('node:crypto');
const {log}=require('./runtime');
const fail=(status,message,code='BILLING_ERROR')=>Object.assign(new Error(message),{status,code});
const supported=new Set(['subscription.created','subscription.activated','subscription.updated','subscription.resumed','subscription.past_due','subscription.paused','subscription.canceled']);
function verifySignature(bytes,header,secret,now=Date.now()){
 if(!secret||!Buffer.isBuffer(bytes)||typeof header!=='string')return false;
 const parts=header.split(';').map(x=>x.trim().split('=')),timestamps=parts.filter(x=>x[0]==='ts');
 if(timestamps.length!==1||!/^\d{10,12}$/.test(timestamps[0][1]||''))return false;
 const ts=timestamps[0][1];if(Math.abs(now/1000-Number(ts))>5)return false;
 const expected=createHmac('sha256',secret).update(ts+':').update(bytes).digest();
 return parts.some(([key,value])=>key==='h1'&&/^[a-f0-9]{64}$/i.test(value||'')&&timingSafeEqual(expected,Buffer.from(value,'hex')));
}
function priceCycle(data,env=process.env){
 const items=data.items||[];if(items.length!==1||items[0].quantity!==1)throw fail(400,'Unexpected subscription items.','UNSUPPORTED_PRICE');
 const id=items[0].price?.id;
 if(id===env.PADDLE_MONTHLY_PRICE_ID)return 'MONTHLY';if(id===env.PADDLE_YEARLY_PRICE_ID)return 'YEARLY';
 throw fail(400,'Unexpected subscription price.','UNSUPPORTED_PRICE');
}
function createPaddle(env=process.env,transport=fetch){
 return async(method,endpoint,body)=>{
  if(!['sandbox','live'].includes(env.PADDLE_ENVIRONMENT))throw fail(503,'Billing is not configured.','BILLING_DISABLED');
  const base=env.PADDLE_ENVIRONMENT==='sandbox'?'https://sandbox-api.paddle.com':'https://api.paddle.com';
  let response;
  try{response=await transport(base+endpoint,{method,headers:{Authorization:'Bearer '+env.PADDLE_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});}catch{throw fail(502,'Billing provider could not be reached.');}
  if(!response.ok)throw Object.assign(fail(502,'Billing provider rejected the request.'),{definitive:[400,401,403,404,422].includes(response.status)});
  return (await response.json()).data;
 };
}
async function applyEvent(tx,event,env=process.env){
 if(!supported.has(event.event_type))return 'ignored';
 const data=event.data,sub=data?.id;if(!/^sub_[a-z0-9]+$/.test(sub||''))throw fail(400,'Invalid subscription.');
 let account=await tx.billingAccount.findUnique({where:{subscriptionId:sub}}),checkout;
 if(!account){
  const ref=data.custom_data?.checkout_ref;
  if(typeof ref!=='string')return 'ignored';
  checkout=await tx.billingCheckout.findUnique({where:{id:ref}});
  if(!checkout||!checkout.transactionId||checkout.transactionId!==data.transaction_id)return 'ignored';
  const previous=await tx.billingAccount.findUnique({where:{companyId:checkout.companyId}});
  if(previous?.subscriptionId&&previous.subscriptionId!==sub&&!['canceled'].includes(previous.status))throw fail(409,'Another subscription is already linked.','SUBSCRIPTION_CONFLICT');
  await tx.billingCheckout.update({where:{id:checkout.id},data:{activeKey:null}});
  account=await tx.billingAccount.upsert({where:{companyId:checkout.companyId},create:{companyId:checkout.companyId,subscriptionId:sub,customerId:data.customer_id,billingEmail:checkout.email},update:{subscriptionId:sub,customerId:data.customer_id,billingEmail:checkout.email,lastEventAt:null}});
 }
 const occurred=new Date(event.occurred_at);if(account.lastEventAt&&occurred<=account.lastEventAt)return 'ignored';
 if(account.customerId!==data.customer_id)throw fail(409,'Subscription customer mismatch.','SUBSCRIPTION_CONFLICT');
 const company=await tx.company.findUniqueOrThrow({where:{id:account.companyId}});
 if(company.market!=='GLOBAL'||company.plan!=='BASIC')throw fail(409,'Subscription does not match this plan.','UNSUPPORTED_PLAN');
 const status=data.status;
 if(!['active','past_due','paused','canceled','trialing'].includes(status))throw fail(400,'Invalid subscription status.');
 const update={status,lastEventAt:occurred,cancelAt:data.scheduled_change?.action==='cancel'?new Date(data.scheduled_change.effective_at):null};
 if(status==='active'){
  const cycle=priceCycle(data,env),end=new Date(data.current_billing_period?.ends_at),start=new Date(data.current_billing_period?.starts_at);
  if(!Number.isFinite(+end)||!Number.isFinite(+start)||end<=start)throw fail(400,'Missing billing period.');
  await tx.company.update({where:{id:company.id},data:{billingCycle:cycle,startsAt:company.startsAt>start?start:company.startsAt,endsAt:end}});
 }else if(status==='paused'||status==='canceled'){
  await tx.company.update({where:{id:company.id},data:{endsAt:company.endsAt&&company.endsAt<occurred?company.endsAt:occurred}});
 }
 // A failed payment/trial never grants a new paid billing period.
 await tx.billingAccount.update({where:{companyId:account.companyId},data:update});return 'processed';
}
async function processEvents(db,env=process.env){
 const events=await db.billingEvent.findMany({where:{state:'pending',attempts:{lt:10}},orderBy:{createdAt:'asc'},take:20});
 for(const event of events){
  try{await db.$transaction(async tx=>{
   const current=await tx.billingEvent.findUniqueOrThrow({where:{id:event.id}});if(current.state!=='pending')return;
   const state=await applyEvent(tx,current.payload,env);
   await tx.billingEvent.update({where:{id:event.id},data:{state,processedAt:new Date(),lastError:null}});
  },{isolationLevel:'Serializable',timeout:10000});}
  catch(error){if(['P2034','P2002'].includes(error.code))continue;await db.billingEvent.updateMany({where:{id:event.id,state:'pending'},data:{attempts:{increment:1},lastError:error.code||'PROCESSING_ERROR'}});log('billing_processing_failed',{eventId:event.id,code:error.code||'PROCESSING_ERROR'});}
 }
}
async function linkCheckout(db,paddle,checkoutId,transactionId){
 const checkout=await db.billingCheckout.findUniqueOrThrow({where:{id:checkoutId}});
 if(checkout.transactionId&&checkout.transactionId!==transactionId)throw fail(409,'Checkout already has another transaction.');
 if(!/^txn_[a-z0-9]+$/.test(transactionId||''))throw fail(400,'Invalid transaction ID.');
 const transaction=await paddle('GET','/transactions/'+transactionId);
 if(transaction.custom_data?.checkout_ref!==checkout.id)throw fail(409,'Provider transaction does not match checkout.');
 return db.$transaction(async tx=>{await tx.billingCheckout.update({where:{id:checkout.id},data:{transactionId}});await tx.billingEvent.updateMany({where:{state:'ignored',payload:{path:['data','custom_data','checkout_ref'],equals:checkout.id}},data:{state:'pending',attempts:0,processedAt:null}});});
}
function startWorker(db){let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{await processEvents(db);}catch{log('billing_worker_failed',{code:'WORKER_ERROR'});}finally{busy=false;}},2000);timer.unref();return ()=>clearInterval(timer);}
module.exports={verifySignature,priceCycle,createPaddle,applyEvent,processEvents,startWorker,fail,supported,linkCheckout};
