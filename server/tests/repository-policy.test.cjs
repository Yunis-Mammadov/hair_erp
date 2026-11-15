const {test}=require('node:test'),assert=require('node:assert/strict');
const {forbiddenPath,checkRepository}=require('../scripts/check-repository.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('F01 repository policy rejects database dumps, private keys and real env files',()=>{
 for(const file of ['backups/a.dump','nested/backups/a.sql','server/.env','client/.env.production','server/uploads/photo.webp','nested/db.dump','tls/private.key','id_ed25519','node_modules/a.js'])assert.equal(forbiddenPath(file),true,file);
 for(const file of ['server/.env.example','client/.env.example','Dockerfile','server/prisma/migrations/initial/migration.sql','server/src/upload-access.js','client/src/pages/StockPage.jsx'])assert.equal(forbiddenPath(file),false,file);
});
test('F01 check inspects the Git index and leaves local backups untouched',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zindex-index-'));
 try{
  execFileSync('git',['init','--quiet',root]);fs.mkdirSync(path.join(root,'backups'));fs.writeFileSync(path.join(root,'backups/private.dump'),'fixture only');
  execFileSync('git',['add','--','backups/private.dump'],{cwd:root});assert.deepEqual(checkRepository(root),['backups/private.dump']);
  fs.mkdirSync(path.join(root,'server'));assert.deepEqual(checkRepository(path.join(root,'server')),['backups/private.dump']);
  execFileSync('git',['rm','--cached','--','backups/private.dump'],{cwd:root});assert.deepEqual(checkRepository(root),[]);assert.equal(fs.readFileSync(path.join(root,'backups/private.dump'),'utf8'),'fixture only');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
