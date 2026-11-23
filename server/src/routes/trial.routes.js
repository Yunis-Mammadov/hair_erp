const {Router}=require('express'),{randomBytes,createHash,createHmac}=require('node:crypto'),bcrypt=require('bcrypt');
const {platformPrisma:db}=require('../prismaClient'),F=require('../financial-core'),W=require('../workspace-core'),Mail=require('../trial-mail'),{assertPin}=require('../pin-policy'),{jwtSecret}=require('../auth-security'),{publicCompany,PRICES}=require('../config/plans');
const router=Router(),DAY=86400000,TERMS_VERSION='2026-11-20',GENERIC='If this email is eligible, you will receive a verification link. Check your inbox and spam folder.';
const hash=v=>createHash('sha256').update(v).digest('hex');
function limitAll(max,windowMs){const hits=new Map();const timer=setInterval(()=>{for(const[k,v]of hits)if(v.until<=Date.now())hits.delete(k);},60000);timer.unref();return(req,res,next)=>{const now=Date.now(),key=req.ip||'unknown';let row=hits.get(key);if(!row||row.until<=now){if(hits.size>=10000)return res.status(429).json({message:'Too many trial requests. Please try again later.'});row={count:0,until:now+windowMs};hits.set(key,row);}if(++row.count>max)return res.set('Retry-After',String(Math.ceil((row.until-now)/1000))).status(429).json({message:'Too many trial requests. Please try again later.'});next();};}
const route=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
function fields(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw F.fail(400,'Check the trial details.');return body;}
function enabled(){if(!Mail.mode())throw F.fail(503,'Trial email delivery is not configured.','TRIAL_UNAVAILABLE');}
function tokenOf(body){if(typeof body.token!=='string'||!/^\w{64}$/.test(body.token)||!/^[a-f0-9]+$/.test(body.token))throw F.fail(400,'This verification link is invalid or expired.','TRIAL_LINK_INVALID');return body.token;}
function validInvitation(row,now=new Date()){if(!row||row.expiresAt<=now)throw F.fail(410,'This verification link is invalid or expired.','TRIAL_LINK_INVALID');}
async function serial(fn){for(let n=0;;n++)try{return await db.$transaction(fn,{isolationLevel:'Serializable',timeout:20000});}catch(e){if(e.code==='P2034'&&n<4)continue;throw e;}}
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next();});
router.use((req,res,next)=>{if(req.method==='POST'&&!req.is('application/json'))return res.status(415).json({message:'Request must use application/json.'});next();});
router.get('/config',(_req,res)=>res.json({enabled:!!Mail.mode(),trialDays:7,currencies:W.currencies,termsVersion:TERMS_VERSION,offers:PRICES.GLOBAL.BASIC}));
router.post('/request',limitAll(8,15*60000),route(async(req,res)=>{
 enabled();const b=fields(req.body,['email','locale','website']);
 if(b.website){res.json({message:GENERIC});return;}
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>254||!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(email)||/\.(invalid|local|test|example)$/i.test(email))throw F.fail(400,'Enter a real email address you can access.');
 const locale=b.locale??'en';if(!['en','az','tr','ru'].includes(locale))throw F.fail(400,'Choose a supported language.');
 const now=new Date(),ipHash=createHmac('sha256',jwtSecret()).update(req.ip||'unknown').digest('hex'),token=randomBytes(32).toString('hex');
 const made=await serial(async tx=>{
  const recent={gte:new Date(+now-3600000)};
  const [used,recentEmail,recentIp,total]=await Promise.all([tx.company.findFirst({where:{OR:[{trialEmail:email},{loginEmail:email}]},select:{id:true}}),tx.trialInvitation.findMany({where:{email,createdAt:recent},select:{createdAt:true},orderBy:{createdAt:'desc'},take:3}),tx.trialInvitation.count({where:{ipHash,createdAt:recent}}),tx.trialInvitation.count({where:{createdAt:recent}})]);
  if(recentIp>=20||total>=200)throw F.fail(429,'Too many trial requests. Please try again later.','TRIAL_RATE_LIMIT');
  if(used||recentEmail.length>=3||recentEmail[0]?.createdAt>new Date(+now-60000))return false;
  await tx.trialInvitation.create({data:{email,locale,ipHash,tokenHash:hash(token),expiresAt:new Date(+now+3600000)}});return true;
 });
 if(made)try{await Mail.sendVerification({email,token,locale});}catch{require('../ops/runtime').log('trial_email_failed',{code:'TRIAL_MAIL_DELIVERY_FAILED'});}
 res.json({message:GENERIC});
}));
router.post('/inspect',limitAll(30,15*60000),route(async(req,res)=>{
 enabled();const b=fields(req.body,['token']),row=await db.trialInvitation.findUnique({where:{tokenHash:hash(tokenOf(b))}});validInvitation(row);
 if(row.usedAt)throw F.fail(409,'This trial has already been activated. Sign in to your company.','TRIAL_ALREADY_USED');
 res.json({email:row.email,expiresAt:row.expiresAt,trialDays:7});
}));
router.post('/activate',limitAll(10,15*60000),route(async(req,res)=>{
 enabled();const b=fields(req.body,['token','code','name','adminName','password','pin','currency','timezone','locale','acceptedTerms']);const token=tokenOf(b);
 const input={code:F.text(b.code,63)?.toLowerCase(),name:F.text(b.name,150),adminName:F.text(b.adminName,100),password:b.password,pin:assertPin(b.pin),currency:b.currency,timezone:b.timezone,locale:b.locale||'en',acceptedTerms:b.acceptedTerms};
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.code||'')||['admin','support','operator','demo','test','zindex'].includes(input.code))throw F.fail(400,'Choose a company code using letters, numbers and hyphens.');
 if(!input.name||input.name.length<2||!input.adminName||input.adminName.length<2)throw F.fail(400,'Enter your name and company name.');
 if(typeof input.password!=='string'||input.password.length<12||Buffer.byteLength(input.password)>72)throw F.fail(400,'Company password must contain at least 12 characters and no more than 72 bytes.');
 if(!W.currencies.includes(input.currency)||!W.validTimezone(input.timezone)||!['en','az','tr','ru'].includes(input.locale)||input.acceptedTerms!==true)throw F.fail(400,'Choose currency and timezone, and accept the terms.');
 const tokenHash=hash(token),prior=await db.trialInvitation.findUnique({where:{tokenHash}});validInvitation(prior);
 const requestHash=createHmac('sha256',jwtSecret()).update(JSON.stringify(input)).digest('hex');
 const [passwordHash,pinHash]=await Promise.all([bcrypt.hash(input.password,12),bcrypt.hash(input.pin,12)]);
 let result;
 try{result=await serial(async tx=>{
  const row=await tx.trialInvitation.findUnique({where:{tokenHash}});validInvitation(row);
  if(row.usedAt){if(row.requestHash!==requestHash||!row.companyId)throw F.fail(409,'This trial has already been activated. Sign in to your company.','TRIAL_ALREADY_USED');const c=await tx.company.findUniqueOrThrow({where:{id:row.companyId}});return {replayed:true,company:publicCompany(c)};}
  const exists=await tx.company.findFirst({where:{OR:[{trialEmail:row.email},{loginEmail:row.email}]},select:{id:true}});if(exists)throw F.fail(409,'This email has already used its trial. Sign in or contact support.','TRIAL_ALREADY_USED');
  const startsAt=new Date(),trialEndsAt=new Date(+startsAt+7*DAY);
  // Keep the local offer if the verification link is opened in a browser with a different language.
  const market=row.locale==='az'||input.locale==='az'?'AZ':'GLOBAL';
  const company=await tx.company.create({data:{name:input.name,loginEmail:input.code+'@zindex.com',passwordHash,plan:'BASIC',market,currency:input.currency,currencyConfigured:true,timezone:input.timezone,locale:input.locale,isActive:true,isDemo:false,startsAt,endsAt:trialEndsAt,trialEmail:row.email,trialStartedAt:startsAt,trialEndsAt,trialTermsVersion:TERMS_VERSION}});
  await tx.user.create({data:{companyId:company.id,fullName:input.adminName,role:'ADMIN',pinHash,isActive:true}});
  await tx.trialInvitation.update({where:{id:row.id},data:{usedAt:startsAt,companyId:company.id,requestHash}});
  await tx.trialInvitation.updateMany({where:{email:row.email,id:{not:row.id},usedAt:null},data:{usedAt:startsAt,companyId:company.id}});
  await tx.auditEvent.create({data:{companyId:company.id,entityType:'Company',entityId:company.id,actorName:input.adminName,action:'TRIAL_ACTIVATED',reason:'Verified email and accepted trial terms '+TERMS_VERSION,before:{},after:{trialStartedAt:startsAt.toISOString(),trialEndsAt:trialEndsAt.toISOString(),termsVersion:TERMS_VERSION}}});
  return {replayed:false,company:publicCompany(company)};
 });}catch(e){if(e.code==='P2002')throw F.fail(409,'This company code or trial email is already in use. Choose another code or sign in.','TRIAL_CONFLICT');throw e;}
 res.status(result.replayed?200:201).json(result);
}));
module.exports={router,TERMS_VERSION,limitAll};
