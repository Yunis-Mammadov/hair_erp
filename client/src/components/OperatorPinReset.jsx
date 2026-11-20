import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { resolveApiUrl } from "../lib/api-url.mjs";
const api = axios.create({ baseURL: resolveApiUrl(import.meta.env.VITE_API_URL), timeout: 30000 });

export default function OperatorPinReset({ company, secret, onClose }) {
  const [users, setUsers] = useState([]), [userId, setUserId] = useState("");
  const [pin, setPin] = useState(""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/operator/companies/${company.id}/users`, {
      headers: { Authorization: `Bearer ${secret}` }, signal: controller.signal,
    }).then(r => { setUsers(r.data.users); setUserId(r.data.users[0]?.id || ""); })
      .catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.message || "Hesablar yüklənmədi."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [company.id, secret]);
  async function save(event) {
    event.preventDefault(); if (busy || loading) return;
    setBusy(true); setError("");
    try {
      await api.patch(`/operator/companies/${company.id}/users/${userId}/pin`, { pin }, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      setPin(""); onClose();
    } catch (e) { setError(e.response?.data?.message || "PIN yenilənmədi."); }
    finally { setBusy(false); }
  }
  return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm">
    <DialogTitle>{company.name} · PIN yenilə</DialogTitle>
    <form onSubmit={save}>
      <DialogContent><Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info">Saxlayanda bu şirkətin köhnə sessiyaları bağlanacaq.</Alert>
        <TextField select label="İstifadəçi" value={userId} onChange={e => setUserId(e.target.value)} disabled={busy || loading} required>
          {users.map(user => <MenuItem key={user.id} value={user.id}>{user.fullName} · {user.role}</MenuItem>)}
        </TextField>
        <TextField label="Yeni PIN" type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          autoComplete="new-password" required disabled={busy || loading}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]{4,8}", minLength: 4, maxLength: 8 }}
          helperText="4–8 rəqəm; 2580, 2557 və 2534 qəbul edilmir." />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={onClose}>Bağla</Button><Button type="submit" variant="contained" disabled={busy || loading || !userId || pin.length < 4}>Saxla</Button></DialogActions>
    </form>
  </Dialog>;
}
