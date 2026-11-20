import {useState} from 'react';
import {Box} from '@mui/material';
import {useI18n} from '../i18n/useI18n';
export default function CompanyBrand({company,size=56}){
 const {t}=useI18n(),[failed,setFailed]=useState(null);const url=company?.logoUrl;
 return <Box sx={{width:size,height:size,flexShrink:0,borderRadius:'12px',bgcolor:'background.paper',border:'1px solid',borderColor:'divider',display:'grid',placeItems:'center',overflow:'hidden'}}>
 {url&&failed!==url?<Box component="img" src={url} alt={t('Company logo')} onError={()=>setFailed(url)} sx={{width:'100%',height:'100%',objectFit:'contain',p:0.75}}/>:<Box component="span" aria-hidden="true" sx={{fontWeight:700,fontSize:size/2.8,color:'primary.main'}}>{(company?.name||'z').slice(0,1).toUpperCase()}</Box>}
 </Box>;
}
