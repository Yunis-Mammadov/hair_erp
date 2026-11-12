import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useState } from "react";
import { Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody, Pagination } from "@mui/material";
import { api } from "../lib/api";
import { downloadBlob, exportRecords, parseCSV } from "../lib/records";
export function RecordPager({
  pagination,
  onChange,
  disabled = false
}) {
  useI18n();
  if (!pagination) return null;
  return <Stack direction={{
    xs: "column",
    sm: "row"
  }} spacing={1} alignItems="center" justifyContent="space-between" sx={{
    p: 2
  }}>
      <Typography variant="body2" color="text.secondary">
        {t("{total} results · page {page} of {pages}",{total:pagination.total,page:pagination.page,pages:Math.max(pagination.totalPages,1)})}
      </Typography>
      {pagination.totalPages > 1 && <Pagination count={pagination.totalPages} page={pagination.page} onChange={(_, page) => onChange(page)} disabled={disabled} size="small" />}
    </Stack>;
}
export function ExportButton({
  kind
}) {
  useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return <Stack>
      <Button disabled={busy} onClick={async () => {
      setBusy(true);
      setError("");
      try {
        await exportRecords(kind);
      } catch {
        setError(t("CSV yüklənmədi. Yenidən cəhd et."));
      } finally {
        setBusy(false);
      }
    }}>
        {busy ? t("Yüklənir…") : t("CSV ixrac")}
      </Button>
      {error && <Typography color="error" variant="caption">
          {error}
        </Typography>}
    </Stack>;
}
export function ImportButton({
  kind,
  onDone
}) {
  useI18n();
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState("");
  const headers = kind === "products" ? ["name", "category", "sku", "barcode", "salePrice", "quantity"] : ["name", "phone", "salon", "address", "lat", "lng"];
  async function read(file) {
    setError("");
    setRows([]);
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error(t("Fayl 1 MB-dan kiçik olmalıdır."));
      const parsed = parseCSV(await file.text());
      if (headers.some(h => !Object.hasOwn(parsed[0], h))) throw new Error(t("Sütunlar nümunə fayla uyğun olmalıdır."));
      setRows(parsed);
    } catch (e) {
      setError(t(e.message));
    }
  }
  return <>
      <Button variant="outlined" onClick={() => {
      setOpen(true);
      setRows([]);
      setError("");
      setDone("");
    }}>{t("CSV idxal")}</Button>
      <Dialog open={open} onClose={() => {
      if (!busy) setOpen(false);
    }} fullWidth maxWidth="md">
        <DialogTitle>
          {kind === "products" ? t("Məhsulları") : t("Müştəriləri")}{t("CSV ilə əlavə et")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">{t("Ən çox 200 yeni qeyd. Faylda xəta varsa bütün əməliyyat geri qaytarılır. Mövcud qeydlər yenilənmir.")}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => downloadBlob(new Blob([headers.join(",") + "\r\n"], {
              type: "text/csv;charset=utf-8"
            }), `${kind}-template.csv`)}>{t("Nümunə CSV")}</Button>
              <Button component="label" disabled={busy}>{t("Fayl seç")}<input hidden type="file" accept=".csv,text/csv" onChange={e => read(e.target.files?.[0])} />
              </Button>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            {done && <Alert severity="success">{done}</Alert>}
            {rows.length > 0 && <>
                <Typography>
                  {rows.length}{t("sətir · ilk 10 sətrin önbaxışı")}</Typography>
                <Box sx={{
              overflowX: "auto"
            }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {headers.map(h => <TableCell key={h}>{h}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.slice(0, 10).map((row, i) => <TableRow key={i}>
                          {headers.map(h => <TableCell key={h}>{row[h]}</TableCell>)}
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </Box>
              </>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>{t("Bağla")}</Button>
          <Button variant="contained" disabled={busy || !rows.length} onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const {
              data
            } = await api.post(`/records/imports/${kind}`, {
              rows
            });
            setDone(t("{value0} qeyd əlavə edildi.", {
              value0: data.imported
            }));
            setRows([]);
            onDone?.();
          } catch (e) {
            setError(e.response?.data?.message || t("İdxal alınmadı. Yenidən cəhd et."));
          } finally {
            setBusy(false);
          }
        }}>
            {busy ? t("Əlavə edilir…") : t("Yoxladım, əlavə et")}
          </Button>
        </DialogActions>
      </Dialog>
    </>;
}
