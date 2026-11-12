export function invoiceLines(order) {
 return (order?.items||[]).map(item=>{const price=item.isGift?0:Number(item.unitPrice||0),quantity=Number(item.quantity||0);return {id:item.id||item.productId,name:item.productName??item.product?.name??'—',sku:item.productSku??item.product?.sku??'',quantity,unitPrice:price,total:Math.round(price*100)*quantity/100,gift:!!item.isGift};});
}
export function invoiceTotal(order){const amount=Number(order?.totalAmount);return order?.totalAmount!=null&&Number.isFinite(amount)?amount:invoiceLines(order).reduce((sum,row)=>sum+Math.round(row.total*100),0)/100;}
