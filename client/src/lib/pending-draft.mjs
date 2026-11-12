export function draftKey(user,kind,record=''){return `z-index-operation:${user?.company?.id}:${user?.id}:${kind}:${record}`;}
export function readDraft(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
export function writeDraft(key,data){try{sessionStorage.setItem(key,JSON.stringify(data));}catch{/* Retry protection still works in memory if browser storage is disabled. */}}
export function clearDraft(key){try{sessionStorage.removeItem(key);}catch{/* Storage is optional. */}}
export function clearRejectedDraft(key,status){if([400,404,405,413,415,422].includes(status))clearDraft(key);}

// Reuse the exact sent sale when only a refreshed server balance has changed.
export function restoredSaleBody(pending,form){
 if(!pending?.body||form.file)return null;
 const shape=x=>({mode:x.mode,customerId:x.customer?.id||null,newCustomer:x.newCustomer,lines:x.lines,paymentMode:x.paymentMode,amount:x.amount,method:x.method,note:x.note});
 return JSON.stringify(shape(pending))===JSON.stringify(shape(form))?pending.body:null;
}
export function sameDraftBody(a,b){
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 return !!a&&JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
