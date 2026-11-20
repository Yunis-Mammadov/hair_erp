import { readWorkbook } from './import-file.mjs';
self.onmessage=async e=>{try{self.postMessage({sheets:await readWorkbook(e.data)});}catch(error){self.postMessage({error:error.message});}};
