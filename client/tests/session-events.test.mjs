import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFailure as fail } from '../src/lib/session-events.mjs';
const config=(url='/stock',token='current')=>({url,headers:{authorization:'Bearer '+token}});
test('current session 401 and inactive subscription request logout',()=>{assert.equal(fail(config(),401,{},'current'),true);assert.equal(fail(config(),403,{code:'SUBSCRIPTION_INACTIVE'},'current'),true);});
test('ordinary role and price rejection keep a valid session',()=>{assert.equal(fail(config(),403,{code:'PRICE_PERMISSION'},'current'),false);});
test('old in-flight responses cannot invalidate a newly signed-in session',()=>{assert.equal(fail(config('/stock','old'),401,{},'new'),false);});
test('company login and PIN failure cannot invalidate the browser session',()=>{for(const url of ['/auth/company-login','/auth/pin-login'])assert.equal(fail(config(url),401,{},'current'),false);});
test('header names are case insensitive and anonymous responses cannot log out',()=>{assert.equal(fail({url:'/stock',headers:{AUTHORIZATION:'Bearer current'}},401,{},'current'),true);assert.equal(fail({url:'/stock',headers:{}},401,{},'current'),false);});
