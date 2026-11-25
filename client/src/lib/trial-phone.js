import firebaseConfig from '../../../shared/firebase-web.json';

let auth;

export async function sendTrialSms(phone, language, container) {
  const [{initializeApp}, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  if (!container.isConnected) return null;

  auth ??= sdk.initializeAuth(initializeApp(firebaseConfig, 'z-index-trial'), {
    persistence: sdk.inMemoryPersistence,
  });
  auth.languageCode = language;

  const verifier = new sdk.RecaptchaVerifier(auth, container, {size: 'invisible'});
  try {
    const confirmation = await sdk.signInWithPhoneNumber(auth, phone, verifier);
    return async code => {
      const {user} = await confirmation.confirm(code);
      try {
        return await user.getIdToken();
      } finally {
        await sdk.signOut(auth).catch(() => {});
      }
    };
  } finally {
    verifier.clear();
  }
}
