import {validQuantity,lineCents,fractional} from './quantities.mjs';
import {amountValue} from './money-input.mjs';
export function addSaleLine(lines,product,gift=false){
 const quantity=lines.filter(x=>x.productId===product.id).reduce((n,x)=>n+Number(x.quantity||0),0);
 const step=fractional(product.unit)?Math.min(1,Math.max(Math.round((product.stockQty-quantity)*1000)/1000,0)):1;
 if(step<=0||quantity+step>product.stockQty)throw Error('Insufficient stock.');
 const key=product.id+(gift?':gift':':sale'),existing=lines.find(x=>x.key===key);
 return existing?lines.map(x=>x.key===key?{...x,quantity:Math.round((Number(x.quantity)+step)*1000)/1000,stockQty:product.stockQty}:x):[...lines,{key,productId:product.id,name:product.name,unit:product.unit||"PIECE",quantity:step,unitPrice:gift?0:product.salePrice,stockQty:product.stockQty,isGift:gift}];
}
export function saleCartTotals(lines){
 let cents=0,quantity=0,valid=lines.length>0;const combined=new Map();
 for(const row of lines){const q=Number(row.quantity),price=amountValue(row.unitPrice);if(!validQuantity(row.quantity,row.unit)||!Number.isFinite(price)||(!row.isGift&&price<=0)||!/^\d+(?:[.,]\d{1,2})?$/.test(String(row.unitPrice)))valid=false;combined.set(row.productId,(combined.get(row.productId)||0)+q);quantity+=q;cents+=row.isGift?0:lineCents(price,q);}
 if(lines.some(row=>combined.get(row.productId)>row.stockQty))valid=false;
 return {amount:cents/100,quantity,valid};
}
