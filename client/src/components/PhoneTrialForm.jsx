import {useEffect, useRef, useState} from 'react';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import {Alert, Box, Button, Checkbox, FormControlLabel, Link, Stack, TextField, Typography} from '@mui/material';
import {useI18n} from '../i18n/useI18n';
import {api} from '../lib/api';
import {sendTrialSms} from '../lib/trial-phone';

export default function PhoneTrialForm() {
  const {t, language} = useI18n();
  const navigate = useNavigate();
  const captcha = useRef(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const proof = useRef(null);
  const [phone, setPhone] = useState('+994 ');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [verifyCode, setVerifyCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const compact = phone.trim().replace(/[\s()-]/g, '');
  const number = /^0\d{9}$/.test(compact) ? '+994' + compact.slice(1) : compact;
  const validPhone = /^\+994\d{9}$/.test(number);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !validPhone || !consent || (verifyCode && !/^\d{6}$/.test(code))) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (verifyCode) {
        proof.current ??= await verifyCode(code);
        if (!mounted.current) return;
        const {data} = await api.post('/trial/phone/verify', {idToken: proof.current, locale: language}, {anonymous: true});
        proof.current = null;
        if (mounted.current) navigate('/trial/activate#token=' + data.token, {replace: true});
      } else {
        const confirm = await sendTrialSms(number, language, captcha.current);
        if (mounted.current && confirm) setVerifyCode(() => confirm);
      }
    } catch (failure) {
      if (!mounted.current) return;
      const message = {
        'auth/invalid-verification-code': 'That SMS code is incorrect.',
        'auth/code-expired': 'That SMS code expired. Request a new code.',
        'auth/session-expired': 'That SMS code expired. Request a new code.',
        'auth/too-many-requests': 'Too many trial requests. Please try again later.',
      }[failure.code];
      if (failure.response?.status === 401) {
        proof.current = null;
        setVerifyCode(null);
        setCode('');
      }
      setError(failure.response?.data?.message || t(message || 'Phone verification is temporarily unavailable. Please try again.'));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function reset() {
    proof.current = null;
    setVerifyCode(null);
    setCode('');
    setError('');
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {verifyCode ? (
          <>
            <Typography>{t('We sent a code to {phone}.', {phone: number})}</Typography>
            <TextField label={t('SMS code')} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code" slotProps={{htmlInput: {inputMode: 'numeric', maxLength: 6}}} required disabled={busy} />
            <Button type="submit" variant="contained" disabled={busy || code.length !== 6}>{t('Verify phone number')}</Button>
            <Button onClick={reset} disabled={busy}>{t('Change number or resend code')}</Button>
          </>
        ) : (
          <>
            <TextField label={t('Phone number')} type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              autoComplete="tel" helperText={t('Use an Azerbaijan (+994) phone number.')} required disabled={busy} />
            <FormControlLabel control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} />}
              label={<Typography variant="body2">{t('I agree to Firebase processing my number and sending an SMS code.')} <Link component={RouterLink} to="/privacy">{t('Privacy')}</Link></Typography>} />
            <Button type="submit" variant="contained" disabled={busy || !consent || !validPhone}>{t('Send SMS code')}</Button>
          </>
        )}
        <div ref={captcha} />
      </Stack>
    </Box>
  );
}
