import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,MenuItem,Stack,TextField,Typography} from '@mui/material';
import {resolveApiUrl} from '../lib/api-url.mjs';
import {useI18n} from '../i18n/useI18n';
import {customMonthlyPriceMinor} from '../lib/subscription-pricing.mjs';
import {RecordPager} from './RecordsTools';
const api=axios.create({baseURL:resolveApiUrl(import.meta.env.VITE_API_URL),timeout:30000});
export default function OperatorCompanyAction({company,kind,secret,onClose,onSaved}){
 const {t,date}=useI18n(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState({password:'',reason:'',endsOn:company.endsOn||'',subscriptionType:company.subscriptionType==='CUSTOM'?'CUSTOM':company.billingCycle,customPrice:company.customMonthlyPriceMinor!=null?String(company.customMonthlyPriceMinor/100):''}),[events,setEvents]=useState(null),[page,setPage]=useState(1);const retry=useRef(null);
 const customPrice=form.subscriptionType==='CUSTOM'?customMonthlyPriceMinor(form.customPrice):null;
 const invalidCustomPrice=kind==='subscription'&&form.subscriptionType==='CUSTOM'&&customPrice===null;
 const title={password:'Reset company password',subscription:'Extend subscription',status:company.operatorSuspended||!company.isActive?'Activate company':'Deactivate company',audit:'Company history'}[kind];
 useEffect(()=>{if(kind!=='audit')return;let live=true;api.get(`/operator/companies/${company.id}/audit`,{headers:{Authorization:`Bearer ${secret}`},params:{page,limit:10}}).then(r=>{if(live)setEvents(r.data);}).catch(e=>{if(live)setError(e.response?.data?.message||t('Could not load history.'));});return()=>{live=false;};},[kind,company.id,secret,page,t]);
 async function save(e){e.preventDefault();if(busy||invalidCustomPrice)return;setBusy(true);setError('');const input={reason:form.reason,expectedAuthVersion:company.authVersion,...(kind==='password'?{password:form.password}:kind==='subscription'?{endsOn:form.endsOn,billingCycle:form.subscriptionType==='YEARLY'?'YEARLY':'MONTHLY',customMonthlyPriceMinor:customPrice}:{isActive:company.operatorSuspended||!company.isActive})};const payload=JSON.stringify(input);if(retry.current?.payload!==payload)retry.current={payload,key:crypto.randomUUID()};try{await api.request({url:`/operator/companies/${company.id}/${kind}`,method:kind==='password'?'post':'patch',data:input,headers:{Authorization:`Bearer ${secret}`,'Idempotency-Key':retry.current.key}});onSaved();onClose();}catch(e){setError(e.response?.data?.message||t('Could not save changes.'));}finally{setBusy(false);}}
 return <Dialog open fullWidth maxWidth="sm" onClose={()=>{if(!busy)onClose();}}><Box component="form" onSubmit={save}><DialogTitle>{t(title)} · {company.name}</DialogTitle><DialogContent dividers><Stack spacing={2}>
 {error&&<Alert severity="error">{error}</Alert>}
 {kind==='audit'?<>{events?.events.map(e=><Box key={e.id} sx={{p:2,border:'1px solid',borderColor:'divider',borderRadius:2}}><Typography fontWeight={600}>{t(e.action)}</Typography><Typography variant="caption">{date(e.createdAt)}</Typography><Typography variant="body2" sx={{mt:1,whiteSpace:'pre-wrap'}}>{e.reason}</Typography>{e.before.endsAt!==e.after.endsAt&&<Typography variant="caption">{t('Expires')}: {date(e.before.endsAt,false)} → {date(e.after.endsAt,false)}</Typography>}</Box>)}{events&&!events.events.length&&<Typography>{t('No revisions yet.')}</Typography>}<RecordPager pagination={events?.pagination} onChange={setPage}/></>:<>
 <Alert severity="warning">{t('This action revokes the company sessions. Record a reason before continuing.')}</Alert>
 {kind==='password'&&<TextField label={t('New company password')} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required disabled={busy} autoComplete="new-password" inputProps={{minLength:12,maxLength:72}}/>}
 {kind==='subscription'&&<>
  <TextField type="date" label={t('Last subscription day')} value={form.endsOn} onChange={e=>setForm(f=>({...f,endsOn:e.target.value}))} required disabled={busy} slotProps={{inputLabel:{shrink:true}}}/>
  <TextField select label={t('Subscription type')} value={form.subscriptionType} onChange={e=>setForm(f=>({...f,subscriptionType:e.target.value}))} disabled={busy}>
   <MenuItem value="MONTHLY">{t('Monthly billing')}</MenuItem>
   <MenuItem value="YEARLY">{t('Yearly billing')}</MenuItem>
   {company.market==='AZ'&&<MenuItem value="CUSTOM">{t('Custom monthly plan')}</MenuItem>}
  </TextField>
  {form.subscriptionType==='CUSTOM'&&<TextField label={t('Custom monthly price (AZN)')} value={form.customPrice} onChange={e=>setForm(f=>({...f,customPrice:e.target.value}))}
   required disabled={busy} error={Boolean(form.customPrice)&&invalidCustomPrice} slotProps={{htmlInput:{inputMode:'decimal',maxLength:11}}}/>}
  <Typography variant="caption">{t('Extending access does not charge a card or record a subscription payment.')}</Typography>
 </>}
 {kind==='status'&&<Typography>{t(company.operatorSuspended||!company.isActive?'An expired subscription must be extended before activation.':'Deactivation blocks company sign-in and access, including previously signed image links.')}</Typography>}
 <TextField label={t('Reason')} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required multiline minRows={2} disabled={busy} inputProps={{minLength:3,maxLength:300}}/>
 </>}
 </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>{t('Close')}</Button>{kind!=='audit'&&<Button type="submit" variant="contained" disabled={busy||invalidCustomPrice||form.reason.trim().length<3}>{busy?t('Saving...'):t('Confirm')}</Button>}</DialogActions></Box></Dialog>;
}
