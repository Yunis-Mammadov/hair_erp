import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { resolveApiUrl } from "../lib/api-url.mjs";

const operatorApi = axios.create({
  baseURL: resolveApiUrl(import.meta.env.VITE_API_URL),
  timeout: 30000,
});

const emptyForm = {
  code: "",
  name: "",
  password: "",
  currency: "USD",
  market: "GLOBAL",
  billingCycle: "MONTHLY",
  timezone: "UTC",
};

export default function OperatorCompaniesPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companies, setCompanies] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });

  const headers = {
    Authorization: `Bearer ${secret}`,
  };

  const change = (key) => (event) => {
    setForm((old) => ({
      ...old,
      [key]: event.target.value,
    }));
  };

  function report(err) {
    setError(
      err.response?.data?.message ||
        "Serverlə əlaqə alınmadı. Siyahını yeniləyib nəticəni yoxla.",
    );

    if (err.response?.status === 401) {
      setSecret("");
      setUnlocked(false);
      setCompanies([]);
    }
  }

  async function load(event) {
    event?.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const { data } = await operatorApi.get(
        "/operator/companies",
        { headers },
      );

      setCompanies(data.companies);
      setCurrencies(data.currencies);
      setUnlocked(true);
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await operatorApi.post(
        "/operator/companies",
        form,
        { headers },
      );

      setCompanies((old) =>
        [data.company, ...old].slice(0, 50),
      );

      setSuccess(
        `${data.company.loginEmail} yaradıldı. Üç hesab hazırdır.`,
      );

      setForm((old) => ({
        ...old,
        code: "",
        name: "",
        password: "",
      }));
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setSecret("");
    setUnlocked(false);
    setCompanies([]);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
  }

  return (
    <Box
      sx={{
        maxWidth: 900,
        mx: "auto",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5">
          z-Index · Operator
        </Typography>

        <Button component={Link} to="/login">
          Müştəri girişi
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {!unlocked ? (
        <Paper
          component="form"
          onSubmit={load}
          sx={{ p: 3 }}
        >
          <Stack spacing={2}>
            <Typography variant="h6">
              Operator girişi
            </Typography>

            <TextField
              label="Operator şifrəsi"
              type="password"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={busy}
              autoComplete="off"
              fullWidth
            />

            <Button
              type="submit"
              variant="contained"
              disabled={busy}
            >
              {busy ? "Yoxlanır…" : "Paneli aç"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={3}>
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
          >
            <Button onClick={load} disabled={busy}>
              Siyahını yenilə
            </Button>

            <Button onClick={logout} disabled={busy}>
              Operator çıxışı
            </Button>
          </Stack>

          <Paper
            component="form"
            onSubmit={save}
            sx={{ p: 3 }}
          >
            <Stack spacing={2}>
              <Typography variant="h6">
                Yeni şirkət · Starter
              </Typography>

              <TextField
                label="Şirkətin adı"
                value={form.name}
                onChange={change("name")}
                required
                disabled={busy}
                inputProps={{
                  minLength: 2,
                  maxLength: 150,
                }}
              />

              <TextField
                label="Şirkət kodu"
                placeholder="openai"
                value={form.code}
                onChange={(e) =>
                  setForm((old) => ({
                    ...old,
                    code: e.target.value.toLowerCase(),
                  }))
                }
                required
                disabled={busy}
                inputProps={{
                  pattern: "[a-z0-9]+(-[a-z0-9]+)*",
                  maxLength: 63,
                }}
              />

              <TextField
                label="Giriş e-poçtu"
                value={`${form.code.trim()}@zindex.com`}
                slotProps={{
                  input: { readOnly: true },
                }}
              />

              <TextField
                label="Şirkətin şifrəsi"
                type="password"
                value={form.password}
                onChange={change("password")}
                required
                disabled={busy}
                autoComplete="new-password"
                inputProps={{ minLength: 12 }}
                helperText="Ən azı 12 simvol. Şifrəni müştəriyə ayrıca ver."
              />

              <TextField
                select
                label="İş valyutası"
                value={form.currency}
                onChange={change("currency")}
                disabled={busy}
              >
                {currencies.map((currency) => (
                  <MenuItem
                    key={currency}
                    value={currency}
                  >
                    {currency}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Satış bazarı"
                value={form.market}
                onChange={change("market")}
                disabled={busy}
              >
                <MenuItem value="GLOBAL">
                  Global
                </MenuItem>

                <MenuItem value="AZ">
                  Azərbaycan
                </MenuItem>
              </TextField>

              <TextField
                select
                label="Abunə dövrü"
                value={form.billingCycle}
                onChange={change("billingCycle")}
                disabled={busy}
              >
                <MenuItem value="MONTHLY">
                  Aylıq
                </MenuItem>

                <MenuItem value="YEARLY">
                  İllik
                </MenuItem>
              </TextField>

              <TextField
                label="Saat qurşağı"
                value={form.timezone}
                onChange={change("timezone")}
                helperText="UTC, Asia/Baku, Europe/Istanbul, Europe/Warsaw"
                required
                disabled={busy}
              />

              <Alert severity="info">
                Admin: 2580 · Anbar: 2557 · Satış: 2534.
                Bunlar başlanğıc PIN-ləridir.
              </Alert>

              <Button
                type="submit"
                variant="contained"
                disabled={busy}
              >
                {busy
                  ? "Yaradılır…"
                  : "Şirkət və üç hesab yarat"}
              </Button>
            </Stack>
          </Paper>

          <Typography variant="h6">
            Son 50 şirkət
          </Typography>

          {companies.map((company) => (
            <Paper
              key={company.id}
              sx={{
                p: 2,
                overflowWrap: "anywhere",
              }}
            >
              <Typography fontWeight={600}>
                {company.name}
              </Typography>

              <Typography>
                {company.loginEmail}
                {" · "}
                {company.currency}
                {" · "}
                {company.plan}
              </Typography>

              <Typography variant="body2">
                Bitmə:{" "}
                {company.endsAt
                  ? new Date(
                      company.endsAt,
                    ).toLocaleDateString("az-AZ")
                  : "—"}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}