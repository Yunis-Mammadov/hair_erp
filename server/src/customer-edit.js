const F=require('./financial-core'),W=require('./workspace-core'),R=require('./records-core'),A=require('./audit');
module.exports=router=>{
 const {requireRole}=require('./middleware/auth.middleware');
 router.patch('/:id/contact',requireRole('ADMIN','EXPEDITOR'),R.route(async(req,res)=>{
  const b=req.body||{},allowed=['name','phone','salon','address','lat','lng','areaId','expectedUpdatedAt','requestId'];
  if(Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k)))throw F.fail(400,'Check the customer details.');
  if(typeof b.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(b.expectedUpdatedAt)))throw F.fail(400,'Reload the customer before editing.');
  const input={...W.customerData(b),expectedUpdatedAt:new Date(b.expectedUpdatedAt).toISOString()};
  const result=await F.mutate(req,'customer-contact:'+F.id(req.params.id),input,async tx=>{
   const before=await R.allowedCustomer(tx,req,F.id(req.params.id));
   if(before.updatedAt.toISOString()!==input.expectedUpdatedAt)throw F.fail(409,'This customer changed. Reload the customer before saving.','STALE_RECORD');
   if(input.areaId!==before.areaId)await W.checkArea(tx,input.areaId);
   const {expectedUpdatedAt,...data}=input;
   const updated=await tx.customer.updateMany({where:{id:before.id,updatedAt:new Date(expectedUpdatedAt)},data});
   if(updated.count!==1)throw F.fail(409,'This customer changed. Reload the customer before saving.','STALE_RECORD');
   const customer=await R.allowedCustomer(tx,req,before.id);
   await A.record(tx,req,{entityType:'Customer',entityId:before.id,action:'CUSTOMER_EDITED',reason:'Contact details updated',before:Object.fromEntries(["name","phone","salon","address","lat","lng","areaId"].map(k=>[k,before[k]??null])),after:data});
   return {customer};
  });res.json(result);
 }));
};
