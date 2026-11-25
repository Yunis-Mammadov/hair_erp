const jwt = require('jsonwebtoken');
const { projectId } = require('../../shared/firebase-web.json');
const { fail } = require('./financial-core');

const issuer = 'https://securetoken.google.com/' + projectId;
const certificatesUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const maxAuthAgeSeconds = 300;
let keys = {};
let refreshAt = 0;
let pending;

function enabled(env = process.env) {
  return env.TRIAL_SIGNUP_ENABLED === 'true' && env.TRIAL_PHONE_ENABLED === 'true';
}

function certificateUnavailable() {
  return fail(503, 'Phone verification is temporarily unavailable. Please try again.', 'PHONE_VERIFICATION_UNAVAILABLE');
}

async function certificates() {
  if (pending) return pending;
  if (Date.now() < refreshAt) {
    if (keys === null) throw certificateUnavailable();
    return keys;
  }

  pending = (async () => {
    try {
      const response = await fetch(certificatesUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw certificateUnavailable();
      const result = await response.json();
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw certificateUnavailable();
      }
      const maxAge = response.headers.get('cache-control')?.match(/\bmax-age=(\d+)/i)?.[1];
      keys = result;
      refreshAt = Date.now() + (maxAge == null ? 300 : Number(maxAge)) * 1000;
      return keys;
    } catch {
      keys = null;
      refreshAt = Date.now() + 5000;
      throw certificateUnavailable();
    }
  })().finally(() => { pending = null; });
  return pending;
}

async function verifyFirebasePhone(idToken) {
  const invalid = () => fail(401, 'Verify your phone number again to continue.', 'PHONE_VERIFICATION_INVALID');
  if (typeof idToken !== 'string' || idToken.length > 8192) throw invalid();

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (decoded?.header?.alg !== 'RS256' || typeof kid !== 'string' || !kid ||
      decoded.payload?.aud !== projectId || decoded.payload?.iss !== issuer) throw invalid();

  const certificatesById = await certificates();
  const certificate = Object.hasOwn(certificatesById, kid) && certificatesById[kid];
  if (typeof certificate !== 'string') throw invalid();

  let claims;
  try {
    claims = jwt.verify(idToken, certificate, { algorithms: ['RS256'], audience: projectId, issuer });
  } catch {
    throw invalid();
  }
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) || claims.iat > now ||
      !Number.isInteger(claims.auth_time) || claims.auth_time > claims.iat ||
      now - claims.auth_time > maxAuthAgeSeconds ||
      typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 128 ||
      claims.firebase?.sign_in_provider !== 'phone' || claims.firebase.tenant ||
      typeof claims.phone_number !== 'string' || !/^\+994\d{9}$/.test(claims.phone_number)) throw invalid();
  return claims.phone_number;
}

module.exports = { enabled, verifyFirebasePhone };
