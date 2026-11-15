import process from "node:process";
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { resolveApiUrl } from './src/lib/api-url.mjs';
export default defineConfig(({mode}) => {
 const env=loadEnv(mode,process.cwd(),'VITE_');
 const apiUrl=resolveApiUrl(process.env.VITE_API_URL ?? env.VITE_API_URL);
 return {plugins:[react()],define:{'import.meta.env.VITE_API_URL':JSON.stringify(apiUrl)},server:{
  proxy:Object.fromEntries(['/api','/uploads','/webhooks'].map(prefix=>[prefix,{target:env.VITE_DEV_API_PROXY||'http://127.0.0.1:7079',changeOrigin:true}])),
  fs:{allow:[searchForWorkspaceRoot(process.cwd()),fileURLToPath(new URL('../shared',import.meta.url))]}
 }};
});
