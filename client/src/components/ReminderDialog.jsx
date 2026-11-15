import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
export default function ReminderDialog({ customer, onClose, onSaved }) {
  const { t, language, date } = useI18n(),
    [email, setEmail] = useState(customer.email || ""),
    [consent, setConsent] = useState(!!customer.reminderOptIn),
    [preview, setPreview] = useState(null),
    [data, setData] = useState(null),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .get(`/extras/customers/${customer.id}/reminders`)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || t("Could not save the operation."),
          );
      });
    return () => {
      active = false;
    };
  }, [customer.id, reload, t]);
  async function prepare() {
    setBusy(true);
    setPreview(null);
    setError("");
    setSaved(false);
    try {
      await api.put(`/customers/${customer.id}`, {
        email,
        reminderOptIn: consent,
      });
      onSaved?.();
      setSaved(true);
      if (!consent) return;
      setPreview(
        (
          await api.get(`/extras/customers/${customer.id}/reminder-preview`, {
            params: { locale: language },
          })
        ).data,
      );
    } catch (e) {
      setError(e.response?.data?.message || t("Could not save the operation."));
    } finally {
      setBusy(false);
    }
  }
  async function queue() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/extras/customers/${customer.id}/reminders`,
        { recipient: preview.recipient, debt: preview.debt },
        { params: { locale: language } },
      );
      setPreview(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.response?.data?.message || t("Could not save the operation."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {t("Email reminders")} · {customer.name}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {saved && !preview && (
            <Alert severity="success">{t("Contact preferences saved.")}</Alert>
          )}
          {data && !data.enabled && (
            <Alert severity="info">
              {t(
                "Email reminders are disabled. Configure SMTP to enable sending.",
              )}
            </Alert>
          )}
          <TextField
            type="email"
            label={t("Customer email")}
            value={email}
            disabled={busy}
            onChange={(e) => {
              setEmail(e.target.value);
              setConsent(false);
              setPreview(null);
            }}
            inputProps={{ maxLength: 254 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={consent}
                disabled={busy}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setPreview(null);
                }}
              />
            }
            label={t(
              "The customer agreed to receive payment reminders at this email.",
            )}
          />
          <Button onClick={prepare} disabled={busy}>
            {t(
              consent
                ? "Save and preview reminder"
                : "Save contact preferences",
            )}
          </Button>
          {preview && (
            <Alert severity="info">
              <Typography>{preview.recipient}</Typography>
              <Typography fontWeight={600}>{preview.subject}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>
                {preview.body}
              </Typography>
            </Alert>
          )}
          {preview && (
            <Button
              variant="contained"
              onClick={queue}
              disabled={busy || !data?.enabled}
            >
              {t("Queue reminder")}
            </Button>
          )}
          <Typography variant="caption">
            {t(
              "One reminder per customer per 24 hours. Unknown delivery outcomes are never retried automatically.",
            )}
          </Typography>
          {data?.jobs.map((j) => (
            <Typography key={j.id} variant="body2">
              {date(j.createdAt)} · {j.recipient} · {t(({PENDING:"Reminder PENDING",SENDING:"Reminder SENDING",SENT:"Reminder SENT",UNKNOWN:"Reminder UNKNOWN",FAILED:"Reminder FAILED",STALE:"Reminder STALE",CANCELED:"Reminder CANCELED"})[j.state]||j.state)}
              {j.lastError ? " · " + t(j.lastError) : ""}
            </Typography>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          {t("Close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
