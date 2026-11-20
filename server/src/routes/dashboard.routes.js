const express=require('express'),F=require('../financial-core'),Q=require('../quantity'),W=require('../workspace-core'),R=require('../records-core');
const {prisma}=require('../prismaClient'),{requireAuth,requireRole}=require('../middleware/auth.middleware');
const router=express.Router();
function monthRange(zone,offset=0){const d=W.calendar(W.localDay(new Date(),zone)),y=d.getUTCFullYear(),m=d.getUTCMonth();return {gte:W.zonedDay(new Date(Date.UTC(y,m+offset,1)).toISOString().slice(0,10),zone),lt:W.zonedDay(new Date(Date.UTC(y,m+offset+1,1)).toISOString().slice(0,10),zone)};}
const change=(a,b)=>b===0?(a>0?100:a<0?-100:0):Math.round((a-b)/Math.abs(b)*1000)/10;
async function period(tx,createdAt){
 const [sales,returns,items,returned]=await Promise.all([
  tx.order.aggregate({where:{createdAt},_sum:{totalAmount:true},_count:true}),
  tx.return.aggregate({where:{createdAt},_sum:{totalAmount:true}}),
  tx.orderItem.aggregate({where:{order:{createdAt},isGift:false},_sum:{quantity:true}}),
  tx.returnItem.aggregate({where:{returnDoc:{createdAt}},_sum:{quantity:true}})
 ]);
 const gross=F.minor(sales._sum.totalAmount),returnedMoney=F.minor(returns._sum.totalAmount);
 return {gross,returns:returnedMoney,net:gross-returnedMoney,count:sales._count,items:Q.sub(items._sum.quantity||0,returned._sum.quantity||0)};
}
router.get('/stats',requireAuth,requireRole('ADMIN'),R.route(async(req,res)=>{
 const data=await prisma.$transaction(async tx=>{
  const [products,customers,current,previous,recentOrders]=await Promise.all([
   tx.product.count({where:{archivedAt:null}}),tx.customer.count(),period(tx,monthRange(req.company.timezone)),period(tx,monthRange(req.company.timezone,-1)),
   tx.order.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],take:8,include:{customer:true,items:{include:{product:true}}}})
  ]);
  return {products:{value:products},customers:{value:customers},orders:{value:current.count,change:change(current.count,previous.count)},itemsSold:{value:current.items,change:change(current.items,previous.items)},revenue:{value:F.major(current.net),gross:F.major(current.gross),returns:F.major(current.returns),change:change(current.net,previous.net)},averageOrderValue:{value:current.count?F.major(Math.round(current.net/current.count)):0},recentOrders,company:{id:req.company.id,name:req.company.name,logoUrl:req.company.logoUrl},basis:'SALES_MINUS_RETURNS_RECORDED_IN_MONTH'};
 },{isolationLevel:'RepeatableRead'});
 res.json(data);
}));
module.exports=router;
