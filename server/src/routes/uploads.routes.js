const { Router } = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { attemptLimiter } = require('../auth-security');
const { uploadsRoot, signedUploadUrl } = require('../upload-access');
const router = Router(), locks = new Map();
const fail = (code,status,message)=>Object.assign(new Error(message),{code,status});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1}}).single('file');
router.post('/',requireAuth,requireRole('ADMIN','EXPEDITOR'),attemptLimiter(15,60000,req=>req.company.id+':'+req.user.id),upload,async(req,res,next)=>{
 try {
  if(!req.file||!['image/png','image/jpeg','image/jpg','image/webp'].includes(req.file.mimetype))throw fail('INVALID_IMAGE',400,'Choose a PNG, JPEG or WebP image.');
  let bytes;
  try {bytes=await sharp(req.file.buffer,{limitInputPixels:16000000,animated:false}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();}catch{throw fail('INVALID_IMAGE',400,'Choose a valid image within the pixel limit.');}
  const company=req.company.id,previous=locks.get(company)||Promise.resolve();let release;
  const current=new Promise(r=>{release=r;});locks.set(company,current);await previous;
  const filename='payment-'+randomUUID()+'.webp',directory=path.join(uploadsRoot,company);
  try {
   await fs.mkdir(directory,{recursive:true});let used=0;
   for(const name of await fs.readdir(directory)){const stat=await fs.lstat(path.join(directory,name));if(stat.isFile())used+=stat.size;}
   if(used+bytes.length>250*1024*1024)throw fail('STORAGE_LIMIT',409,'Company storage limit reached.');
   await fs.writeFile(path.join(directory,filename),bytes,{flag:'wx'});
  }finally{release();if(locks.get(company)===current)locks.delete(company);}
  res.status(201).json({file:{filename,mimetype:'image/webp',size:bytes.length,url:signedUploadUrl('/uploads/'+company+'/'+filename,req)}});
 }catch(error){next(error);}
});
module.exports=router;
