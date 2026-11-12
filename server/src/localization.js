const messages = require('../../shared/messages.json');
module.exports = (req, res, next) => {
  const supported = ['en','az','tr','ru'];
  const requested = String(req.get('Accept-Language') || '').split(',').map((item, i) => {const [tag,q] = item.trim().split(';q='); return {lang:tag.split('-')[0].toLowerCase(),q:q===undefined?1:Number(q),i};}).filter(x=>x.q>0).sort((a,b)=>b.q-a.q||a.i-b.i);
  const lang = requested.find(x=>supported.includes(x.lang))?.lang || 'en';
  res.set('Content-Language', lang);
  const json = res.json.bind(res);
  res.json = body => {
    if (body && typeof body.message === 'string') {
      let translated = messages[body.message]?.[lang];
      if (!translated) for (const [key,row] of Object.entries(messages)) {
        if (!key.includes('{')) continue;
        const names=[];
        const pattern = '^'+key.split(/(\{\w+\})/).map(part=> /^\{/.test(part)?(names.push(part.slice(1,-1)),'(.+?)'):part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$';
        const match=body.message.match(new RegExp(pattern));
        if (match && row[lang]) {translated=row[lang].replace(/\{(\w+)\}/g,(m,n)=>match[names.indexOf(n)+1]||m);break;}
      }
      if (!translated && /[əƏıİşŞğĞçÇ]/.test(body.message)) translated = messages[res.statusCode>=500?'The operation could not be completed. Please try again.':'Please check the supplied details.']?.[lang];
      body={...body,message:translated || body.message};
    }
    return json(body);
  };
  next();
};
