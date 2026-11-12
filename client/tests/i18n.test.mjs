import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import messages from '../../shared/messages.json' with {type:'json'};
import * as i18n from '../src/i18n/runtime.js';
import { amountValue, normalizeMoneyPayload } from '../src/lib/money-input.mjs';

test('all four languages have nonempty translations and matching placeholders',()=>{
 for(const [key,row]of Object.entries(messages))for(const lang of ['en','az','tr','ru']){
  assert.equal(typeof row[lang],'string',key+' '+lang);assert.ok(row[lang].trim(),key+' '+lang);
  assert.deepEqual([...row[lang].matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),[...key.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),key+' '+lang);
 }
});
test('English default and persisted language selection exclude unsupported languages',async()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const fresh=await import('../src/i18n/runtime.js?first');assert.equal(fresh.getSnapshot().language,'en');fresh.setLanguage('ru');assert.equal(values.get('z-index-language'),'ru');fresh.setLanguage('pl');assert.equal(fresh.getSnapshot().language,'ru');
 const reload=await import('../src/i18n/runtime.js?reload');assert.equal(reload.getSnapshot().language,'ru');
});
test('currency formatting preserves amounts and explicit historical invoice currency',()=>{
 i18n.setLanguage('en');i18n.setWorkspace({currency:'TRY',timezone:'UTC'});
 assert.equal(i18n.formatMoney(1234.56),new Intl.NumberFormat('en-US',{style:'currency',currency:'TRY',minimumFractionDigits:2,maximumFractionDigits:2}).format(1234.56));
 assert.equal(i18n.formatMoney(10,'EUR'),'€10.00');i18n.setWorkspace(null);assert.equal(i18n.getSnapshot().currency,'USD');
});
test('company timezones and switching language update dates while unknown business text stays intact',()=>{
 i18n.setLanguage('en');i18n.setWorkspace({currency:'EUR',timezone:'Asia/Baku'});assert.equal(i18n.formatDate('2026-11-09T22:30:00Z',false),'Nov 10, 2026');
 assert.equal(i18n.t('Unique Shop 123'),'Unique Shop 123');i18n.setLanguage('tr');assert.equal(i18n.t('Müştərilər'),'Müşteriler');i18n.setLanguage('ru');assert.equal(i18n.t('Müştərilər'),'Клиенты');i18n.setLanguage('az');assert.equal(i18n.t('Müştərilər'),'Müştərilər');i18n.setLanguage('en');
});
test('decimal-comma money is normalized without truncation or modifying quantities and notes',()=>{
 assert.equal(amountValue('12,50'),12.5);assert.ok(Number.isNaN(amountValue('12,500')));assert.ok(Number.isNaN(amountValue('12abc')));
 assert.deepEqual(normalizeMoneyPayload({amount:'10,25',items:[{unitPrice:'2,50',quantity:'1,5'}],note:'1,20'}),{amount:'10.25',items:[{unitPrice:'2.50',quantity:'1,5'}],note:'1,20'});
});
test('every literal translation key in client source has a dictionary entry',()=>{
 const root=path.resolve(import.meta.dirname,'../src');
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())scan(f);else if(/\.(js|jsx)$/.test(f)){const source=fs.readFileSync(f,'utf8');for(const match of source.matchAll(/\bt\("((?:\\.|[^"\\])*)"/g)){const key=JSON.parse('"'+match[1]+'"');assert.ok(messages[key],f+': '+key);}}}}
 scan(root);
});
