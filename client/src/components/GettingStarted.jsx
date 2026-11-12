import { useEffect, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageCard } from "./WorkspaceUI";
import { useI18n } from "../i18n/useI18n";
export default function GettingStarted() {
  const {t}=useI18n();const [data,setData]=useState(null);
  useEffect(()=>{let active=true;api.get('/workspace/onboarding').then(r=>{if(active)setData(r.data);}).catch(()=>{});return()=>{active=false;};},[]);
  if(!data)return null;
  const steps=[['currencyConfigured','Choose your currency','/workspace/settings'],['products','Add your first product','/warehouse/stock'],['stock','Receive stock','/warehouse/purchases'],['sales','Record your first sale','/exp/sales']];
  if(steps.every(([key])=>!!data[key]))return null;
  return <PageCard sx={{p:2.5,mb:3}}><Typography variant="h6">{t("Getting started")}</Typography><Typography variant="body2" color="text.secondary" sx={{mb:2}}>{t("Set up your workspace in four steps.")}</Typography><Stack direction={{xs:'column',md:'row'}} spacing={1.5}>{steps.map(([key,label,to],i)=><Button key={key} component={Link} to={to} variant={data[key]?'text':'outlined'} startIcon={data[key]?<CheckCircleOutlineIcon/>:<Box component="span">{i+1}.</Box>}>{t(label)}</Button>)}</Stack></PageCard>;
}
