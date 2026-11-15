import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('F12/F13 real components format stock and never add stale catalogue results',async()=>{
 const client=path.resolve(import.meta.dirname,'..'),cache=path.join(client,'node_modules/.cache');await fs.mkdir(cache,{recursive:true});
 const folder=await fs.mkdtemp(path.join(cache,'audit-dom-'));
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
 for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','MutationObserver','DocumentFragment','Event','localStorage','sessionStorage'])globalThis[key]=dom.window[key];
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;
 window.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 const pending=[];const pagination={page:1,limit:15,total:1,totalPages:1};
 globalThis.__auditApi={get:(url,config)=>url==='/catalog/products'?new Promise((resolve,reject)=>pending.push({resolve,reject,config})):Promise.resolve({data:url==='/stock'?{items:[{productId:'p',productName:'Product',category:{id:'cat',name:'Products'},quantity:10,salePrice:12.5}],stats:{totalProducts:1,totalQuantity:10,outOfStock:0,lowStock:0},pagination}:{categories:[]}})};
 let root,React;
 try{
  const outfile=path.join(folder,'components.cjs');
  await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import {MemoryRouter} from "react-router-dom";import Catalog from "./src/components/CatalogPicker";import Stock from "./src/pages/StockPage";import * as runtime from "./src/i18n/runtime";export {React,createRoot,MemoryRouter,Catalog,Stock,runtime};',loader:'jsx',resolveDir:client},outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','react-router-dom','@mui/material','@mui/material/*','@mui/system','@mui/system/*','@mui/utils','@emotion/*'],plugins:[{name:'fixture',setup(b){
   b.onResolve({filter:/(^|\/)api$/},()=>({path:'api',namespace:'fixture'}));b.onResolve({filter:/features\/auth\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));
   b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='api'?'export const api={get:(url,config)=>globalThis.__auditApi.get(url,config)};':'export function useAuth(){return {user:{id:"admin",role:"ADMIN",company:{id:"company",currency:"EUR",currencyConfigured:true,features:[]}}}}',loader:'js'}));
  }}]});
  const components=createRequire(import.meta.url)(outfile);React=components.React;root=components.createRoot(document.getElementById('root'));
  const {Catalog,Stock,MemoryRouter,runtime}=components;
  const tick=()=>React.act(async()=>{await new Promise(r=>setTimeout(r,240));});
  const products=name=>({data:{products:[{id:name,name,category:{name:'Products'},stockQty:10,salePrice:12.5}],pagination}});
  const addButtons=()=>[...document.querySelectorAll('button')].filter(x=>x.textContent==='Add');
  let added=[];
  await React.act(async()=>root.render(React.createElement(Catalog,{canGift:true,onAdd:p=>added.push(p.id)})));
  assert.equal(addButtons().length,0);await tick();assert.equal(pending.length,1);
  await React.act(async()=>pending[0].resolve(products('Original')));assert.equal(addButtons().length,1);
  const input=document.querySelector('input');
  async function search(text){await React.act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
  await search('first');assert.equal(addButtons().length,0,'old results must disappear before debounce');await tick();assert.equal(pending[1].config.params.search,'first');
  await search('latest');assert.equal(addButtons().length,0);await tick();assert.equal(pending[1].config.signal.aborted,true);
  await React.act(async()=>pending[2].resolve(products('Newest')));assert.match(document.body.textContent,/Newest/);
  await React.act(async()=>pending[1].resolve(products('Late stale product')));assert.ok(!document.body.textContent.includes('Late stale product'));
  await React.act(async()=>addButtons()[0].click());assert.deepEqual(added,['Newest']);
  await React.act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'k',altKey:true,bubbles:true})));assert.equal(document.activeElement,input);
  await React.act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));assert.deepEqual(added,['Newest','Newest']);
  await search('fails');assert.equal(addButtons().length,0);await React.act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));assert.equal(added.length,2,'Enter cannot add a stale product while loading');await tick();await React.act(async()=>pending[3].reject(Error('fixture failure')));
  assert.equal(addButtons().length,0);assert.ok(document.querySelector('[role="alert"]'));assert.ok(!document.body.textContent.includes('Newest'));
  await React.act(async()=>root.unmount());root=components.createRoot(document.getElementById('root'));
  for(const language of ['en','az','tr','ru']){
   await React.act(async()=>{runtime.setLanguage(language);runtime.setWorkspace({currency:'EUR',timezone:'UTC'});root.render(React.createElement(MemoryRouter,null,React.createElement(Stock)));});await tick();
   assert.ok(document.body.textContent.includes(runtime.formatMoney(12.5)),'stock price includes locale and EUR');
   const selects=document.querySelectorAll('[role="combobox"]');assert.ok(selects.length>=3);
   if(language==='en')assert.ok(!document.body.textContent.includes('SKU / barkod'));
  }
 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();delete globalThis.__auditApi;await fs.rm(folder,{recursive:true,force:true});}
});
