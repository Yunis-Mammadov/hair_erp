import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('Trial signup UI: consent, verification, safe setup, pricing and renewal',async t=>{
 const client=path.resolve(import.meta.dirname,'..');await fs.mkdir(path.join(client,'node_modules/.cache'),{recursive:true});const folder=await fs.mkdtemp(path.join(client,'node_modules/.cache/trial-dom-'));
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/trial/activate#token='+'a'.repeat(64)});
 for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','MutationObserver','DocumentFragment','Event','MouseEvent','localStorage','sessionStorage'])globalThis[key]=dom.window[key];
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;window.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){}});
 const calls=[];let available=true,badLink=false,activeCompanies=null,root,React,key=0;
 const trial={status:'active',startedAt:new Date().toISOString(),endsAt:new Date(Date.now()+7*86400000).toISOString()};
 let billing={enabled:true,active:true,hasSubscription:false,status:'manual',billingEmail:'owner@example.com',company:{plan:'BASIC',market:'GLOBAL',endsAt:trial.endsAt,trial,limits:{maxUsers:3},subscriptionPrice:{currency:'USD',amountMinor:1999}}};
 globalThis.__trialUser={role:'ADMIN',company:{trial}};
 globalThis.__trialApi={get:async(...a)=>{calls.push(['get',...a]);return {data:a[0]==='/trial/config'?{enabled:available,currencies:['USD','EUR'],trialDays:7}:a[0]==='/public/stats'?{activeCompanies}:billing};},post:async(...a)=>{calls.push(['post',...a]);if(a[0]==='/trial/inspect'){if(badLink)throw {response:{data:{message:'This verification link is invalid or expired.'}}};return {data:{email:'owner@example.com'}};}if(a[0]==='/trial/activate')return {data:{company:{loginEmail:'my-shop@zindex.com',trial}}};return {data:{}};}};
 try{
  const outfile=path.join(folder,'components.cjs');
  await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import {MemoryRouter} from "react-router-dom";import Request from "./src/pages/TrialPage";import Activate from "./src/pages/TrialActivatePage";import Banner from "./src/components/TrialBanner";import Landing from "./src/pages/LandingPage";import Plan from "./src/pages/PlanPage";import * as runtime from "./src/i18n/runtime";export {React,createRoot,MemoryRouter,Request,Activate,Banner,Landing,Plan,runtime};',loader:'jsx',resolveDir:client},outfile,bundle:true,loader:{'.css':'empty'},platform:'node',format:'cjs',jsx:'automatic',define:{'import.meta.env':'{}'},external:['react','react/*','react-dom','react-dom/*','@mui/material','@mui/material/*','@mui/system','@mui/system/*','@mui/utils','@emotion/*'],logLevel:'silent',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/(^|\/)(api|useAuth)$/},a=>({path:a.path.split('/').at(-1),namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='useAuth'?'export const useAuth=()=>({user:globalThis.__trialUser});':'export const api={get:(...a)=>globalThis.__trialApi.get(...a),post:(...a)=>globalThis.__trialApi.post(...a)};',loader:'js'}));}}]});
  const C=createRequire(import.meta.url)(outfile);React=C.React;C.runtime.setLanguage('en');C.runtime.setWorkspace(null);root=C.createRoot(document.getElementById('root'));
  const render=async(component,entry='/trial')=>React.act(async()=>root.render(React.createElement(C.MemoryRouter,{key:++key,initialEntries:[entry]},React.createElement(component))));
  const button=s=>[...document.querySelectorAll('button')].find(b=>b.textContent===s);
  const field=label=>[...document.querySelectorAll('input')].find(i=>[...(i.labels||[])].some(l=>l.textContent.replace(/\s*\*$/,'')===label));
  const set=async(label,value)=>{const el=field(label);assert.ok(el,'field '+label);await React.act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});};
  const submit=async()=>React.act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await t.test('request needs consent and sends language without credentials',async()=>{await render(C.Request);assert.equal(button('Send setup link').disabled,true);await set('Your email address','owner@example.com');await React.act(async()=>document.querySelector('input[type=checkbox]').click());assert.equal(button('Send setup link').disabled,false);await submit();assert.deepEqual(calls.at(-1),['post','/trial/request',{email:'owner@example.com',locale:'en',website:''},{anonymous:true}]);assert.match(document.body.textContent,/Check your email/);assert.match(document.body.textContent,/No company has been created yet/);});
  await t.test('disabled signup remains unavailable after consent',async()=>{available=false;await render(C.Request);assert.match(document.body.textContent,/Trial registration is not available/);await React.act(async()=>document.querySelector('input[type=checkbox]').click());assert.equal(button('Send setup link').disabled,true);available=true;});
  await t.test('verification checks token first and password mismatch stays on form',async()=>{await render(C.Activate,'/trial/activate#token='+'a'.repeat(64));assert.match(document.body.textContent,/Verified email.*owner@example.com/);assert.equal(calls.at(-1)[1],'/trial/inspect');assert.deepEqual(calls.at(-1)[2],{token:'a'.repeat(64)});assert.equal(button('Create company and start trial').disabled,true);await set('Company name','My Shop');assert.equal(field('Company code').value,'my-shop');await set('Your full name','Owner');await set('Company password','PrivateTrialPassword!');await set('Confirm password','WrongPassword!');await set('Your personal PIN','694821');await React.act(async()=>document.querySelector('input[type=checkbox]').click());const before=calls.length;await submit();assert.equal(calls.length,before);assert.match(document.body.textContent,/Passwords do not match/);});
  await t.test('activation removes fragment and exposes only company login',async()=>{await set('Confirm password','PrivateTrialPassword!');await submit();const a=calls.at(-1);assert.equal(a[1],'/trial/activate');assert.equal(a[2].code,'my-shop');assert.equal(a[2].currency,'USD');assert.equal(a[2].acceptedTerms,true);assert.equal(a[2].token,'a'.repeat(64));assert.ok(!Object.hasOwn(a[2],'confirmation'));assert.deepEqual(a[3],{anonymous:true});assert.equal(window.location.hash,'');assert.match(document.body.textContent,/my-shop@zindex.com/);assert.ok(!document.body.textContent.includes('PrivateTrialPassword!'));assert.equal(document.querySelector('input[type=password]'),null);assert.equal(sessionStorage.length,0);});
  await t.test('expired link offers fresh request and existing login',async()=>{badLink=true;await render(C.Activate,'/trial/activate#token='+'b'.repeat(64));assert.match(document.body.textContent,/invalid or expired/);assert.equal(document.querySelector('form'),null);assert.ok(document.querySelector('a[href="/trial"]'));assert.ok(document.querySelector('a[href="/login"]'));badLink=false;});
  await t.test('landing billing cards expose the savings and switch the selected price', async () => {
   await render(C.Landing, '/');
   const monthly = document.querySelector('button[aria-label="Monthly billing"]');
   const yearly = document.querySelector('button[aria-label="Yearly billing"]');
   const price = document.querySelector('.landing-price strong');
   assert.match(document.body.textContent, /No card required/);
   assert.equal(monthly.getAttribute('aria-pressed'), 'true');
   assert.match(yearly.textContent, /Save \$39\.89/);
   assert.equal(price.textContent, '$19.99');
   await React.act(async () => yearly.click());
   assert.equal(yearly.getAttribute('aria-pressed'), 'true');
   assert.equal(monthly.getAttribute('aria-pressed'), 'false');
   assert.equal(price.textContent, '$199.99');
   assert.equal(document.querySelector('s')?.textContent, '$239.88');
   assert.ok(document.querySelector('a[href="/trial"]'));
   await React.act(async () => monthly.click());
   assert.equal(document.querySelector('s'), null);
  });
  await t.test('public language dropdown opens, selects a language, and remembers it', async () => {
   await render(C.Landing, '/');
   const picker = document.querySelector('header button[aria-haspopup="menu"]');
   picker.getBoundingClientRect = () => new window.DOMRect(500, 20, 100, 40);
   assert.equal(picker.textContent, 'English');
   assert.equal(picker.getAttribute('aria-expanded'), 'false');
   assert.equal(document.querySelectorAll('[role="menuitemradio"]').length, 0);
   assert.ok(document.querySelector('header img[src="/brand-icon.svg"]'));
   assert.ok(document.querySelector('header nav a[href="/support"]'));
   assert.ok(document.querySelector('header nav a[href="/login"]'));
   await React.act(async () => picker.click());
   const menu = document.getElementById(picker.getAttribute('aria-controls'));
   const languages = menu.querySelectorAll('[role="menuitemradio"]');
   assert.deepEqual([...languages].map(option => option.lang), ['en', 'az', 'tr', 'ru']);
   assert.equal(picker.getAttribute('aria-expanded'), 'true');
   assert.equal(languages[0].getAttribute('aria-checked'), 'true');
   await React.act(async () => languages[1].click());
   assert.equal(picker.getAttribute('aria-expanded'), 'false');
   assert.equal(picker.textContent, 'Azərbaycanca');
   assert.equal(localStorage.getItem('z-index-language'), 'az');
   assert.equal(document.querySelector('h1').textContent, 'Stok, satış və müştəri balansları bir yerdə.');
   const price = document.querySelector('.landing-price strong');
   assert.equal(price.textContent, '50\u00a0AZN');
   const yearly = document.querySelectorAll('.landing-billing-option')[1];
   assert.match(yearly.textContent, /100\sAZN/);
   await React.act(async () => yearly.click());
   assert.equal(price.textContent, '500\u00a0AZN');
   assert.equal(document.querySelector('.landing-price-reference s').textContent, '600\u00a0AZN');
   await React.act(async () => picker.click());
   assert.equal(document.querySelector('[role="menuitemradio"][lang="az"]').getAttribute('aria-checked'), 'true');
   await React.act(async () => document.querySelector('[role="menuitemradio"][lang="en"]').click());
   assert.equal(picker.textContent, 'English');
   assert.equal(price.textContent, '$199.99');
  });
  await t.test('landing shows the active company claim only with confirmed counts',async()=>{
   await render(C.Landing,'/');
   assert.doesNotMatch(document.body.textContent,/active companies use z-Index/);
   activeCompanies=25;
   await render(C.Landing,'/');
   assert.match(document.body.textContent,/25 active companies use z-Index/);
   assert.doesNotMatch(document.body.textContent,/Example data/);
  });
  await t.test('trial countdown disappears after conversion',async()=>{await render(C.Banner);assert.match(document.body.textContent,/7 days remaining/);assert.ok(document.querySelector('a[href="/workspace/plan"]'));globalThis.__trialUser={role:'ADMIN',company:{trial:{...trial,status:'converted'}}};await render(C.Banner);assert.equal(document.getElementById('root').textContent,'');});
  await t.test('active trial can upgrade; active prepaid company cannot pay twice',async()=>{await render(C.Plan);assert.equal(field('Real billing email').value,'owner@example.com');assert.equal(button('Open secure checkout').disabled,false);assert.match(document.body.textContent,/Free trial active/);billing={...billing,company:{...billing.company,trial:null}};await render(C.Plan);assert.equal(button('Open secure checkout').disabled,true);assert.match(document.body.textContent,/prepaid plan is still active/);});
  await t.test('the local plan shows both AZN offers and the struck-through monthly total with checkout disabled', async () => {
   billing = {
    ...billing,
    enabled: false,
    company: {...billing.company, market: 'AZ', trial, subscriptionPrice: {currency: 'AZN', amountMinor: 5000}},
    offers: {currency: 'AZN', MONTHLY: 5000, YEARLY: 50000},
   };
   C.runtime.setLanguage('az');
   await render(C.Plan, '/workspace/plan');
   assert.match(document.body.textContent, /50\sAZN/);
   assert.match(document.body.textContent, /500\sAZN/);
   assert.equal(document.querySelector('s')?.textContent, '600\u00a0AZN');
   assert.doesNotMatch(document.body.textContent, /19[,.]99/);
   await React.act(async () => C.runtime.setLanguage('en'));
   assert.match(document.body.textContent, /AZN\s500/);
   assert.equal(button('Open secure checkout'), undefined);
  });
 }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();delete globalThis.__trialApi;delete globalThis.__trialUser;await fs.rm(folder,{recursive:true,force:true});}
});
