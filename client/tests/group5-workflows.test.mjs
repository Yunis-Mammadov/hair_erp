import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addSaleLine,saleCartTotals} from '../src/lib/sale-cart.mjs';
import {invoiceLines,invoiceTotal} from '../src/lib/invoice.mjs';
import {draftKey,writeDraft,readDraft,clearDraft} from '../src/lib/pending-draft.mjs';
import {prepareFinancialRequest,finishFinancialRequest} from '../src/lib/financial-retries.js';
const product={id:'p',name:'Product',stockQty:3,salePrice:12.5};
test('normal and gift quantities share the same stock cap',()=>{let lines=addSaleLine([],product);lines=addSaleLine(lines,product,true);lines=addSaleLine(lines,product);assert.equal(saleCartTotals(lines).amount,25);assert.equal(saleCartTotals(lines).quantity,3);assert.throws(()=>addSaleLine(lines,product,true));});
test('cart rejects fractions, malformed money and combined stock excess without truncation',()=>{const rows=addSaleLine([],product);for(const change of [{quantity:'1.5'},{quantity:'1abc'},{unitPrice:'12,345'},{unitPrice:'0'},{quantity:4}])assert.equal(saleCartTotals([{...rows[0],...change}]).valid,false);assert.equal(saleCartTotals([{...rows[0],unitPrice:'12,50'}]).valid,true);});
test('invoice prints gifts at zero and preserves saved product snapshots and document total',()=>{const order={totalAmount:'25.00',items:[{id:'a',productName:'Original name',product:{name:'Edited name'},quantity:2,unitPrice:'12.50'},{id:'b',productName:'Gift',quantity:3,unitPrice:'99.00',isGift:true}]};const rows=invoiceLines(order);assert.equal(rows[0].name,'Original name');assert.equal(rows[1].unitPrice,0);assert.equal(rows[1].total,0);assert.equal(invoiceTotal(order),25);assert.equal(invoiceTotal({...order,totalAmount:undefined}),25);});
test('a long invoice includes every item rather than slicing to a single page',()=>{const order={items:Array.from({length:75},(_,i)=>({id:String(i),productName:'Item '+i,quantity:1,unitPrice:'0.10'}))};assert.equal(invoiceLines(order).length,75);assert.equal(invoiceTotal(order),7.5);});
test('payment void and credit refund retain uncertain request keys',async()=>{for(const url of ['/payments/refunds','/payments/example-id/void']){const body=url.endsWith('void')?{reason:'Wrong entry'}:{customerId:'c',amount:5,method:'CASH',note:'Credit refund'};const a=await prepareFinancialRequest({url,method:'post',headers:{},data:body},'token');finishFinancialRequest(a,500);const b=await prepareFinancialRequest({url,method:'post',headers:{},data:body},'token');assert.equal(a.headers['Idempotency-Key'],b.headers['Idempotency-Key']);finishFinancialRequest(b,201);}});
test('a restored receipt draft reuses the payment key and remains scoped to its original user and company',async()=>{const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const user={id:'worker',company:{id:'company'}},key=draftKey(user,'payment','c');const body={customerId:'c',amount:5,date:'2026-11-11',imageUrl:'/uploads/company/payment-original.webp'};writeDraft(key,body);const a=await prepareFinancialRequest({url:'/payments',method:'post',headers:{},data:body},'token');finishFinancialRequest(a,500);const restored=readDraft(key);assert.equal(restored.imageUrl,body.imageUrl);assert.equal(readDraft(draftKey({id:'another',company:{id:'company'}},'payment','c')),null);assert.equal(readDraft(draftKey({id:'worker',company:{id:'other'}},'payment','c')),null);const b=await prepareFinancialRequest({url:'/payments',method:'post',headers:{},data:restored},'token');assert.equal(a.headers['Idempotency-Key'],b.headers['Idempotency-Key']);clearDraft(key);assert.equal(readDraft(key),null);});

test('a lost sale response retains the sent initial payment after refreshed credit is consumed',async()=>{
 const {restoredSaleBody,sameDraftBody}=await import('../src/lib/pending-draft.mjs');
 const body={customerId:'credit-buyer',items:[{productId:'p',quantity:1,unitPrice:20}],initialPayment:{amount:15,method:'CASH'}};
 const pending={body,mode:'existing',customer:{id:'credit-buyer'},newCustomer:{name:''},credit:5,lines:[{key:'p:sale',productId:'p',quantity:1,unitPrice:20,stockQty:3}],paymentMode:'full',amount:'',method:'CASH',note:''};
 const current={...pending,credit:0,file:null};
 const replay=restoredSaleBody(pending,current);assert.equal(replay.initialPayment.amount,15);
 const first=await prepareFinancialRequest({url:'/orders',method:'post',headers:{},data:body},'credit-session');finishFinancialRequest(first,500);
 const again=await prepareFinancialRequest({url:'/orders',method:'post',headers:{},data:replay},'credit-session');assert.equal(again.headers['Idempotency-Key'],first.headers['Idempotency-Key']);
 assert.equal(restoredSaleBody(pending,{...current,note:'A separate sale'}),null);
 assert.equal(sameDraftBody({amount:15,customerId:'credit-buyer'},{customerId:'credit-buyer',amount:15}),true);
 assert.equal(sameDraftBody({amount:15},{amount:20}),false);
});
