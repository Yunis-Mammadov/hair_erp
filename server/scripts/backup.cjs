require('dotenv').config({quiet:true});
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process'),{Client}=require('pg');
async function fileHash(filename){const digest=createHash('sha256');for await(const chunk of require('node:fs').createReadStream(filename))digest.update(chunk);return digest.digest('hex');}
async function files(root,prefix=''){
 const entries=[];for(const name of await fs.readdir(path.join(root,prefix))){const relative=prefix?prefix+'/'+name:name,p=path.join(root,relative),stat=await fs.lstat(p);if(stat.isSymbolicLink())throw Error('Backup refuses symbolic links.');if(stat.isDirectory())entries.push(...await files(root,relative));else if(stat.isFile())entries.push(relative);else throw Error('Unsupported file in uploads.');}return entries.sort();
}
function binary(name){if(process.env.PG_BIN)return path.join(process.env.PG_BIN,name+(process.platform==='win32'?'.exe':''));return process.platform==='win32'?path.join('C:/Program Files/PostgreSQL/18/bin',name+'.exe'):name;}
function run(name,args,url){return new Promise((resolve,reject)=>{const child=spawn(binary(name),args,{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password),...(url.searchParams.has('sslmode')?{PGSSLMODE:url.searchParams.get('sslmode')}:{})},stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>{error+=b;});child.on('error',()=>reject(Error(name+' could not start. Check PG_BIN.')));child.on('exit',code=>code===0?resolve():reject(Error(name+' failed. Check PostgreSQL tool/server versions and permissions.')));});}
const connection=url=>['--host',url.hostname,'--port',url.port||'5432','--username',decodeURIComponent(url.username),'--dbname',decodeURIComponent(url.pathname.slice(1))];
async function verify(folder){
 const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
 if(manifest.format!==1||!manifest.files||typeof manifest.sourceDatabase!=='string')throw Error('Invalid backup manifest.');
 for(const [name,expected]of Object.entries(manifest.files)){
  if(!/^(database\.dump|uploads\/[a-zA-Z0-9._/-]+)$/.test(name)||name.split('/').some(v=>v==='..'||v===''))throw Error('Unsafe backup path.');
  const stat=await fs.lstat(path.join(folder,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid backup file.');
  if(await fileHash(path.join(folder,name))!==expected)throw Error('Backup checksum mismatch: '+name);
 }
 if(!manifest.files['database.dump'])throw Error('Database archive missing.');
 // Reject extra files; incomplete or injected uploads must not be restored.
 const actual=(await files(folder)).filter(x=>x!=='manifest.json');if(JSON.stringify(actual)!==JSON.stringify(Object.keys(manifest.files).sort()))throw Error('Backup file list mismatch.');
 return manifest;
}
async function backup({url,uploads,out}){
 await fs.mkdir(out,{recursive:false});await fs.mkdir(path.join(out,'uploads'));const manifest={format:1,createdAt:new Date().toISOString(),sourceDatabase:decodeURIComponent(url.pathname.slice(1)),files:{}};
 try{
  await run('pg_dump',[...connection(url),'--format=custom','--file',path.join(out,'database.dump')],url);
  for(const name of await files(uploads)){const to=path.join(out,'uploads',name);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(path.join(uploads,name),to);}
  for(const name of await files(out))manifest.files[name]=await fileHash(path.join(out,name));
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));await verify(out);return manifest;
 }catch(error){await fs.writeFile(path.join(out,'INCOMPLETE.txt'),'Backup failed. Do not restore.').catch(()=>{});throw error;}
}
async function restore({url,folder,targetDatabase,targetUploads}){
 const manifest=await verify(folder),source=decodeURIComponent(url.pathname.slice(1));
 if(!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(targetDatabase||'')||[source,manifest.sourceDatabase,'postgres','template0','template1'].includes(targetDatabase))throw Error('Choose a NEW database name different from source.');
 try{await fs.lstat(targetUploads);throw Error('Restore uploads destination must not already exist.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(path.dirname(targetUploads),{recursive:true});
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Client({connectionString:adminUrl.toString()});await admin.connect();let created=false,createdUploads=false;
 try{
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[targetDatabase])).rowCount)throw Error('Restore refuses an existing database.');
  await admin.query('CREATE DATABASE "'+targetDatabase+'"');created=true;
  const target=new URL(url);target.pathname='/'+targetDatabase;
  await run('pg_restore',[...connection(target),'--no-owner','--no-privileges','--exit-on-error',path.join(folder,'database.dump')],target);
  await fs.mkdir(targetUploads,{recursive:false});createdUploads=true;for(const name of Object.keys(manifest.files).filter(x=>x.startsWith('uploads/'))){const to=path.join(targetUploads,name.slice(8));await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(path.join(folder,name),to);}
  const check=new Client({connectionString:target.toString()});await check.connect();try{await check.query('SELECT COUNT(*) FROM "Company"');}finally{await check.end();}
  return {database:targetDatabase,uploads:targetUploads};
 }catch(error){if(createdUploads)await fs.rm(targetUploads,{recursive:true,force:true}).catch(()=>{});if(created)await admin.query('DROP DATABASE "'+targetDatabase+'" WITH (FORCE)').catch(()=>{});throw error;}finally{await admin.end();}
}
async function main(args){
 const command=args.shift(),opts={};for(let i=0;i<args.length;i++){if(args[i]==='--offline'){opts.offline=true;continue;}if(!args[i].startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid arguments.');opts[args[i].slice(2)]=args[++i];}
 if(command==='verify'){await verify(path.resolve(opts.from));console.log('Backup files and checksums verified.');return;}
 if(!opts.offline)throw Error('Stop ALL app/worker processes first, then pass --offline.');
 const url=new URL(process.env.DATABASE_URL);if(command==='backup'){const out=path.resolve(opts.out||'../backups/group6-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(path.dirname(out),{recursive:true});await backup({url,uploads:path.resolve(process.env.UPLOADS_DIR||path.join(__dirname,'../src/uploads')),out});console.log('Backup ready: '+out);}else if(command==='restore'){const result=await restore({url,folder:path.resolve(opts.from),targetDatabase:opts['target-db'],targetUploads:path.resolve(opts['target-uploads'])});console.log('Restore verified: '+result.database+'; uploads: '+result.uploads);}else throw Error('Use backup, verify or restore.');
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={backup,restore,verify,files};
