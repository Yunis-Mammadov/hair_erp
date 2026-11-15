import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveApiUrl} from '../src/lib/api-url.mjs';
test('F06 clean builds use same-origin API; explicit existing installations keep their URL',()=>{
 for(const input of [undefined,null,'',' '])assert.equal(resolveApiUrl(input),'/api');
 assert.equal(resolveApiUrl('http://localhost:7079/api/'),'http://localhost:7079/api');
 assert.equal(resolveApiUrl('https://erp.example.com/api'),'https://erp.example.com/api');
 assert.equal(resolveApiUrl('/backend/api'),'/backend/api');
 for(const input of ['javascript:alert(1)','ftp://erp.example.com','https://user:pass@erp.example.com/api','https://erp.example.com/api?token=secret','//evil.example/api'])assert.throws(()=>resolveApiUrl(input));
});
