const { isIP } = require('node:net');
const { fail } = require('./financial-core');

const BASE_URL = 'https://api.otp.com/api/v1/otp/';
const REQUEST_TIMEOUT_MS = 8000;

function enabled(env = process.env) {
  const keyPrefix = env.NODE_ENV === 'production' ? 'otp_live_' : 'otp_(?:live|test)_';
  return env.TRIAL_SIGNUP_ENABLED === 'true' && env.TRIAL_PHONE_ENABLED === 'true' &&
    new RegExp('^' + keyPrefix + '\\S+$').test(env.OTP_COM_API_KEY || '');
}

function unavailable() {
  return fail(503, 'Phone verification is temporarily unavailable. Please try again.', 'TRIAL_UNAVAILABLE');
}

function expired() {
  return fail(410, 'This verification code has expired or has no attempts left. Request a new code.', 'PHONE_CODE_EXPIRED');
}

function rateLimited() {
  return fail(429, 'Too many trial requests. Please try again later.', 'TRIAL_RATE_LIMIT');
}

async function post(endpoint, body, headers = {}) {
  try {
    return await fetch(BASE_URL + endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.OTP_COM_API_KEY,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw unavailable();
  }
}

async function parse(response) {
  try {
    return await response.json();
  } catch {
    throw unavailable();
  }
}

function whatsappUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin === 'https://wa.me' && !url.username && !url.password && /^\/\d+$/.test(url.pathname)) {
      return url.href;
    }
  } catch {
    // An invalid provider link cannot be used to start a WhatsApp chat.
  }
  throw unavailable();
}

async function requestCode({ phone, locale, ip, requestId }) {
  const body = { recipient: phone, locale };
  if (ip && isIP(ip)) body.client_ip = ip;

  const response = await post('send', body, { 'idempotency-key': 'trial:' + requestId });
  if (response.status === 429) throw rateLimited();
  if (!response.ok) throw unavailable();

  const result = await parse(response);
  if (result?.status !== 'pending' || result.completion !== 'code' ||
      !['sms', 'whatsapp'].includes(result.channel) ||
      typeof result.otp_id !== 'string' || !result.otp_id || result.otp_id.length > 128) {
    throw unavailable();
  }
  return {
    providerOtpId: result.otp_id,
    channel: result.channel,
    actionUrl: result.channel === 'whatsapp' && result.action_url != null
      ? whatsappUrl(result.action_url)
      : null,
  };
}

async function verifyCode(providerOtpId, code) {
  const response = await post('verify', { otp_id: providerOtpId, code });
  if (response.status === 404 || response.status === 410) throw expired();
  if (response.status === 429) throw rateLimited();
  if (!response.ok) throw unavailable();

  const result = await parse(response);
  if (result?.otp_id !== providerOtpId) throw unavailable();
  if (result.matched === true && result.status === 'approved') return;
  if (result.matched === false && result.status === 'pending') {
    throw fail(400, 'That verification code is incorrect.', 'PHONE_CODE_INCORRECT');
  }
  if (result.matched === false && ['failed', 'expired'].includes(result.status)) throw expired();
  throw unavailable();
}

module.exports = { enabled, unavailable, expired, rateLimited, requestCode, verifyCode };
