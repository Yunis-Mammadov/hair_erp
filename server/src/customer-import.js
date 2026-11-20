const F = require('./financial-core');
const W = require('./workspace-core');
const fields = ['externalId','name','phone','salon','address','lat','lng','openingDebt','openingCredit','balanceDate','currency'];
const empty = v => v == null || v === '';
function amount(v) { return F.money(empty(v) ? 0 : typeof v === 'string' ? v.trim().replace(',', '.') : v, true); }
function input(req) {
 const body=req.body;
 if(!body || !Array.isArray(body.rows) || !body.rows.length || body.rows.length>200)throw F.fail(400,'Import requires 1–200 rows.','IMPORT_ROWS');
 if(Object.keys(body).some(k=>!['rows','mode','source','requestId'].includes(k)))throw F.fail(400,'Unknown import option.');
 const mode=body.mode||'create';if(!['create','merge'].includes(mode))throw F.fail(400,'Choose create or merge import mode.');
 const source=F.text(body.source,150)||'Customer import';
 const rows=body.rows.map((row,index)=>{
  try {
   if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!fields.includes(k)))throw F.fail(400,'Unknown column. Map or explicitly ignore every column.');
   const name=F.text(row.name,150);if(!name||name.length<2)throw F.fail(400,'Customer name requires at least two characters.');
   const phone=W.phone(typeof row.phone==='string'?row.phone.replace(/^'(?=[+\d])/,''):row.phone);
   const debt=amount(row.openingDebt),credit=amount(row.openingCredit);
   if(debt&&credit)throw F.fail(400,'A customer cannot start with both debt and credit.');
   const opening=F.major(F.minor(debt)-F.minor(credit));
   const currency=F.text(row.currency,3)?.toUpperCase()||null;
   if(currency&&currency!==req.company.currency)throw F.fail(409,'Import currency does not match company currency.','CURRENCY_MISMATCH');
   let balanceDate=null;
   if(opening){
    if(!req.company.currencyConfigured)throw F.fail(409,'Confirm the operating currency in Company settings first.','CURRENCY_NOT_CONFIGURED');
    if(!currency)throw F.fail(400,'Opening balances require an explicit currency column.');
    W.calendar(row.balanceDate);if(row.balanceDate>W.localDay(new Date(),req.company.timezone))throw F.fail(400,'Opening balance date cannot be in the future.');
    balanceDate=row.balanceDate;
   }else if(!empty(row.balanceDate)){W.calendar(row.balanceDate);balanceDate=row.balanceDate;}
   const coord=(v,max)=>{if(empty(v))return null;if(!['number','string'].includes(typeof v)||!/^[-+]?\d+(?:\.\d+)?$/.test(String(v)))throw F.fail(400,'Invalid coordinate.');const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>max)throw F.fail(400,'Invalid coordinate.');return n;};
   const lat=coord(row.lat,90),lng=coord(row.lng,180);if((lat===null)!==(lng===null))throw F.fail(400,'Both coordinates are required.');
   return {externalId:F.text(row.externalId,100),name,phone,salon:F.text(row.salon,150),address:F.text(row.address,500),lat,lng,opening,balanceDate,currency};
  } catch(e){throw F.fail(e.statusCode||400,`Row ${index+2}: ${e.message}`,e.code||'IMPORT_ROW');}
 });
 return {rows,mode,source};
}
// The same planner runs for preview and commit; commit rechecks current database state.
async function plan(tx,req,data,write=false){
 const existing=await tx.customer.findMany({include:{openingBalance:true},take:50001});
 if(existing.length>50000)throw F.fail(413,'Contact support to import into workspaces with over 50,000 customers.');
 const ids=new Map(),phones=new Map(),names=new Map();
 const add=(map,key,c)=>{if(key){if(!map.has(key))map.set(key,[]);map.get(key).push(c);}};
 for(const c of existing){if(c.externalId)ids.set(c.externalId,c);let phone;try{phone=W.phone(c.phone);}catch{phone=null;}add(phones,phone,c);add(names,JSON.stringify([c.name.toLowerCase(),(c.salon||'').toLowerCase()]),c);}
 const seen=new Set(),seenExternal=new Set(),seenPhone=new Set(),seenName=new Set();const report=[];let created=0,updated=0,openingAdded=0,debt=0,credit=0;
 for(let i=0;i<data.rows.length;i++){
  const row=data.rows[i];
  try{
   const nameKey=JSON.stringify([row.name.toLowerCase(),(row.salon||'').toLowerCase()]);
   if((row.externalId&&seenExternal.has(row.externalId))||(row.phone&&seenPhone.has(row.phone))||(!row.externalId&&!row.phone&&seenName.has(nameKey)))throw F.fail(409,'Duplicate customer in this file.');
   if(row.externalId)seenExternal.add(row.externalId);if(row.phone)seenPhone.add(row.phone);seenName.add(nameKey);
   const byId=row.externalId?ids.get(row.externalId):null,byPhone=row.phone?phones.get(row.phone)||[]:[];
   if(byPhone.length>1)throw F.fail(409,'Several existing customers use this phone. Resolve the duplicate contacts before importing.');
   if(byId&&byPhone[0]&&byId.id!==byPhone[0].id)throw F.fail(409,'External ID and phone identify different customers.');
   let customer=byId||byPhone[0];
   if(!customer&&!row.externalId&&!row.phone){const matches=names.get(nameKey)||[];if(matches.length>1)throw F.fail(409,'Ambiguous customer name. Supply an external ID or phone.');customer=matches[0];}
   if(customer&&data.mode==='create')throw F.fail(409,'Customer already exists. Choose merge mode to update matching contacts.');
   if(customer&&row.externalId&&customer.externalId&&row.externalId!==customer.externalId)throw F.fail(409,'Existing customer has another external ID.');
   if(customer&&seen.has(customer.id))throw F.fail(409,'Several file rows identify the same customer.');if(customer)seen.add(customer.id);
   let addOpening=!!row.opening;
   if(customer?.openingBalance&&row.opening){const old=customer.openingBalance;if(F.minor(old.amount)!==F.minor(row.opening)||W.localDay(old.balanceDate,req.company.timezone)!==row.balanceDate||old.currency!==row.currency)throw F.fail(409,'Existing opening balance differs. Imports cannot overwrite financial history.');addOpening=false;}
   if(addOpening&&customer){
    for(const model of ['order','return','payment','customerRefund']){const earliest=await tx[model].findFirst({where:{customerId:customer.id},orderBy:{createdAt:'asc'},select:{createdAt:true}});if(earliest&&W.zonedDay(row.balanceDate,req.company.timezone)>earliest.createdAt)throw F.fail(409,'Opening date must precede existing customer transactions.');}
   }
   const contact={name:row.name,phone:row.phone,salon:row.salon,address:row.address,lat:row.lat,lng:row.lng,...(row.externalId?{externalId:row.externalId}:{})};
   if(write){customer=customer?await tx.customer.update({where:{id:customer.id},data:contact}):await tx.customer.create({data:contact});if(addOpening)await tx.customerOpeningBalance.create({data:{customerId:customer.id,amount:row.opening,balanceDate:W.zonedDay(row.balanceDate,req.company.timezone),currency:row.currency,source:data.source,recordedById:req.user.id}});}
   const action=byId||byPhone[0]||(customer&&existing.some(c=>c.id===customer.id))?'update':'create';
   if(action==='create')created++;else updated++;
   if(addOpening){openingAdded++;if(row.opening>0)debt+=F.minor(row.opening);else credit-=F.minor(row.opening);}
   report.push({row:i+2,name:row.name,action,openingAdded:addOpening,openingDebt:Math.max(row.opening,0),openingCredit:Math.max(-row.opening,0)});
  }catch(e){throw F.fail(e.statusCode||400,`Row ${i+2}: ${e.message}`,e.code||'IMPORT_ROW');}
 }
 return {imported:data.rows.length,created,updated,openingAdded,debt:F.major(debt),credit:F.major(credit),currency:req.company.currency,rows:report};
}
module.exports={input,plan};
