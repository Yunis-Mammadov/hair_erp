import {useAuth} from '../features/auth/useAuth';
import {draftKey,readDraft,writeDraft,clearDraft,clearRejectedDraft,sameDraftBody} from '../lib/pending-draft.mjs';
import {useEffect,useRef,useState} from 'react';
import {Alert,Box,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,MenuItem,Stack,TextField,Typography} from '@mui/material';
import {api} from '../lib/api';
import {amountValue} from '../lib/money-input.mjs';
import {today} from '../i18n/runtime';
import {useI18n} from '../i18n/useI18n';
import {RecordPager} from './RecordsTools';
export default function LedgerDialog({kind='payment',customer,payment,order,onClose,onSaved}){
 const {t,money}=useI18n(),{user}=useAuth();const pendingKey=draftKey(user,kind,`${customer.id}:${order?.id||payment?.id||''}`),[pending]=useState(()=>readDraft(pendingKey));const [amount,setAmount]=useState(pending?.amount!=null?String(pending.amount):''),[method,setMethod]=useState(pending?.paymentType||pending?.method||'CASH'),[note,setNote]=useState(pending?.note||pending?.reason||''),[date,setDate]=useState(pending?.date||today()),[limit,setLimit]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState(null),[track,setTrack]=useState(!!pending?.soldItems?.length),[page,setPage]=useState(1),[products,setProducts]=useState(null),[quantities,setQuantities]=useState(Object.fromEntries((pending?.soldItems||[]).map(x=>[x.productId,x.quantity])));const receipt=useRef(pending?.imageUrl||null);const [hasReceipt,setHasReceipt]=useState(!!pending?.imageUrl);
 useEffect(()=>{let active=true;if(kind==='void')return;api.get(`/customers/${customer.id}/summary`).then(r=>{if(active)setLimit(kind==='refund'?r.data.summary.credit:Math.min(r.data.summary.debt,order?.remainingDebt??Infinity));}).catch(e=>{if(active)setError(e.response?.data?.message||t('Could not load customer balance.'));});return()=>{active=false;};},[customer.id,kind,order?.remainingDebt,t]);
 useEffect(()=>{if(!track)return;let active=true;api.get(`/customers/${customer.id}/returnable-products`,{params:{page,limit:20}}).then(r=>{if(active)setProducts(r.data);}).catch(e=>{if(active)setError(e.response?.data?.message||t('Could not load products.'));});return()=>{active=false;};},[customer.id,track,page,t]);
 async function submit(e){e.preventDefault();if(busy)return;const value=amountValue(amount);
 let body=kind==='void'?{reason:note.trim()}:kind==='refund'?{customerId:customer.id,amount:value,method,note:note.trim()}:{customerId:customer.id,...(order?{orderId:order.id}:{}),amount:value,paymentType:method,note:note.trim(),date,imageUrl:receipt.current||null,soldItems:track?Object.entries(quantities).filter(([,q])=>Number(q)>0).map(([productId,quantity])=>({productId,quantity:Number(quantity)})):[]};
 const retrying=!file&&sameDraftBody(pending,body);
 if(kind!=='void'&&(!Number.isFinite(value)||value<=0||(!retrying&&(limit==null||value>limit)))){setError(t('Enter an amount within the available balance.'));return;}if(kind!=='payment'&&note.trim().length<3){setError(t('Enter a reason of at least three characters.'));return;}

 if(track&&Object.values(quantities).some(value=>value!==''&&(!/^\d+$/.test(String(value))||Number(value)<0))){setError(t('Check quantities, prices and available stock.'));return;}
 setBusy(true);setError('');let result;
 try{
  if(file&&!receipt.current){const form=new FormData();form.append('file',file);receipt.current=(await api.post('/uploads',form)).data.file.url;setHasReceipt(true);}
  if(kind==='payment')body.imageUrl=receipt.current||null;
  writeDraft(pendingKey,body);
  result=(await api.post(kind==='void'?`/payments/${payment.id}/void`:kind==='refund'?'/payments/refunds':'/payments',body)).data;clearDraft(pendingKey);
 }catch(e){clearRejectedDraft(pendingKey,e.response?.status);setError(e.response?.data?.message||t('Could not save the operation.'));setBusy(false);return;}
 setBusy(false);onClose();if(onSaved)Promise.resolve(onSaved(result)).catch(()=>{});
 }
 const title=kind==='void'?t('Void payment'):kind==='refund'?t('Refund customer credit'):t('Record payment');
 return <Dialog open onClose={()=>{if(!busy)onClose();}} fullWidth maxWidth="sm"><Box component="form" onSubmit={submit}><DialogTitle>{title}</DialogTitle><DialogContent dividers><Stack spacing={2.5}><Typography fontWeight={600}>{customer.name}{order?' · '+(order.invoiceNumber||order.orderNumber):''}</Typography>{pending&&<Alert severity="info">{t("A previous attempt was restored. Check history before changing it, or retry it unchanged.")}</Alert>}{error&&<Alert severity="error">{error}</Alert>}
 {kind==='void'?<Alert severity="warning">{t('Voiding keeps the original payment and recalculates the customer balance.')}<br/>{money(payment.amount)}</Alert>:<><Alert severity="info">{kind==='refund'?t('Available credit'):t('Available balance')}: {limit==null?'…':money(limit)}</Alert><TextField label={t('Amount')} value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} inputProps={{inputMode:'decimal'}} required helperText={limit>0?<Button size="small" disabled={busy} onClick={()=>setAmount(String(limit))}>{t('Use full balance')}</Button>:null}/><TextField select label={t('Payment method')} value={method} disabled={busy} onChange={e=>setMethod(e.target.value)}>{['CASH','BANK','CARD'].map(x=><MenuItem key={x} value={x}>{t(x)}</MenuItem>)}</TextField></>}
 {kind==='payment'&&<TextField label={t('Payment date')} type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy} required slotProps={{inputLabel:{shrink:true}}}/>}
 <TextField label={kind==='payment'?t('Note (optional)'):t('Reason')} value={note} onChange={e=>setNote(e.target.value)} required={kind!=='payment'} disabled={busy} multiline minRows={2} inputProps={{maxLength:300}}/>
 {kind==='payment'&&<>{!file&&hasReceipt&&<Alert severity="info">{t('The previously uploaded receipt is retained for this retry.')}</Alert>}<Button component="label" variant="outlined" disabled={busy}>{file?file.name:hasReceipt?t('Replace receipt photo'):t('Attach receipt photo')}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setFile(e.target.files?.[0]||null);receipt.current=null;setHasReceipt(false);}}/></Button>{file&&<Button disabled={busy} onClick={()=>{setFile(null);receipt.current=null;setHasReceipt(false);}}>{t('Remove photo')}</Button>}
 <FormControlLabel control={<Checkbox checked={track} disabled={busy} onChange={e=>setTrack(e.target.checked)}/>} label={t('Record products covered (optional)')}/>
 {track&&<Stack spacing={1}>{(products?.products||[]).map(p=><Stack key={p.productId} direction="row" spacing={1} alignItems="center"><Typography sx={{flex:1}}>{p.productName}<br/><small>{t('Available: {quantity}',{quantity:p.returnableQty})}</small></Typography><TextField size="small" type="number" value={quantities[p.productId]||''} onChange={e=>setQuantities(q=>({...q,[p.productId]:e.target.value}))} disabled={busy} inputProps={{min:0,max:p.returnableQty,step:1,'aria-label':p.productName}} sx={{width:90}}/></Stack>)}<RecordPager pagination={products?.pagination} onChange={setPage} disabled={busy}/></Stack>}</>}
 </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button type="submit" variant="contained" color={kind==='void'?'error':'primary'} disabled={busy||(kind!=='void'&&(limit==null||limit<=0)&&!pending)}>{busy?t('Saving...'):title}</Button></DialogActions></Box></Dialog>;
}
