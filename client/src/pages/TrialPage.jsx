import {useEffect,useState} from 'react';
import {Alert,Box,Button,Checkbox,CircularProgress,FormControlLabel,Link,Paper,Stack,TextField,Typography} from '@mui/material';
import {Link as RouterLink} from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import PhoneTrialForm from '../components/PhoneTrialForm';
import {useI18n} from '../i18n/useI18n';
import {api} from '../lib/api';
export default function TrialPage(){
 const {t,language}=useI18n(),[config,setConfig]=useState(null),[email,setEmail]=useState(''),[website,setWebsite]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0),[confirm,setConfirm]=useState(false);
 const [usePhone,setUsePhone]=useState(false);
 const phoneMode=Boolean(config?.phoneEnabled&&(usePhone||!config.enabled));
 useEffect(()=>{let live=true;api.get('/trial/config',{anonymous:true}).then(r=>{if(live){setConfig(r.data);setError('');}}).catch(e=>{if(live)setError(e.response?.data?.message||t('Could not load trial settings.'));});return()=>{live=false;};},[t,reload]);
 async function submit(e){e.preventDefault();if(busy||!confirm)return;setBusy(true);setError('');try{await api.post('/trial/request',{email,locale:language,website},{anonymous:true});setSent(true);}catch(e){setError(e.response?.data?.message||t('Could not request a trial.'));}finally{setBusy(false);}}
 return <PublicLayout><Paper variant="outlined" sx={{maxWidth:560,mx:'auto',p:{xs:3,sm:4},borderRadius:3}}>
 <Typography component="h1" variant="h4" fontWeight={650}>{t(sent&&!phoneMode?'Check your email':'Start your 7-day free trial')}</Typography>
 <Typography color="text.secondary" sx={{mt:1.5,mb:3}}>{t(phoneMode?'Verify your phone number to create your company.':sent?'If your email is eligible, a setup link will arrive shortly. Check your inbox and spam folder. Your trial starts after you finish creating the company.':'Enter a real email address. We will send a secure link so you can create your company and choose your login details.')}</Typography>
 {config?.enabled&&config.phoneEnabled&&<Stack direction="row" spacing={1} sx={{mb:2.5}}>
  <Button aria-pressed={!phoneMode} variant={phoneMode?'outlined':'contained'} disabled={busy} onClick={()=>setUsePhone(false)}>{t('Register with email')}</Button>
  <Button aria-pressed={phoneMode} variant={phoneMode?'contained':'outlined'} disabled={busy} onClick={()=>setUsePhone(true)}>{t('Register with phone')}</Button>
 </Stack>}
 {error&&!phoneMode&&<Alert severity="error" sx={{mb:2}} action={<Button onClick={()=>setReload(n=>n+1)}>{t('Retry')}</Button>}>{error}</Alert>}
 {config&&!config.enabled&&!config.phoneEnabled&&<Alert severity="info" sx={{mb:2}}>{t('Trial registration is not available. Contact support.')}</Alert>}
 {phoneMode?<PhoneTrialForm/>:!sent?<Box component="form" onSubmit={submit}><Stack spacing={2}><TextField label={t('Your email address')} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required fullWidth disabled={busy} inputProps={{maxLength:254}}/><Box aria-hidden="true" sx={{position:'absolute',left:-10000,width:1,height:1,overflow:'hidden'}}><TextField label="Website" value={website} onChange={e=>setWebsite(e.target.value)} autoComplete="off" inputProps={{tabIndex:-1}}/></Box><FormControlLabel control={<Checkbox checked={confirm} onChange={e=>setConfirm(e.target.checked)} disabled={busy}/>} label={<Typography variant="body2">{t('I want a verification email to start my trial.')} <Link component={RouterLink} to="/privacy">{t('Privacy')}</Link></Typography>}/><Button type="submit" variant="contained" size="large" disabled={busy||!config?.enabled||!confirm}>{busy?<CircularProgress size={22}/>:t('Send setup link')}</Button><Typography variant="caption" color="text.secondary">{t('No card required. One trial per verified email address.')}</Typography></Stack></Box>:<Stack spacing={2}><Alert severity="success">{t('The verification link is valid for one hour. No company has been created yet.')}</Alert><Button onClick={()=>setSent(false)}>{t('Use another email or resend')}</Button></Stack>}
 <Stack direction="row" justifyContent="space-between" sx={{mt:3}}><Button component={RouterLink} to="/login">{t('Already have an account? Sign in')}</Button><Button component={RouterLink} to="/support">{t('Support')}</Button></Stack></Paper></PublicLayout>;
}
