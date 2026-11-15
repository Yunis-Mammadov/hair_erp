export function resolveApiUrl(value) {
  if (value == null || String(value).trim() === '') return '/api';
  const text = String(value).trim().replace(/\/+$/, '');
  if (/^\/(?!\/)[A-Za-z0-9/_-]+$/.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { throw new Error('VITE_API_URL must be an HTTP(S) URL or a same-origin path such as /api.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('VITE_API_URL must be an HTTP(S) URL without credentials, query or fragment.');
  return text;
}
