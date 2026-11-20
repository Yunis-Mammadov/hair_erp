import {useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,IconButton,Stack,TextField,Typography} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {api} from '../lib/api';
import {useI18n} from '../i18n/useI18n';
import {today} from '../i18n/runtime';
import {amountValue} from '../lib/money-input.mjs';
import {chargeTotals,quantityStep} from '../lib/quantities.mjs';
import CatalogPicker from './CatalogPicker';
const formOf=p=>({supplier:p.supplier||'',invoiceNo:p.invoiceNo||'',note:p.note||'',purchaseDate:p.purchaseDate.slice(0,10),reason:'',items:p.items.map(i=>({productId:i.productId,name:i.productName||i.product?.name||'—',unit:i.product?.unit||'PIECE',quantity:String(i.quantity),unitCost:String(i.unitCost)}))});
export default function PurchaseManageDialog({purchase,mode,onClose,onSaved}){
 const {t,money}=useI18n(),voiding=mode==='void';
 const [record,setRecord]=useState(purchase),[form,setForm]=useState(()=>formOf(purchase));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[picker,setPicker]=useState(false);
 const update=(index,key,value)=>setForm(f=>({...f,items:f.items.map((i,n)=>n===index?{...i,[key]:value}:i)}));
 async function reload(){setBusy(true);try{const r=await api.get(`/purchases/${record.id}`);if(r.data.purchase.voidedAt){onSaved();onClose();return;}setRecord(r.data.purchase);setForm(formOf(r.data.purchase));setError('');}catch(e){setError(e.response?.data?.message||t('Could not load document.'));}finally{setBusy(false);}}
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{
  const base={expectedVersion:record.version,reason:form.reason};
  if(voiding)await api.post(`/purchases/${record.id}/void`,base);else await api.patch(`/purchases/${record.id}`,{...base,supplier:form.supplier,invoiceNo:form.invoiceNo,note:form.note,purchaseDate:form.purchaseDate,items:form.items.map(i=>({productId:i.productId,quantity:i.quantity,unitCost:i.unitCost}))});
  onSaved();onClose();
 }catch(e){setError(e.response?.data?.message||t('Could not save purchase changes.'));}finally{setBusy(false);}}
 let total;try{total=chargeTotals(form.items.map(i=>({quantity:Number(i.quantity),unitPrice:amountValue(i.unitCost)}))).total;}catch{total=null;}
 return <Dialog open fullWidth maxWidth="md" onClose={()=>{if(!busy)onClose();}}><Box component="form" onSubmit={submit}><DialogTitle>{t(voiding?'Void purchase':'Edit purchase')}</DialogTitle><DialogContent dividers><Stack spacing={2}>
 {error&&<Alert severity="error" action={<Button disabled={busy} onClick={reload}>{t('Reload')}</Button>}>{error}</Alert>}
 <Alert severity={voiding?'warning':'info'}>{t(voiding?'Voiding keeps the original document and reverses its stock receipt. It is blocked if that stock is no longer available.':'Changes are recorded in history. Stock is adjusted by the difference; amounts are recalculated by the server.')}</Alert>
 {!voiding&&<>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField label={t('Supplier')} value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} required fullWidth disabled={busy} inputProps={{maxLength:150}}/><TextField type="date" label={t('Purchase date')} value={form.purchaseDate} onChange={e=>setForm(f=>({...f,purchaseDate:e.target.value}))} required disabled={busy} slotProps={{inputLabel:{shrink:true}}} inputProps={{max:today()}}/></Stack>
 <TextField label={t('Invoice number')} value={form.invoiceNo} onChange={e=>setForm(f=>({...f,invoiceNo:e.target.value}))} disabled={busy} inputProps={{maxLength:100}}/>
 <TextField label={t('Note')} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} multiline disabled={busy} inputProps={{maxLength:1000}}/>
 {form.items.map((i,index)=><Stack key={i.productId} direction={{xs:'column',sm:'row'}} spacing={1} alignItems={{sm:'center'}}><Typography sx={{flex:1,fontSize:13}}>{i.name}</Typography><TextField label={t('Quantity')} value={i.quantity} onChange={e=>update(index,'quantity',e.target.value)} disabled={busy} type="number" inputProps={{min:quantityStep(i.unit),step:quantityStep(i.unit)}} sx={{width:{sm:130}}}/><TextField label={t('Unit cost')} value={i.unitCost} onChange={e=>update(index,'unitCost',e.target.value)} disabled={busy} inputProps={{inputMode:'decimal'}} sx={{width:{sm:150}}}/><IconButton aria-label={t('Remove')} disabled={busy} onClick={()=>setForm(f=>({...f,items:f.items.filter((_,n)=>n!==index)}))}><DeleteOutlineIcon/></IconButton></Stack>)}
 <Button disabled={busy||form.items.length>=100} onClick={()=>setPicker(p=>!p)}>{t('Add product')}</Button>
 {picker&&<CatalogPicker requireStock={false} canGift={false} disabled={busy} onAdd={product=>{if(form.items.some(i=>i.productId===product.id)){setError(t('This product is already in the purchase.'));return;}setForm(f=>({...f,items:[...f.items,{productId:product.id,name:product.name,unit:product.unit,quantity:'1',unitCost:'0'}]}));setPicker(false);}}/>}
 <Typography fontWeight={600}>{t('Total')}: {total===null?'—':money(total)}</Typography>
 </>}
 <TextField label={t('Reason')} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required multiline minRows={2} disabled={busy} inputProps={{minLength:3,maxLength:300}}/>
 </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button type="submit" color={voiding?'error':'primary'} variant="contained" disabled={busy||form.reason.trim().length<3||(!voiding&&!form.items.length)}>{busy?t('Saving...'):t(voiding?'Void purchase':'Save')}</Button></DialogActions></Box></Dialog>;
}
