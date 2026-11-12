import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useEffect, useState } from "react";
import { Autocomplete, Alert, Box, Button, Stack, TextField, Typography, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { api } from "../lib/api";
import { PageLayout, PageHeader, PageCard, DataTable } from "../components/WorkspaceUI";
import { RecordPager } from "../components/RecordsTools";
export default function ReturnsPage() {
  useI18n();
  const [customers, setCustomers] = useState([]),
    [customerSearch, setCustomerSearch] = useState(""),
    [customer, setCustomer] = useState(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [selection, setSelection] = useState({}),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.get("/customers/lookup", {
        params: {
          search: customerSearch,
          limit: 20
        }
      }).then(r => {
        if (active) setCustomers(r.data.customers);
      }).catch(() => {
        if (active) setError(t("Müştərilər yüklənmədi."));
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);
  useEffect(() => {
    if (!customer) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api.get(`/customers/${customer.id}/returnable-products`, {
        params: {
          search,
          page,
          limit: 20
        }
      }).then(r => {
        if (active) {
          setData(r.data);
          setError("");
        }
      }).catch(e => {
        if (active) setError(e.response?.data?.message || t("Məhsullar yüklənmədi."));
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customer, search, page, reload]);
  const selected = Object.values(selection).filter(p => Number(p.quantity) > 0);
  async function submit() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const {
        data
      } = await api.post("/returns", {
        customerId: customer.id,
        note,
        items: selected.map(p => ({
          productId: p.productId,
          quantity: p.quantity
        }))
      });
      setSelection({});
      setNote("");
      setReload(r => r + 1);
      setSuccess(t("Qaytarma qeydə alındı. Yeni borc: {value0}", {
        value0: Number(data.summary?.debt || 0).toFixed(2)
      }));
    } catch (e) {
      setError(e.response?.data?.message || t("Qaytarma alınmadı. Yenidən cəhd et."));
    } finally {
      setBusy(false);
    }
  }
  return <PageLayout>
      <PageHeader title={t("Geri qaytarma")} description={t("Müştərinin qaytara biləcəyi məhsulları seç. Qiymət ilkin satışdan götürülür.")} />
      {error && <Alert severity="error" sx={{
      mb: 2
    }}>
          {error}
        </Alert>}
      {success && <Alert severity="success" sx={{
      mb: 2
    }}>
          {success}
        </Alert>}
      <PageCard sx={{
      p: 2,
      mb: 2
    }}>
        <Autocomplete options={customers} value={customer} filterOptions={x => x} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={c => `${c.name} · ${c.phone || c.salon || ""}`} onInputChange={(_, value, reason) => {
        if (reason === "input") setCustomerSearch(value);
      }} onChange={(_, value) => {
        setCustomer(value);
        setSelection({});
        setData(null);
        setSearch("");
        setPage(1);
        setSuccess("");
        setError("");
      }} renderInput={params => <TextField {...params} label={t("Müştəri axtar və seç")} />} />
      </PageCard>
      {customer && <Box sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "1fr",
        lg: "minmax(0,1fr) 320px"
      },
      gap: 2,
      alignItems: "start"
    }}>
          <PageCard>
            <Box sx={{
          p: 2
        }}>
              <TextField fullWidth label={t("Ad, SKU və ya barkod")} value={search} onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }} />
            </Box>
            {loading && <Typography sx={{
          px: 2
        }}>{t("Yüklənir…")}</Typography>}
            <DataTable minWidth={500}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("Məhsul")}</TableCell>
                  <TableCell>{t("Qaytarıla bilər")}</TableCell>
                  <TableCell>{t("Qaytarılan say")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.products.map(p => <TableRow key={p.productId}>
                    <TableCell>
                      {p.productName}
                      <Typography variant="caption" display="block">
                        {p.sku || p.categoryName}
                      </Typography>
                    </TableCell>
                    <TableCell>{p.returnableQty}</TableCell>
                    <TableCell>
                      <TextField size="small" type="number" inputProps={{
                  min: 0,
                  max: p.returnableQty,
                  step: 1
                }} value={selection[p.productId]?.quantity ?? ""} disabled={busy || !p.returnableQty} onChange={e => setSelection(prev => ({
                  ...prev,
                  [p.productId]: {
                    ...p,
                    quantity: e.target.value
                  }
                }))} sx={{
                  width: 110
                }} />
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </DataTable>
            {!loading && data?.products.length === 0 && <Typography sx={{
          p: 2
        }}>{t("Məhsul tapılmadı.")}</Typography>}
            <RecordPager pagination={data?.pagination} onChange={setPage} disabled={loading} />
          </PageCard>
          <PageCard sx={{
        p: 2
      }}>
            <Stack spacing={2}>
              <Typography fontWeight={600}>{t("Seçilmiş qaytarma")}</Typography>
              {selected.length === 0 ? <Typography variant="body2">{t("Siyahıdan məhsul seç.")}</Typography> : selected.map(p => <Stack key={p.productId} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      {p.productName} × {p.quantity}
                    </Typography>
                    <Button size="small" onClick={() => setSelection(prev => {
              const next = {
                ...prev
              };
              delete next[p.productId];
              return next;
            })}>{t("Sil")}</Button>
                  </Stack>)}
              <Alert severity="info">{t("Yekun məbləğ satışdakı qiymətlərə görə serverdə hesablanır. Bu əməliyyat müştərini avtomatik “problemli” etmir.")}</Alert>
              <TextField label={t("Qaytarma səbəbi / qeyd")} multiline minRows={2} value={note} onChange={e => setNote(e.target.value)} />
              <Button variant="contained" disabled={busy || loading || !selected.length} onClick={submit}>
                {busy ? t("Saxlanılır…") : t("Qaytarmanı təsdiqlə")}
              </Button>
            </Stack>
          </PageCard>
        </Box>}
    </PageLayout>;
}
