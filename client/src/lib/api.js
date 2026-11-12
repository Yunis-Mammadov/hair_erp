import axios from "axios";
import { prepareFinancialRequest, finishFinancialRequest } from "./financial-retries";
import { sessionFailure } from "./session-events.mjs";
import { getSnapshot, t } from "../i18n/runtime";
import { normalizeMoneyPayload } from "./money-input.mjs";
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is not defined");
export const api = axios.create({ baseURL:API_URL, timeout:15000 });
api.interceptors.request.use(config => {
  const token=config.anonymous?null:localStorage.getItem("token"), state=getSnapshot();
  if(config.anonymous)config.headers.delete("Authorization");
  if (token && !config.headers.get("Authorization")) config.headers.set("Authorization", `Bearer ${token}`);
  config.headers.set("Accept-Language",state.language);
  if (token && /^(post|put|patch)$/i.test(config.method||'')) config.headers.set("X-Workspace-Currency",state.currency);
  config.data=normalizeMoneyPayload(config.data);
  return prepareFinancialRequest(config,token);
});
api.interceptors.response.use(response=>{finishFinancialRequest(response.config,response.status);return response;},error=>{
  finishFinancialRequest(error.config,error.response?.status);
  if (sessionFailure(error.config,error.response?.status,error.response?.data,localStorage.getItem('token'))) window.dispatchEvent(new Event('z-index-session-expired'));
  if (error.response?.data?.code==='WORKSPACE_CHANGED') window.dispatchEvent(new Event('z-index-workspace-changed'));
  const reference=error.response?.headers?.['x-request-id'];
  if(error.response?.status>=500&&/^[a-f0-9-]{36}$/.test(reference||'')&&error.response?.data?.message)error.response.data.message+=' · '+t('Reference: {id}',{id:reference});
  return Promise.reject(error);
});
