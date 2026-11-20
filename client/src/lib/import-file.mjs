import { parseCSV } from './csv.mjs';
export const customerFields=['externalId','name','phone','salon','address','lat','lng','openingDebt','openingCredit','balanceDate','currency'];
export const productFields=['name','category','sku','barcode','salePrice','quantity','unit','currency'];
const aliases={externalId:['customerid','musterikodu','musteriid','кодклиента'],name:['customer','customername','musteri','musteriadi','ad','isim','имя','клиент'],phone:['telephone','telefon','telefonnomresi','номер','телефон'],salon:['businessname','magaza','mağaza','магазин','салон'],address:['unvan','adres','адрес'],openingDebt:['debt','borc','ilkinborc','baslangicborcu','долг','начальныйдолг'],openingCredit:['credit','kredit','avans','ilkinavans','кредит','аванс'],balanceDate:['asof','tarix','ilkinbalanstarixi','tarih','дата'],currency:['valyuta','parabirimi','валюта'],category:['kateqoriya','kategori','категория']};
const key=v=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ə/g,'e').replace(/[^\p{L}\p{N}]/gu,'');
export function guessMapping(headers,fields=customerFields){return Object.fromEntries(headers.map(h=>[h,fields.find(f=>key(f)===key(h)||(aliases[f]||[]).some(a=>key(a)===key(h)))||'']));}
export function mapRows(rows,mapping,{currency='',balanceDate=''}={}){
 const selected=Object.values(mapping).filter(v=>v&&v!=='__ignore__');
 if(Object.values(mapping).some(v=>!v))throw new Error('Map or ignore every column.');
 if(new Set(selected).size!==selected.length||!selected.includes('name'))throw new Error('Map the name column once; each target field can only be used once.');
 return rows.map((row,i)=>{const out={};for(const [column,field] of Object.entries(mapping))if(field!=='__ignore__'){
  let v=row[column];
  if(['phone','externalId','sku','barcode'].includes(field)&&typeof v==='number')throw new Error(`Row ${i+2}: ${field} must be a text cell in Excel to preserve leading zeros.`);
  if(v instanceof Date)v=v.toISOString().slice(0,10);
  if(typeof v==='string'&&/^[=]/.test(v))throw new Error(`Row ${i+2}: formulas are not supported. Paste values instead.`);
  out[field]=v==null?'':v;
 }if(currency&&!out.currency)out.currency=currency;if(balanceDate&&!out.balanceDate)out.balanceDate=balanceDate;return out;});
}
export function tableRows(data){
 const rows=data.filter(row=>row.some(v=>v!=null&&v!==''));if(rows.length<2||rows.length>201)throw new Error('A sheet must contain 1–200 data rows.');
 const headers=rows.shift().map(h=>String(h??'').trim());
 if(headers.length>40||headers.some(h=>!h||['__proto__','constructor','prototype'].includes(h))||new Set(headers).size!==headers.length)throw new Error('Invalid or duplicate column headers.');
 return rows.map(row=>{if(row.length>headers.length&&row.slice(headers.length).some(v=>v!=null))throw new Error('Data extends past the header columns.');return Object.fromEntries(headers.map((h,i)=>[h,row[i]??'']));});
}
// Reject oversized compressed workbooks before decompression. No ZIP64, encryption or macros.
export function checkWorkbook(buffer){
 const v=new DataView(buffer);let end=-1;
 for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Invalid XLSX file.');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);if(count>1000||count===65535)throw new Error('Workbook is too large.');
 let total=0,p=offset;
 for(let i=0;i<count;i++){
  if(p+46>v.byteLength||v.getUint32(p,true)!==0x02014b50)throw new Error('Invalid XLSX directory.');
  const flags=v.getUint16(p+8,true),size=v.getUint32(p+24,true),n=v.getUint16(p+28,true),x=v.getUint16(p+30,true),c=v.getUint16(p+32,true);
  total+=size;if(flags&1||size===0xffffffff||total>20000000||p+46+n+x+c>v.byteLength)throw new Error('Workbook exceeds the safe size limit.');
  const name=new TextDecoder().decode(new Uint8Array(buffer,p+46,n));if(/vbaProject|\.bin$/i.test(name))throw new Error('Macro workbooks are not supported.');p+=46+n+x+c;
 }
}
export async function readWorkbook(buffer){
 checkWorkbook(buffer);
 const {unzipSync,strFromU8}=await import('fflate');
 const files=unzipSync(new Uint8Array(buffer));
 for(const [name,bytes]of Object.entries(files))if(/\.xml$/i.test(name)&&/<(?:\w+:)?f(?:\s|\/?>)/.test(strFromU8(bytes)))throw new Error('Excel formulas are not supported. Copy and paste values before importing.');
 const {default:read}=await import('read-excel-file/universal');
 const sheets=await read(buffer);
 return sheets.map(s=>{try{return {name:s.sheet,rows:tableRows(s.data)};}catch(error){return {name:s.sheet,rows:[],error:error.message};}});
}
export async function readImportFile(file){
 if(file.size>1000000)throw new Error('Import file must be smaller than 1 MB.');
 if(/\.csv$/i.test(file.name))return [{name:file.name,rows:parseCSV(await file.text())}];
 if(!/\.xlsx$/i.test(file.name))throw new Error('Choose an XLSX or CSV file. Old XLS files must be saved as XLSX.');
 const buffer=await file.arrayBuffer();
 if(typeof Worker==='undefined')return readWorkbook(buffer);
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./import-worker.js',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('Workbook took too long to read.'));},15000);const done=()=>{clearTimeout(timer);worker.terminate();};worker.onmessage=e=>{done();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.sheets);};worker.onerror=()=>{done();reject(new Error('Could not read Excel file.'));};worker.postMessage(buffer,[buffer]);});
}
