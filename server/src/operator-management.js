const bcrypt=require('bcrypt'),{createHmac}=require('node:crypto');
const {platformPrisma:db}=require('./prismaClient'),F=require('./financial-core'),W=require('./workspace-core'),A=require('./audit'),R=require('./records-core');
const companySelect={trialStartedAt:true,trialEndsAt:true,trialConvertedAt:true,id:true,name:true,loginEmail:true,currency:true,timezone:true,plan:true,market:true,billingCycle:true,isActive:true,operatorSuspended:true,startsAt:true,endsAt:true,authVersion:true,createdAt:true};
function publicRecord(c){return {...c,endsOn:c.endsAt?W.localDay(new Date(+c.endsAt-1),c.timezone):''};}
function read(req,kind){
 const b=req.body;const allowed={password:['password'],subscription:['endsOn','billingCycle'],status:['isActive']}[kind];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>![...allowed,'reason','expectedAuthVersion'].includes(k)))throw F.fail(400,'Check the operator action.');
 const reason=F.text(b.reason,300);if(!reason||reason.length<3)throw F.fail(400,'Enter a reason with at least three characters.');
 const value={reason,expectedAuthVersion:F.integer(b.expectedAuthVersion,0,1000000000)};
 if(kind==='password'){if(typeof b.password!=='string'||b.password.length<12||Buffer.byteLength(b.password)>72)throw F.fail(400,'Company password must contain at least 12 characters and no more than 72 bytes.');value.password=b.password;}
 if(kind==='subscription'){W.calendar(b.endsOn);if(!['MONTHLY','YEARLY'].includes(b.billingCycle))throw F.fail(400,'Choose monthly or yearly billing.');value.endsOn=b.endsOn;value.billingCycle=b.billingCycle;}
 if(kind==='status'){if(typeof b.isActive!=='boolean')throw F.fail(400,'Choose active or inactive.');value.isActive=b.isActive;}
 return value;
}
async function mutate(req,kind,input){
 const companyId=F.id(req.params.id),scope='operator:'+kind,key=req.get('Idempotency-Key');
 if(typeof key!=='string'||!/^[a-zA-Z0-9._:-]{8,120}$/.test(key))throw F.fail(400,'Idempotency-Key is required.','REQUEST_KEY_REQUIRED');
 const hash=createHmac('sha256',process.env.PLATFORM_OWNER_SECRET).update(JSON.stringify({companyId,kind,input})).digest('hex');
 const passwordHash=kind==='password'?await bcrypt.hash(input.password,12):null;
 for(let attempt=0;;attempt++)try{
  return await db.$transaction(async tx=>{
   const prior=await tx.operationRequest.findUnique({where:{companyId_scope_key:{companyId,scope,key}}});
   if(prior){if(prior.hash!==hash)throw F.fail(409,'This operation key was used for another action.');return {...prior.response,replayed:true};}
   const before=await tx.company.findUnique({where:{id:companyId},select:companySelect});if(!before)throw F.fail(404,'Company not found.');
   if(before.authVersion!==input.expectedAuthVersion)throw F.fail(409,'The company changed. Refresh the company list before continuing.','STALE_RECORD');
   let changes={authVersion:{increment:1}};
   if(kind==='password')changes.passwordHash=passwordHash;
   if(kind==='subscription'){
    const linked=await tx.billingAccount.findUnique({where:{companyId}});if(linked?.subscriptionId&&!['canceled','manual'].includes(linked.status))throw F.fail(409,'Manage a provider subscription through its billing portal.');
    const endsAt=W.zonedDay(input.endsOn,before.timezone,true);if(endsAt<=new Date()||endsAt<=before.startsAt)throw F.fail(400,'Choose a future subscription end date after its start date.');
    changes={...changes,endsAt,billingCycle:input.billingCycle,...(before.trialStartedAt&&!before.trialConvertedAt?{trialConvertedAt:new Date()}: {})};
   }
   if(kind==='status'){
    if(input.isActive&&(!before.endsAt||before.endsAt<=new Date()))throw F.fail(409,'Extend the expired subscription before activating this company.');
    changes={...changes,isActive:input.isActive,operatorSuspended:!input.isActive};
   }
   const after=await tx.company.update({where:{id:companyId},data:changes,select:companySelect});
   await tx.auditEvent.create({data:{companyId,entityType:'Company',entityId:companyId,actorName:'Platform operator',action:'COMPANY_'+kind.toUpperCase(),reason:input.reason,before:A.snapshot(before),after:A.snapshot(after)}});
   const response={company:publicRecord(after),replayed:false};
   await tx.operationRequest.create({data:{companyId,scope,key,hash,response:A.snapshot(response)}});
   return response;
  },{isolationLevel:'Serializable',timeout:20000});
 }catch(e){if(attempt<4&&['P2034','P2002'].includes(e.code))continue;throw e;}
}
module.exports=router=>{
 router.get('/companies/:id/audit',R.route(async(req,res)=>{const id=F.id(req.params.id);if(!await db.company.findUnique({where:{id},select:{id:true}}))throw F.fail(404,'Company not found.');const p=R.page(req.query),where={companyId:id,entityType:'Company',entityId:id};const [events,total]=await Promise.all([db.auditEvent.findMany({where,skip:p.skip,take:p.take,orderBy:[{createdAt:'desc'},{id:'desc'}]}),db.auditEvent.count({where})]);res.json({events,pagination:R.pagination(p,total)});}));
 for(const [kind,method]of [['password','post'],['subscription','patch'],['status','patch']])router[method]('/companies/:id/'+kind,R.route(async(req,res)=>res.json(await mutate(req,kind,read(req,kind)))));
};
module.exports.companySelect=companySelect;module.exports.publicRecord=publicRecord;
