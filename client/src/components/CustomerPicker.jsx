import {useEffect,useState} from 'react';
import {Autocomplete,TextField} from '@mui/material';
import {api} from '../lib/api';
import {useI18n} from '../i18n/useI18n';
export default function CustomerPicker({value,onChange,disabled=false}){
 const {t}=useI18n();const [search,setSearch]=useState(''),[options,setOptions]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();const timer=setTimeout(async()=>{setBusy(true);try{const r=await api.get('/customers/lookup',{params:{search,limit:20},signal:controller.signal});if(active){setOptions(r.data.customers||[]);setError('');}}catch(e){if(active)setError(e.response?.data?.message||t('Could not load customers.'));}finally{if(active)setBusy(false);}},200);return()=>{active=false;clearTimeout(timer);controller.abort();};},[search,t]);
 return <Autocomplete value={value} options={value&&!options.some(c=>c.id===value.id)?[value,...options]:options} loading={busy} disabled={disabled} filterOptions={x=>x} getOptionLabel={c=>[c.name,c.salon,c.phone].filter(Boolean).join(' · ')} isOptionEqualToValue={(a,b)=>a.id===b.id} onChange={(_,c)=>onChange(c)} onInputChange={(_,text,reason)=>{if(reason==='input'||reason==='clear')setSearch(text);}} noOptionsText={t('No customers found.')} renderInput={params=><TextField {...params} label={t('Find customer')} error={!!error} helperText={error||t('Search by name, phone or business.')}/>}/>;
}
