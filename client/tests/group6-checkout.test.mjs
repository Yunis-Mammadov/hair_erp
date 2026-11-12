import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkoutTransaction,initializeCheckout} from '../src/lib/paddle-checkout.mjs';
test('checkout only accepts a provider transaction ID and ignores arbitrary URLs',()=>{
 const id='txn_'+'a'.repeat(26);assert.equal(checkoutTransaction('?_ptxn='+id),id);assert.equal(checkoutTransaction('?_ptxn=https://evil.example'),null);assert.equal(checkoutTransaction('?_ptxn=txn_short'),null);assert.equal(checkoutTransaction(''),null);
});
test('checkout initializes once with a public token and sandbox before checkout',async()=>{
 const calls=[];globalThis.window={Paddle:{Environment:{set:value=>calls.push(['environment',value])},Initialize:config=>calls.push(['initialize',config.token])}};
 await initializeCheckout({environment:'sandbox',clientToken:'test_public'});await initializeCheckout({environment:'sandbox',clientToken:'test_public'});assert.deepEqual(calls,[['environment','sandbox'],['initialize','test_public']]);await assert.rejects(initializeCheckout({clientToken:'pdl_private_api_key'}),/UNCONFIGURED/);
});
