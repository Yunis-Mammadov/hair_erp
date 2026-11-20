import {useEffect,useState} from 'react';
import {Alert,Box,Stack,Typography} from '@mui/material';
import {api} from '../lib/api';
import {useI18n} from '../i18n/useI18n';
import {RecordPager} from './RecordsTools';
export default function PurchaseAudit({id}){
 const {t,date,money}=useI18n(),[page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;api.get(`/purchases/${id}/audit`,{params:{page,limit:10}}).then(r=>{if(live)setData(r.data);}).catch(e=>{if(live)setError(e.response?.data?.message||t('Could not load history.'));});return()=>{live=false;};},[id,page,t]);
 return <Stack spacing={1}>{error&&<Alert severity="error">{error}</Alert>}{data?.events.map(e=><Box key={e.id} sx={{p:2,border:'1px solid',borderColor:'divider',borderRadius:2}}><Typography fontWeight={600} variant="body2">{t(e.action)} · {e.actorName}</Typography><Typography variant="caption">{date(e.createdAt)}</Typography><Typography variant="body2" sx={{my:1,whiteSpace:'pre-wrap'}}>{e.reason}</Typography><Typography variant="caption">{e.action==='PURCHASE_VOIDED'?t('Reversed stock receipt'):t('Total')}: {money(e.before.totalAmount)}{e.action!=='PURCHASE_VOIDED'&&<> → {money(e.after.totalAmount)}</>} · {t('Quantity')}: {(e.before.items||[]).map(i=>`${i.product?.name||i.productId}: ${i.quantity}`).join(', ')} → {(e.after.items||[]).map(i=>`${i.product?.name||i.productId}: ${i.quantity}`).join(', ')}</Typography></Box>)}{data&&!data.events.length&&<Typography variant="caption" color="text.secondary">{t('No revisions yet.')}</Typography>}<RecordPager pagination={data?.pagination} onChange={setPage}/></Stack>;
}
