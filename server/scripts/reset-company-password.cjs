require('dotenv').config({quiet:true});
const bcrypt=require('bcrypt');
const {platformPrisma:db}=require('../src/prismaClient');
(async()=>{try{
 const id=process.env.RESET_COMPANY_ID,password=process.env.RESET_COMPANY_PASSWORD;
 if(!id||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72)throw Error('Set RESET_COMPANY_ID and RESET_COMPANY_PASSWORD (12 characters minimum, 72 bytes maximum).');
 const hash=await bcrypt.hash(password,12);
 await db.company.update({where:{id},data:{passwordHash:hash,authVersion:{increment:1}}});
 console.log('Company password changed and existing sessions revoked. The password was not printed.');
}finally{await db.$disconnect();}})().catch(error=>{console.error(error.name?.startsWith('Prisma')?'Company not found or database operation failed.':error.message);process.exitCode=1;});
