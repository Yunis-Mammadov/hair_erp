export function sessionFailure(config, status, body, currentToken) {
  const headers=config?.headers;
  const authorization=typeof headers?.get==='function'?headers.get('Authorization'):Object.entries(headers||{}).find(([k])=>k.toLowerCase()==='authorization')?.[1];
  if (!currentToken || authorization !== `Bearer ${currentToken}` || /^\/?auth\/(company-login|pin-login)/.test(config?.url||'')) return false;
  return status === 401 || status === 403 && body?.code === 'SUBSCRIPTION_INACTIVE';
}
