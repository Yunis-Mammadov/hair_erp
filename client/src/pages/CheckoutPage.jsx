import {useEffect,useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {Alert,Button,Stack,Typography} from '@mui/material';
import {PageLayout,PageHeader,PageCard} from '../components/WorkspaceUI';
import {useI18n} from '../i18n/useI18n';
import {api} from '../lib/api';
import {checkoutTransaction,initializeCheckout} from '../lib/paddle-checkout.mjs';
export default function CheckoutPage(){
 const {t}=useI18n(),[ready,setReady]=useState(false),[error,setError]=useState('');const id=checkoutTransaction(window.location.search);
 useEffect(()=>{let live=true;if(!id)return;api.get('/public/service').then(r=>initializeCheckout(r.data.checkout||{})).then(()=>{if(live)setReady(true);}).catch(()=>{if(live)setError(t('Checkout is not available. Contact support.'));});return()=>{live=false;};},[id,t]);
 return <PageLayout><PageHeader title={t('Secure checkout')}/><PageCard sx={{p:3,maxWidth:700,mx:'auto'}}><Stack spacing={2}>{error&&<Alert severity="error">{error}</Alert>}{!id?<Alert severity="warning">{t('Open checkout from your subscription page.')}</Alert>:<><Typography>{t('Checkout opens in a secure payment window. Subscription access is confirmed by the server.')}</Typography><Button disabled={!ready} variant="contained" onClick={()=>window.Paddle.Checkout.open({transactionId:id})}>{t('Open secure checkout')}</Button></>}<Button component={RouterLink} to="/renew">{t('Refresh subscription status')}</Button><Button component={RouterLink} to="/support">{t('Support')}</Button></Stack></PageCard></PageLayout>;
}
