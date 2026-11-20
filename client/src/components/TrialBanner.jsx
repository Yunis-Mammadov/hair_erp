import {useEffect,useState} from 'react';
import {Alert,Button} from '@mui/material';
import {Link as RouterLink} from 'react-router-dom';
import {useAuth} from '../features/auth/useAuth';
import {useI18n} from '../i18n/useI18n';
export default function TrialBanner(){
 const {user}=useAuth(),{t,date}=useI18n(),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const trial=user?.company?.trial;if(!trial||trial.status==='converted')return null;
 const left=Math.max(0,Math.ceil((Date.parse(trial.endsAt)-now)/86400000));
 return <Alert severity={left>2?'info':'warning'} sx={{m:2}} action={user.role==='ADMIN'?<Button component={RouterLink} to="/workspace/plan">{t('Choose a plan')}</Button>:null}>{left?t('Free trial: {days} days remaining. Ends {date}.',{days:left,date:date(trial.endsAt)}):t('Your trial has ended. Choose a plan to continue using your company.')}</Alert>;
}
