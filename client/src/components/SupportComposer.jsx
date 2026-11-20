import {useState} from 'react';
import {Alert,Button,Stack,TextField,Typography} from '@mui/material';
import {useAuth} from '../features/auth/useAuth';
import {useI18n} from '../i18n/useI18n';
export default function SupportComposer({service}){
 const {t}=useI18n(),{user}=useAuth(),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[reference,setReference]=useState('');
 const email=service?.supportEmail||'zindex.software@gmail.com';
 const valid=subject.trim().length>=3&&message.trim().length>=10;
 const body=[user?.company?.name?`${t('Company name')}: ${user.company.name}`:'',user?.fullName?`${t('Name')}: ${user.fullName}`:'',reference?`${t('Reference')}: ${reference}`:'','',message.trim()].filter((v,i)=>v||i===3).join('\n');
 const title=`[z-Index] ${subject.replace(/[\r\n]/g,' ').trim()}`;
 const mailto=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
 const gmail=`https://mail.google.com/mail/?${new URLSearchParams({view:'cm',fs:'1',to:email,su:title,body})}`;
 return <Stack spacing={2}>
 <Typography>{t('For account recovery, subscription renewal or a technical issue, contact support. Include the request ID shown with an error. Never send your password or PIN.')}</Typography>
 <Typography fontWeight={600}>{email}</Typography>
 <TextField label={t('Subject')} value={subject} onChange={e=>setSubject(e.target.value)} required inputProps={{maxLength:160}}/>
 <TextField label={t('Request reference (optional)')} value={reference} onChange={e=>setReference(e.target.value)} inputProps={{maxLength:100}}/>
 <TextField label={t('Message')} value={message} onChange={e=>setMessage(e.target.value)} required multiline minRows={5} inputProps={{maxLength:5000}}/>
 <Alert severity="info">{t('The buttons open a prepared email draft. Review it and press Send in your email application. This page does not send a message automatically.')}</Alert>
 <Stack direction={{xs:'column',sm:'row'}} spacing={1}><Button component="a" href={valid?gmail:undefined} target="_blank" rel="noopener noreferrer" disabled={!valid} variant="contained">{t('Open in Gmail')}</Button><Button component="a" href={valid?mailto:undefined} disabled={!valid} variant="outlined">{t('Open email application')}</Button></Stack>
 </Stack>;
}
