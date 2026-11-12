require('dotenv').config({quiet:true});
const {platformPrisma:db}=require('../src/prismaClient');
(async()=>{try{
 const [command,id,transactionId]=process.argv.slice(2);
 if(command==='link-checkout'){const {createPaddle,linkCheckout}=require('../src/ops/billing');await linkCheckout(db,createPaddle(),id,transactionId);console.log('Provider transaction verified and linked. Matching stored events were queued.');}
 else if(command==='retry'&&/^evt_[a-z0-9]+$/.test(id||'')){await db.billingEvent.updateMany({where:{id,state:'pending'},data:{attempts:0,lastError:null}});console.log('Stored event queued for retry.');}
 else if(command==='status'){console.table(await db.billingEvent.findMany({where:{state:'pending'},select:{id:true,type:true,attempts:true,lastError:true,createdAt:true},take:100,orderBy:{createdAt:'asc'}}));console.table(await db.billingCheckout.findMany({where:{activeKey:{not:null}},select:{id:true,companyId:true,cycle:true,transactionId:true,createdAt:true},take:100,orderBy:{createdAt:'asc'}}));}
 else throw Error('Use status or retry evt_...');
}finally{await db.$disconnect();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
