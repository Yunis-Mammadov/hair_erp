import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {parseCSV} from '../src/lib/csv.mjs';import {guessMapping,mapRows,readImportFile,readWorkbook,checkWorkbook} from '../src/lib/import-file.mjs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
test('semicolon and tab CSV retain decimal commas, text identifiers and multiline cells',()=>{
 const rows=parseCSV('\uFEFFMüştəri adı;Telefon;Borc;Valyuta\r\n"Demo; Store";001234567;125,50;USD');
 const map=guessMapping(Object.keys(rows[0]));assert.equal(map['Borc'],'openingDebt');assert.deepEqual(mapRows(rows,map,{balanceDate:'2026-01-01'})[0],{name:'Demo; Store',phone:'001234567',openingDebt:'125,50',currency:'USD',balanceDate:'2026-01-01'});
 assert.equal(parseCSV('name\tphone\nDemo\t001234567')[0].phone,'001234567');
});
test('all columns need an explicit mapping; duplicate targets and numeric Excel IDs fail',()=>{
 assert.throws(()=>mapRows([{name:'Demo',debt:500}],{name:'name',debt:''}));
 assert.throws(()=>mapRows([{a:'A',b:'B'}],{a:'name',b:'name'}));
 assert.throws(()=>mapRows([{name:'Demo',phone:1234567}],{name:'name',phone:'phone'}));
 assert.deepEqual(mapRows([{name:'Demo',unknown:20}],{name:'name',unknown:'__ignore__'}),[{name:'Demo'}]);
});
async function workbook(){const b=await fs.readFile(new URL('../public/examples/customers-opening-example.xlsx',import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
test('real XLSX preserves text IDs, numeric cents and typed Excel dates',async()=>{
 const sheets=await readWorkbook(await workbook());assert.equal(sheets[0].name,'Customers');const mapped=mapRows(sheets[0].rows,guessMapping(Object.keys(sheets[0].rows[0])));assert.deepEqual(mapped,JSON.parse(await fs.readFile(new URL('../../shared/fixtures/customer-import-example.json',import.meta.url),'utf8')));const row=mapped[0];assert.equal(row.externalId,'0001');assert.equal(row.phone,'+12125550123');assert.equal(row.openingDebt,125.5);assert.equal(row.balanceDate,'2026-01-01');assert.equal(row.currency,'USD');
});
test('workbook formulas and oversized compressed payloads are refused',async()=>{
 const files=unzipSync(new Uint8Array(await workbook()));const name=Object.keys(files).find(n=>/worksheets\/sheet.*xml$/.test(n));files[name]=strToU8(strFromU8(files[name]).replace(/<(?:\w+:)?sheetData>/,'<sheetData><row r="99"><c r="A99"><f>1+1</f><v>2</v></c></row>'));
 const bad=zipSync(files);await assert.rejects(readWorkbook(bad.buffer),/formulas/);
 assert.throws(()=>checkWorkbook(new ArrayBuffer(2)),/Invalid/);
 const bytes=new Uint8Array(await workbook()),view=new DataView(bytes.buffer);let central;for(let i=0;i<bytes.length-4;i++)if(view.getUint32(i,true)===0x02014b50){central=i;break;}view.setUint32(central+24,21000000,true);assert.throws(()=>checkWorkbook(bytes.buffer),/size limit/);
 await assert.rejects(readImportFile({name:'legacy.xls',size:10}),/XLSX/);await assert.rejects(readImportFile({name:'huge.xlsx',size:1000001}),/1 MB/);
});
