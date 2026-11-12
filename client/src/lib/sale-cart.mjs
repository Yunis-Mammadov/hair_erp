import {amountValue} from './money-input.mjs';
export function addSaleLine(lines,product,gift=false){
 const quantity=lines.filter(x=>x.productId===product.id).reduce((n,x)=>n+Number(x.quantity||0),0);
 if(quantity>=product.stockQty)throw Error('Insufficient stock.');
 const key=product.id+(gift?':gift':':sale'),existing=lines.find(x=>x.key===key);
 return existing?lines.map(x=>x.key===key?{...x,quantity:Number(x.quantity)+1,stockQty:product.stockQty}:x):[...lines,{key,productId:product.id,name:product.name,quantity:1,unitPrice:gift?0:product.salePrice,stockQty:product.stockQty,isGift:gift}];
}
export function saleCartTotals(lines){
 let cents=0,quantity=0,valid=lines.length>0;const combined=new Map();
 for(const row of lines){const q=Number(row.quantity),price=amountValue(row.unitPrice);if(!/^\d+$/.test(String(row.quantity))||!Number.isSafeInteger(q)||q<1||!Number.isFinite(price)||(!row.isGift&&price<=0)||!/^\d+(?:[.,]\d{1,2})?$/.test(String(row.unitPrice)))valid=false;combined.set(row.productId,(combined.get(row.productId)||0)+q);quantity+=q;cents+=row.isGift?0:Math.round(price*100)*q;}
 if(lines.some(row=>combined.get(row.productId)>row.stockQty))valid=false;
 return {amount:cents/100,quantity,valid};
}
