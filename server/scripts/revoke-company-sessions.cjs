require('dotenv').config({quiet:true});
const {platformPrisma:db}=require('../src/prismaClient');
(async()=>{try{
 const id=process.env.REVOKE_COMPANY_ID;
 if(!id||process.argv[2]!=='--confirm')throw Error('Set REVOKE_COMPANY_ID and pass --confirm.');
 await db.company.update({where:{id},data:{authVersion:{increment:1}}});
 console.log('Existing company sessions, login challenges and image links have been revoked. Passwords and PINs still need to be changed if exposed.');
}finally{await db.$disconnect();}})().catch(error=>{console.error(error.name?.startsWith('Prisma')?'Company not found or database operation failed.':error.message);process.exitCode=1;});
