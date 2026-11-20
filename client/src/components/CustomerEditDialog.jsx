import {useEffect,useMemo,useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,MenuItem,Stack,TextField} from '@mui/material';
import AddressMapPickerDialog from './AddressMapPickerDialog';
import {useI18n} from '../i18n/useI18n';
import {api} from '../lib/api';
const formOf=c=>({name:c.name||'',phone:c.phone||'',salon:c.salon||'',address:c.address||'',lat:c.lat??'',lng:c.lng??'',areaId:c.areaId||''});
export default function CustomerEditDialog({customer,onClose,onSaved}){
 const {t}=useI18n(),[record,setRecord]=useState(customer),[form,setForm]=useState(()=>formOf(customer)),[areas,setAreas]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[map,setMap]=useState(false);
 const position=useMemo(()=>form.lat!==''&&form.lng!==''?{lat:Number(form.lat),lng:Number(form.lng)}:null,[form.lat,form.lng]);
 useEffect(()=>{const c=new AbortController();api.get('/areas',{signal:c.signal}).then(r=>setAreas(Array.isArray(r.data)?r.data:r.data.areas||[])).catch(()=>{});return()=>c.abort();},[]);
 const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function reload(){setBusy(true);try{const r=await api.get(`/customers/${customer.id}/profile`);setRecord(r.data.customer);setForm(formOf(r.data.customer));setError('');}catch(e){setError(e.response?.data?.message||t('Could not load customer history.'));}finally{setBusy(false);}}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{
  const lat=form.lat===''?null:Number(form.lat),lng=form.lng===''?null:Number(form.lng);
  if((lat===null)!==(lng===null)||(lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)))throw Error(t('Choose valid coordinates for both latitude and longitude.'));
  await api.patch(`/customers/${customer.id}/contact`,{...form,areaId:form.areaId||null,lat,lng,expectedUpdatedAt:record.updatedAt});onSaved();onClose();
 }catch(err){setError(err.response?.data?.message||err.message);}finally{setBusy(false);}}
 const choices=areas.some(a=>a.id===record.areaId)||!record.area?areas:[record.area,...areas];
 return <><Dialog open fullWidth maxWidth="sm" onClose={()=>{if(!busy)onClose();}}><Box component="form" onSubmit={save}><DialogTitle>{t('Edit customer')}</DialogTitle><DialogContent dividers><Stack spacing={2}>
 {error&&<Alert severity="error" action={<Button disabled={busy} onClick={reload}>{t('Reload')}</Button>}>{error}</Alert>}
 <Alert severity="info">{t('Contact changes do not rewrite past invoices, payments or opening balances.')}</Alert>
 {[['name','Customer name'],['phone','Telefon'],['salon','Salon / store'],['address','Ünvan']].map(([key,label])=><TextField key={key} label={t(label)} value={form[key]} onChange={e=>change(key,e.target.value)} fullWidth required={key==='name'} disabled={busy} multiline={key==='address'} minRows={key==='address'?2:undefined} inputProps={{maxLength:key==='address'?500:key==='phone'?80:150}}/>)}
 <TextField select label={t('Area')} value={form.areaId} onChange={e=>change('areaId',e.target.value)} disabled={busy}><MenuItem value="">—</MenuItem>{choices.map(a=><MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
 <Stack direction="row" spacing={2}>{[['lat','Latitude'],['lng','Longitude']].map(([key,label])=><TextField key={key} label={t(label)} value={form[key]} onChange={e=>change(key,e.target.value)} disabled={busy} fullWidth inputProps={{inputMode:'decimal'}}/>)}</Stack>
 <Stack direction="row" spacing={1}><Button disabled={busy} onClick={()=>setMap(true)}>{t('Open map')}</Button><Button disabled={busy} onClick={()=>setForm(f=>({...f,lat:'',lng:''}))}>{t('Clear location')}</Button></Stack>
 </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button type="submit" variant="contained" disabled={busy}>{busy?t('Saving...'):t('Save')}</Button></DialogActions></Box></Dialog>
 {map&&<AddressMapPickerDialog open initialPosition={position} onClose={()=>setMap(false)} onSelect={p=>{setForm(f=>({...f,lat:p.lat,lng:p.lng,address:p.address||f.address}));setMap(false);}}/>}</>;
}
