let loading,initialized=false;
export function loadPaddle(){
 if(window.Paddle)return Promise.resolve(window.Paddle);
 if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.paddle.com/paddle/v2/paddle.js';script.async=true;script.onload=()=>window.Paddle?resolve(window.Paddle):reject(Error('CHECKOUT_UNAVAILABLE'));script.onerror=()=>{loading=null;script.remove();reject(Error('CHECKOUT_UNAVAILABLE'));};document.head.appendChild(script);});
 return loading;
}
export async function initializeCheckout(config){
 if(!/^(test_|live_)/.test(config.clientToken||''))throw Error('CHECKOUT_UNCONFIGURED');
 const paddle=await loadPaddle();if(!initialized){if(config.environment==='sandbox')paddle.Environment.set('sandbox');paddle.Initialize({token:config.clientToken});initialized=true;}return paddle;
}
export function checkoutTransaction(search){const id=new URLSearchParams(search).get('_ptxn');return /^txn_[a-z0-9]{26}$/.test(id||'')?id:null;}
