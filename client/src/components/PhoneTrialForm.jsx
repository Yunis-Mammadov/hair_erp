import {useEffect, useRef, useState} from 'react';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import {Alert, Box, Button, Checkbox, FormControlLabel, Link, Stack, TextField, Typography} from '@mui/material';
import {useI18n} from '../i18n/useI18n';
import {api} from '../lib/api';

export default function PhoneTrialForm() {
  const {t, language} = useI18n();
  const navigate = useNavigate();
  const mounted = useRef(false);
  const pending = useRef(false);
  const [phone, setPhone] = useState('+994 ');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [verification, setVerification] = useState(null);
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
    if (pending.current || !validPhone || !consent || (verification && !/^\d{6}$/.test(code))) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (verification) {
        const {data} = await api.post('/trial/phone/verify', {challenge: verification.challenge, code}, {anonymous: true});
        if (mounted.current) navigate('/trial/activate#token=' + data.token, {replace: true});
      } else {
        const {data} = await api.post('/trial/phone/request', {phone: number, locale: language, consent}, {anonymous: true});
        if (mounted.current) setVerification(data);
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.response?.status === 410) reset();
      setError(failure.response?.data?.message || t('Phone verification is temporarily unavailable. Please try again.'));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function reset() {
    setVerification(null);
    setCode('');
    setError('');
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {verification ? (
          <>
            {verification.actionUrl ? (
              <>
                <Typography>{t('Open WhatsApp and send the prepared message to receive your code.')}</Typography>
                <Button href={verification.actionUrl} target="_blank" rel="noopener noreferrer" variant="outlined">{t('Open WhatsApp')}</Button>
              </>
            ) : (
              <Typography>{t('We sent a code to {phone}.', {phone: number})}</Typography>
            )}
            <TextField label={verification.channel === 'whatsapp' ? t('WhatsApp code') : t('SMS code')}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code" slotProps={{htmlInput: {inputMode: 'numeric', maxLength: 6}}} required disabled={busy} />
            <Button type="submit" variant="contained" disabled={busy || code.length !== 6}>{t('Verify phone number')}</Button>
            <Button onClick={reset} disabled={busy}>{t('Change number or resend code')}</Button>
          </>
        ) : (
          <>
            <TextField label={t('Phone number')} type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              autoComplete="tel" helperText={t('Use an Azerbaijan (+994) phone number.')} required disabled={busy} />
            <FormControlLabel control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} />}
              label={<Typography variant="body2">{t('I agree to OTP.com processing my number and sending a verification code.')} <Link component={RouterLink} to="/privacy">{t('Privacy')}</Link></Typography>} />
            <Button type="submit" variant="contained" disabled={busy || !consent || !validPhone}>{t('Send verification code')}</Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
