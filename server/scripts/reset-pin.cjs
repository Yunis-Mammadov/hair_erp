require('dotenv').config({quiet:true});
const bcrypt=require('bcrypt');
const {platformPrisma:db}=require('../src/prismaClient');
(async()=>{try{
 const companyId=process.env.RESET_COMPANY_ID,userId=process.env.RESET_USER_ID,pin=process.env.RESET_PIN;
 if(process.argv.includes('--list')){if(!companyId)throw Error('Set RESET_COMPANY_ID first.');console.table(await db.user.findMany({where:{companyId},select:{id:true,fullName:true,role:true,isActive:true}}));return;}
 if(!companyId||!userId||!/^\d{4,8}$/.test(pin||''))throw Error('Set RESET_COMPANY_ID, RESET_USER_ID and a 4–8 digit RESET_PIN.');
 const hash=await bcrypt.hash(pin,12);
 await db.$transaction(async tx=>{
  const target=await tx.user.findFirst({where:{id:userId,companyId}});if(!target)throw Error('User not found in the specified company.');
  const users=await tx.user.findMany({where:{companyId},select:{id:true,pinHash:true}});
  for(const user of users)if(user.id!==userId&&user.pinHash&&await bcrypt.compare(pin,user.pinHash))throw Error('This PIN belongs to another user in this company.');
  await tx.user.update({where:{id:userId},data:{pinHash:hash,authVersion:{increment:1}}});
 },{isolationLevel:'Serializable',timeout:20000});
 console.log('PIN reset. Existing sessions for this user have been revoked.');
}finally{await db.$disconnect();}})().catch(error=>{console.error(error.name?.startsWith('Prisma')?'Database operation failed. No PIN was printed.':error.message);process.exitCode=1;});
