import { Link as RouterLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { PageLayout, PageHeader, PageCard } from "../components/WorkspaceUI";
import { useAuth } from "../features/auth/useAuth";
import { api } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
const fields = [["name","Company name"],["address","Company address"],["phone","Company phone"],["supportEmail","Contact email"],["taxId","Tax ID"],["invoicePrefix","Invoice prefix"]];
const zones=["UTC","Asia/Baku","Europe/Istanbul","Europe/Moscow","Europe/London","Europe/Berlin","Europe/Paris","Europe/Warsaw","America/New_York","America/Chicago","America/Los_Angeles","Asia/Dubai","Asia/Almaty","Australia/Sydney"];
export default function SettingsPage() {
  const { t, money, date }=useI18n(), {user,setUser}=useAuth();
  const [record,setRecord]=useState(null),[form,setForm]=useState({}),[error,setError]=useState(""),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
  const admin=user?.role==="ADMIN";
  useEffect(()=>{let active=true;api.get('/workspace/settings').then(({data})=>{if(active){setRecord(data);setForm(data.company);}}).catch(e=>{if(active)setError(e.response?.data?.message||t("Could not load company settings."));});return()=>{active=false;};},[t]);
  const change=(k,v)=>{setForm(f=>({...f,[k]:v}));setSaved(false);};
  async function upload(event) {
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setError('');
    try { const body=new FormData();body.append('file',file);const {data}=await api.post('/uploads',body);change('logoUrl',data.file.url); }
    catch(e){setError(e.response?.data?.message||t("Could not upload image."));}finally{setBusy(false);event.target.value='';}
  }
  async function save(event) {
    event.preventDefault();setBusy(true);setError('');setSaved(false);
    try{
      const data=Object.fromEntries([...fields.map(([k])=>k),'timezone','logoUrl',...(!record.currencyLocked?['currency']:[])].map(k=>[k,form[k]??null]));
      const response=await api.patch('/workspace/settings',data);
      setRecord(prev=>({...prev,...response.data}));setForm(response.data.company);
      setUser(prev=>({...prev,company:response.data.company}));setSaved(true);
    }catch(e){setError(e.response?.data?.message||t("Could not save company settings."));}finally{setBusy(false);}
  }
  return <PageLayout><PageHeader title={t("Company settings")} description={t("Company details, operating currency and invoice information.")} />
    {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{saved&&<Alert severity="success" sx={{mb:2}}>{t("Company settings saved.")}</Alert>}
    {!admin&&<Alert severity="info" sx={{mb:2}}>{t("Only an administrator can change company settings.")}</Alert>}
    {!record?<Typography>{t("Loading...")}</Typography>:<Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',lg:'minmax(0,2fr) minmax(260px,1fr)'},gap:3}}>
    <PageCard sx={{p:3}}><Box component="form" onSubmit={save}><Stack spacing={2.5}>
      <Typography component="h2" variant="h6">{t("Company profile")}</Typography>
      <Stack direction="row" spacing={2} alignItems="center">{form.logoUrl&&<Box component="img" src={form.logoUrl} alt={t("Company logo")} sx={{width:72,height:72,objectFit:'contain'}}/>}{admin&&<><Button component="label" disabled={busy}>{t("Upload logo")}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/></Button>{form.logoUrl&&<Button onClick={()=>change('logoUrl',null)}>{t("Remove logo")}</Button>}</>}</Stack>
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:2}}>{fields.map(([key,label])=><TextField key={key} label={t(label)} value={form[key]||''} onChange={e=>change(key,e.target.value)} disabled={!admin||busy} required={key==='name'} inputProps={{maxLength:key==='address'?500:key==='invoicePrefix'?12:150}} />)}</Box>
      <TextField select label={t("Operating currency")} value={form.currency} disabled={!admin||busy||record.currencyLocked} onChange={e=>change('currency',e.target.value)}>{record.currencies.map(code=><MenuItem key={code} value={code}>{code} · {money(1234.56,code)}</MenuItem>)}</TextField>
      <Alert severity="info">{record.currencyLocked?t("Currency is locked because financial records already exist."):t("Choose your currency before the first transaction. Existing catalogue prices are not converted.")}</Alert>
      <TextField select label={t("Time zone")} value={form.timezone||'UTC'} disabled={!admin||busy} onChange={e=>change('timezone',e.target.value)}>{[...new Set([form.timezone,...zones])].filter(Boolean).map(zone=><MenuItem key={zone} value={zone}>{zone}</MenuItem>)}</TextField>
      {admin&&<Box><Button variant="contained" type="submit" disabled={busy}>{busy?t("Saving..."):t("Save settings")}</Button></Box>}
    </Stack></Box></PageCard>
    <PageCard sx={{p:3,alignSelf:'start'}}><Stack spacing={2}><Typography component="h2" variant="h6">{t("Subscription")}</Typography>{admin&&<Button component={RouterLink} to="/workspace/plan">{t("Plan and renewal")}</Button>}<Chip label={user.company.market==='GLOBAL'?'Starter':user.company.plan} sx={{alignSelf:'start'}}/><Typography variant="h5">{money((form.subscriptionPrice?.amountMinor||0)/100,form.subscriptionPrice?.currency||'USD')}</Typography><Typography color="text.secondary">{t(form.billingCycle==='YEARLY'?'Yearly billing':'Monthly billing')}</Typography><Typography>{t("Expires")}: {date(form.endsAt,false)}</Typography><Typography>{t("Active account limit")}: {form.limits?.maxUsers}</Typography><Alert severity="info">{t("Subscription billing currency is separate from your operating currency.")}</Alert></Stack></PageCard>
    </Box>}
  </PageLayout>;
}
