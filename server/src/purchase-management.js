const F=require('./financial-core'),Q=require('./quantity'),W=require('./workspace-core'),R=require('./records-core'),A=require('./audit');
const include={items:{include:{product:{include:{category:true}}}},createdBy:{select:R.personSelect},voidedBy:{select:R.personSelect}};
function revisionInput(req,voiding=false){
 const b=req.body;
 const allowed=voiding?['expectedVersion','reason','requestId']:['expectedVersion','reason','supplier','invoiceNo','note','purchaseDate','items','requestId'];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k)))throw F.fail(400,'Check the purchase changes.');
 const reason=F.text(b.reason,300);if(!reason||reason.length<3)throw F.fail(400,'Enter a reason with at least three characters.');
 const input={expectedVersion:F.integer(b.expectedVersion,0,1000000000),reason};
 if(voiding)return input;
 const supplier=F.text(b.supplier,150);if(!supplier)throw F.fail(400,'Supplier is required.');
 W.calendar(b.purchaseDate);if(b.purchaseDate>W.localDay(new Date(),req.company.timezone))throw F.fail(400,'Purchase date cannot be in the future.');
 const seen=new Set();const items=F.lines(b.items).map(i=>{const productId=F.id(i.productId);if(seen.has(productId))throw F.fail(400,'Combine duplicate products into one line.');seen.add(productId);if(Object.keys(i).some(k=>!['productId','quantity','unitCost'].includes(k)))throw F.fail(400,'Check the purchase line.');return {productId,quantity:Q.quantity(i.quantity),unitCost:F.money(i.unitCost,true)};});
 return {...input,supplier,purchaseDate:b.purchaseDate,invoiceNo:F.text(b.invoiceNo,100),note:F.text(b.note),items};
}
async function manage(tx,req,input,voiding=false){
 const id=F.id(req.params.id),before=await tx.purchase.findUnique({where:{id},include});
 if(!before)throw F.fail(404,'Purchase not found.');
 if(before.voidedAt)throw F.fail(409,'This purchase has already been voided.','PURCHASE_VOIDED');
 if(before.version!==input.expectedVersion)throw F.fail(409,'This purchase changed. Reload it before saving.','STALE_RECORD');
 // Customer and document mutations use the same per-workspace transaction lock.
 const old=new Map(before.items.map(i=>[i.productId,Number(i.quantity)])),next=voiding?[]:input.items;
 const costed=[];
 for(const row of next){const product=await tx.product.findUnique({where:{id:row.productId}});if(!product)throw F.fail(404,'Product not found.');Q.quantity(row.quantity,product.unit);if(product.archivedAt&&(!old.has(product.id)||row.quantity>old.get(product.id)))throw F.fail(409,'An archived product cannot receive more stock.');const lineTotalAmount=F.money(F.major(Q.lineCents(F.minor(row.unitCost),row.quantity)),true);costed.push({...row,lineTotalAmount});}
 const desired=new Map(next.map(i=>[i.productId,i.quantity]));
 for(const productId of [...new Set([...old.keys(),...desired.keys()])].sort()){
  const delta=Q.sub(desired.get(productId)||0,old.get(productId)||0);
  if(delta)await F.moveStock(tx,productId,delta,{user:req.user,kind:voiding?'PURCHASE_VOID':'PURCHASE_CORRECTION',reason:input.reason,documentId:id});
 }
 if(voiding){await tx.purchase.update({where:{id},data:{version:{increment:1},voidedAt:new Date(),voidReason:input.reason,voidedById:req.user.id}});}
 else {
  await tx.purchaseItem.deleteMany({where:{purchaseId:id}});
  await tx.purchaseItem.createMany({data:costed.map(row=>({...row,purchaseId:id}))});
  await tx.purchase.update({where:{id},data:{supplier:input.supplier,invoiceNo:input.invoiceNo,note:input.note,purchaseDate:W.calendar(input.purchaseDate),totalAmount:F.money(F.major(costed.reduce((n,i)=>n+F.minor(i.lineTotalAmount),0)),true),version:{increment:1}}});
 }
 const purchase=await tx.purchase.findUnique({where:{id},include});
 await A.record(tx,req,{entityType:'Purchase',entityId:id,action:voiding?'PURCHASE_VOIDED':'PURCHASE_EDITED',reason:input.reason,before,after:purchase});
 return {purchase};
}
module.exports=function(router){
 const {requireAuth,requireRole}=require('./middleware/auth.middleware');
 router.get('/:id/audit',requireAuth,requireRole('ADMIN','WAREHOUSE'),R.route(async(req,res)=>{const id=F.id(req.params.id);if(!await require('./prismaClient').prisma.purchase.findUnique({where:{id},select:{id:true}}))throw F.fail(404,'Purchase not found.');const p=R.page(req.query),db=require('./prismaClient').prisma;const where={entityType:'Purchase',entityId:id};const [events,total]=await Promise.all([db.auditEvent.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:p.skip,take:p.take}),db.auditEvent.count({where})]);res.json({events,pagination:R.pagination(p,total)});}));
 router.patch('/:id',requireAuth,requireRole('ADMIN'),R.route(async(req,res)=>{const input=revisionInput(req);res.json(await F.mutate(req,'purchase-edit:'+F.id(req.params.id),input,tx=>manage(tx,req,input)));}));
 router.post('/:id/void',requireAuth,requireRole('ADMIN'),R.route(async(req,res)=>{const input=revisionInput(req,true);res.json(await F.mutate(req,'purchase-void:'+F.id(req.params.id),input,tx=>manage(tx,req,input,true)));}));
};
module.exports.include=include;
