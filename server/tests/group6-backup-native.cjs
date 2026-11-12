const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const {backup,restore,verify}=require('../scripts/backup.cjs');
test('Group 6 native PostgreSQL backup and restore including receipt images',{skip:!process.env.NATIVE_DATABASE_URL},async t=>{
 const url=new URL(process.env.NATIVE_DATABASE_URL);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));assert.ok(url.pathname.endsWith('_test'));
 const suffix=randomUUID().replaceAll('-',''),source='backup_'+suffix+'_test',target='restore_'+suffix+'_test',root=await fs.mkdtemp(path.join(os.tmpdir(),'zindex-restore-'));
 const admin=new Client({connectionString:url.toString()});await admin.connect();let client;
 try{
  await admin.query('CREATE DATABASE "'+source+'"');const sourceUrl=new URL(url);sourceUrl.pathname='/'+source;client=new Client({connectionString:sourceUrl.toString()});await client.connect();
  await client.query(await fs.readFile(path.join(__dirname,'fixtures/legacy-schema.sql'),'utf8'));
  for(const name of ['202611070001_company_basic_login','202611100001_group1_financials','202611100002_group3_records','202611100003_group4_global_setup','202611110001_group5_workflows','202611120001_group6_operations'])await client.query(await fs.readFile(path.join(__dirname,'../prisma/migrations',name,'migration.sql'),'utf8'));
  await client.query(`UPDATE "Company" SET name='Restore Company',"passwordHash"='preserved-company-password',"logoUrl"='/uploads/legacy-logo.png',"isActive"=true WHERE id='legacy-company';
   INSERT INTO "User" (id,"companyId","fullName","pinHash",role,"updatedAt") VALUES ('backup-user','legacy-company','Preserved User','preserved-pin-hash','ADMIN',NOW());
   INSERT INTO "Category" (id,"companyId",name,"updatedAt") VALUES ('backup-category','legacy-company','Test',NOW());
   INSERT INTO "Product" (id,"companyId",name,"categoryId","salePrice","updatedAt") VALUES ('backup-product','legacy-company','Preserved product','backup-category',10,NOW());
   INSERT INTO "Stock" ("companyId","productId",quantity,version,"updatedAt") VALUES ('legacy-company','backup-product',17,4,NOW());
   INSERT INTO "Customer" (id,"companyId",name,phone,"updatedAt") VALUES ('backup-customer','legacy-company','Preserved Buyer','+14155552671',NOW());
   INSERT INTO "Order" (id,"companyId","orderNumber","customerId","createdById","paymentType","updatedAt","totalAmount","invoiceNumber",currency) VALUES ('backup-order','legacy-company',1,'backup-customer','backup-user','NAĞD',NOW(),20,'00001','USD');
   INSERT INTO "OrderItem" (id,"companyId","orderId","productId",quantity,"unitPrice") VALUES ('backup-item','legacy-company','backup-order','backup-product',2,10);
   INSERT INTO "Payment" (id,"companyId","customerId",amount,"imageUrl") VALUES ('backup-payment','legacy-company','backup-customer',5,'/uploads/legacy-company/receipt.png');
   INSERT INTO "OperationRequest" (id,"companyId",scope,key,hash,response) VALUES ('backup-operation','legacy-company','payment','preserved-request','preserved-hash','{"ok":true}');`);
  await t.test('operator PIN recovery uses explicit tenant/user IDs and prints no PIN',async()=>{
   const run=require('node:util').promisify(require('node:child_process').execFile);
   const result=await run(process.execPath,[path.join(__dirname,'../scripts/reset-pin.cjs')],{cwd:path.join(__dirname,'..'),env:{...process.env,DATABASE_URL:sourceUrl.toString(),RESET_COMPANY_ID:'legacy-company',RESET_USER_ID:'backup-user',RESET_PIN:'789321'}});
   assert.ok(!result.stdout.includes('789321'));const user=(await client.query('SELECT "pinHash","authVersion" FROM "User" WHERE id=$1',['backup-user'])).rows[0];assert.equal(await require('bcrypt').compare('789321',user.pinHash),true);assert.equal(user.authVersion,1);
  });
  const uploads=path.join(root,'original-uploads');await fs.mkdir(path.join(uploads,'legacy-company'),{recursive:true});const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');await fs.writeFile(path.join(uploads,'legacy-company/receipt.png'),png);await fs.writeFile(path.join(uploads,'legacy-logo.png'),png);
  const folder=path.join(root,'backup'),restoredUploads=path.join(root,'new-parent','restored-uploads');
  await t.test('database and both tenant/legacy images are included and checksummed',async()=>{const result=await backup({url:sourceUrl,uploads,out:folder});assert.equal(Object.keys(result.files).length,3);assert.ok(result.files['database.dump']);assert.ok(result.files['uploads/legacy-company/receipt.png']);await verify(folder);});
  await t.test('real pg_restore preserves IDs, PIN hashes, money, stock, retry history and image bytes',async()=>{
   await restore({url:sourceUrl,folder,targetDatabase:target,targetUploads:restoredUploads});const restoredUrl=new URL(url);restoredUrl.pathname='/'+target;const check=new Client({connectionString:restoredUrl.toString()});await check.connect();
   try{for(const table of ['Company','User','Product','Stock','Customer','Order','OrderItem','Payment','OperationRequest']){const sql='SELECT row_to_json(t) AS data FROM "'+table+'" t ORDER BY row_to_json(t)::text';assert.deepEqual((await check.query(sql)).rows,(await client.query(sql)).rows,table);}}
   finally{await check.end();}assert.deepEqual(await fs.readFile(path.join(restoredUploads,'legacy-company/receipt.png')),png);assert.deepEqual(await fs.readFile(path.join(restoredUploads,'legacy-logo.png')),png);
  });
  await t.test('restore refuses a source or existing database and existing uploads directory',async()=>{
   await assert.rejects(restore({url:sourceUrl,folder,targetDatabase:source,targetUploads:path.join(root,'other')}),/NEW database/);
   await assert.rejects(restore({url:sourceUrl,folder,targetDatabase:target,targetUploads:path.join(root,'other')}),/existing database/);
   await assert.rejects(restore({url:sourceUrl,folder,targetDatabase:'another_'+suffix,targetUploads:restoredUploads}),/must not already exist/);
  });
  await t.test('corrupt or injected backup content is rejected before any restore',async()=>{
   const corrupt=path.join(root,'corrupt');await fs.cp(folder,corrupt,{recursive:true});await fs.writeFile(path.join(corrupt,'uploads/legacy-company/receipt.png'),'corrupt');await assert.rejects(verify(corrupt),/checksum/);
   await fs.copyFile(path.join(folder,'uploads/legacy-company/receipt.png'),path.join(corrupt,'uploads/legacy-company/receipt.png'));await fs.writeFile(path.join(corrupt,'uploads/injected.png'),'unexpected');await assert.rejects(verify(corrupt),/file list/);
  });
 }finally{if(client)await client.end();for(const name of [target,source])await admin.query('DROP DATABASE IF EXISTS "'+name+'" WITH (FORCE)');await admin.end();await fs.rm(root,{recursive:true,force:true});}
});
