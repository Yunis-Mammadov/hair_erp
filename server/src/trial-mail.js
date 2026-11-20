const F=require('./financial-core');
function mode(env=process.env){
 if(env.TRIAL_SIGNUP_ENABLED!=='true')return null;
 if(env.TRIAL_EMAIL_MODE==='console'&&env.NODE_ENV==='development')return 'console';
 const port=Number(env.SMTP_PORT||587);
 if(env.TRIAL_EMAIL_MODE==='smtp'&&env.APP_URL&&env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_FROM||'')&&[465,587].includes(port))return 'smtp';
 return null;
}
const copy={
 en:{subject:'Confirm your z-Index free trial',body:'Open this link to confirm your email and create your company. Your 7-day trial starts only when you finish setup.',expires:'This link expires in one hour. If you did not request this email, you can ignore it.'},
 az:{subject:'z-Index pulsuz sınağını təsdiqlə',body:'E-poçtunu təsdiqləmək və şirkətini yaratmaq üçün keçidi aç. 7 günlük sınaq yalnız hesabın qurulmasını tamamlayanda başlayır.',expires:'Keçid bir saat qüvvədədir. Bu məktubu sən istəməmisənsə, nəzərə almaya bilərsən.'},
 tr:{subject:'z-Index ücretsiz denemenizi doğrulayın',body:'E-posta adresinizi doğrulamak ve şirketinizi oluşturmak için bağlantıyı açın. 7 günlük deneme yalnızca kurulumu tamamladığınızda başlar.',expires:'Bu bağlantı bir saat geçerlidir. Bu e-postayı siz istemediyseniz yok sayabilirsiniz.'},
 ru:{subject:'Подтвердите пробный доступ к z-Index',body:'Откройте ссылку, чтобы подтвердить почту и создать компанию. Пробные 7 дней начнутся только после завершения настройки.',expires:'Ссылка действует один час. Если вы не запрашивали это письмо, проигнорируйте его.'}
};
async function sendVerification({email,token,locale},env=process.env){
 const delivery=mode(env);if(!delivery)throw F.fail(503,'Trial email delivery is not configured.','TRIAL_UNAVAILABLE');
 const c=copy[locale]||copy.en,url=new URL('/trial/activate',env.APP_URL||'http://localhost:5173');url.hash='token='+token;
 if(delivery==='console'){
  // Explicit opt-in only. Fragment tokens are not included in HTTP access logs.
  process.stdout.write('[LOCAL TRIAL EMAIL — NOT SENT] '+url.href+'\n');return;
 }
 const port=Number(env.SMTP_PORT||587),transport=require('nodemailer').createTransport({host:env.SMTP_HOST,port,secure:port===465,requireTLS:port===587,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
 try{const r=await transport.sendMail({from:env.SMTP_FROM,to:email,subject:c.subject,text:c.body+'\n\n'+url.href+'\n\n'+c.expires,disableFileAccess:true,disableUrlAccess:true});if(r.rejected?.length)throw Error('TRIAL_MAIL_REJECTED');}finally{transport.close();}
}
module.exports={mode,sendVerification};
