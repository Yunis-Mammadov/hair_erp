import { amountValue } from "../lib/money-input.mjs";
import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Stack, TableHead, TableBody, TableRow, TableCell, TextField, Typography } from "@mui/material";
import { useAuth } from "../features/auth/useAuth";
import { api } from "../lib/api";
import { PageLayout, PageHeader, PageCard, DataTable, RecordDate } from "../components/WorkspaceUI";
import { RecordPager, ExportButton, ImportButton } from "../components/RecordsTools";
export default function StockPage() {
  useI18n();
  const {
      user
    } = useAuth(),
    admin = user?.role === "ADMIN",
    canCount = admin || user?.role === "WAREHOUSE";
  const [filters, setFilters] = useState({
      search: "",
      categoryId: "",
      status: "ALL",
      archived: false
    }),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0),
    [data, setData] = useState(null),
    [categories, setCategories] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [edit, setEdit] = useState(null),
    [count, setCount] = useState(null),
    [history, setHistory] = useState(null),
    [historyPage, setHistoryPage] = useState(1),
    [movements, setMovements] = useState(null),
    [saving, setSaving] = useState(false),
    [dialogError, setDialogError] = useState("");
  useEffect(() => {
    api.get("/catalog/categories").then(r => setCategories(r.data.categories || [])).catch(() => setError(t("Kateqoriyalar yüklənmədi.")));
  }, [reload]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const {
          data
        } = await api.get("/stock", {
          params: {
            ...filters,
            page,
            limit: 25
          }
        });
        if (active) {
          setData(data);
          if (page > Math.max(data.pagination.totalPages, 1)) setPage(Math.max(data.pagination.totalPages, 1));
          setError("");
        }
      } catch (e) {
        if (active) setError(e.response?.data?.message || t("Stok yüklənmədi."));
      } finally {
        if (active) setBusy(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, page, reload]);
  useEffect(() => {
    if (!history) return;
    let active = true;
    setMovements(null);
    api.get(`/stock/${history.productId}/movements`, {
      params: {
        page: historyPage,
        limit: 20
      }
    }).then(r => {
      if (active) setMovements(r.data);
    }).catch(() => {
      if (active) setDialogError(t("Tarixçə yüklənmədi."));
    });
    return () => {
      active = false;
    };
  }, [history, historyPage]);
  const refresh = () => setReload(v => v + 1);
  const filter = (key, value) => {
    setFilters(p => ({
      ...p,
      [key]: value
    }));
    setPage(1);
  };
  async function save(fn) {
    setSaving(true);
    setDialogError("");
    try {
      await fn();
      setEdit(null);
      setCount(null);
      refresh();
    } catch (e) {
      setDialogError(e.response?.data?.message || t("Əməliyyat alınmadı."));
      if (!edit && !count) setError(e.response?.data?.message || t("Əməliyyat alınmadı."));
    } finally {
      setSaving(false);
    }
  }
  return <PageLayout>
      <PageHeader title={t("Məhsullar və stok")} description={t("Məhsul kataloqu, qalıqlar və stok hərəkətlərinin tarixçəsi.")} actions={<>
            {admin && <>
                <ExportButton kind="products" />
                <ImportButton kind="products" onDone={refresh} />
                <Button variant="contained" onClick={() => {
          setDialogError("");
          setEdit({
            name: "",
            categoryId: categories[0]?.id || "",
            sku: "",
            barcode: "",
            salePrice: "0",
            quantity: "0"
          });
        }}>{t("Məhsul əlavə et")}</Button>
              </>}
            <Button onClick={refresh}>{t("Yenilə")}</Button>
          </>} />
      {error && <Alert severity="error" sx={{
      mb: 2
    }}>
          {error}
        </Alert>}
      <Stack direction="row" spacing={2} flexWrap="wrap" sx={{
      mb: 2
    }}>
        {[[t("Məhsul"), data?.stats.totalProducts], [t("Ümumi qalıq"), data?.stats.totalQuantity], [t("Az qalıb"), data?.stats.lowStock], [t("Bitib"), data?.stats.outOfStock]].map(([label, value]) => <PageCard key={label} sx={{
        p: 2,
        minWidth: 130
      }}>
            <Typography variant="caption">{label}</Typography>
            <Typography variant="h5">{value ?? "—"}</Typography>
          </PageCard>)}
      </Stack>
      <PageCard sx={{
      p: 2,
      mb: 2
    }}>
        <Stack direction={{
        xs: "column",
        md: "row"
      }} spacing={1.5}>
          <TextField fullWidth label={t("Ad, SKU və ya barkod")} value={filters.search} onChange={e => filter("search", e.target.value)} />
          <TextField select label={t("Kateqoriya")} value={filters.categoryId} onChange={e => filter("categoryId", e.target.value)} sx={{
          minWidth: 180
        }}>
            <MenuItem value="">{t("Hamısı")}</MenuItem>
            {categories.map(c => <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>)}
          </TextField>
          <TextField select label={t("Stok")} value={filters.status} onChange={e => filter("status", e.target.value)} sx={{
          minWidth: 140
        }}>
            {[["ALL", t("Hamısı")], ["IN_STOCK", "Stokda var"], ["LOW", t("Az qalıb")], ["OUT", "Bitib"]].map(([value, label]) => <MenuItem key={value} value={value}>
                {label}
              </MenuItem>)}
          </TextField>
          <TextField select label={t("Kataloq")} value={String(filters.archived)} onChange={e => filter("archived", e.target.value === "true")} sx={{
          minWidth: 140
        }}>
            <MenuItem value="false">{t("Aktiv")}</MenuItem>
            <MenuItem value="true">{t("Arxiv")}</MenuItem>
          </TextField>
        </Stack>
      </PageCard>
      <PageCard>
        <DataTable label={t("Məhsullar və stok")} minWidth={760}>
          <TableHead>
            <TableRow>
              {[t("Məhsul"), "SKU / barkod", t("Qalıq"), t("Qiymət"), t("Əməliyyat")].map(h => <TableCell key={h}>{h}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.items || []).map(p => <TableRow key={p.productId}>
                <TableCell>
                  <Typography fontWeight={500}>{p.productName}</Typography>
                  <Typography variant="caption">{p.category?.name}</Typography>
                </TableCell>
                <TableCell>
                  {p.sku || "—"}
                  <br />
                  {p.barcode || "—"}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={p.quantity} color={p.quantity === 0 ? "default" : p.quantity <= 5 ? "warning" : "success"} />
                </TableCell>
                <TableCell>{amountValue(p.salePrice).toFixed(2)}</TableCell>
                <TableCell>
                  <Stack direction="row" flexWrap="wrap">
                    <Button onClick={() => {
                  setDialogError("");
                  setHistoryPage(1);
                  setHistory(p);
                }}>{t("Tarixçə")}</Button>
                    {canCount && !p.archivedAt && <Button onClick={() => {
                  setDialogError("");
                  setCount({
                    ...p,
                    quantity: String(p.quantity),
                    reason: ""
                  });
                }}>{t("Sayım")}</Button>}
                    {admin && <>
                        <Button onClick={() => {
                    setDialogError("");
                    setEdit({
                      id: p.productId,
                      name: p.productName,
                      categoryId: p.category.id,
                      sku: p.sku || "",
                      barcode: p.barcode || "",
                      salePrice: String(p.salePrice)
                    });
                  }}>{t("Dəyiş")}</Button>
                        <Button disabled={saving || !p.archivedAt && p.quantity !== 0} onClick={() => save(() => api.patch(`/catalog/admin/products/${p.productId}`, {
                    archived: !p.archivedAt
                  }))}>
                          {p.archivedAt ? t("Bərpa et") : t("Arxivlə")}
                        </Button>
                      </>}
                  </Stack>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </DataTable>
        {!busy && data?.items.length === 0 && <Typography sx={{
        p: 3
      }}>{t("Məhsul tapılmadı.")}</Typography>}
        <RecordPager pagination={data?.pagination} onChange={setPage} disabled={busy} />
      </PageCard>
      <Dialog open={!!edit} onClose={() => !saving && setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>{edit?.id ? t("Məhsulu dəyiş") : t("Yeni məhsul")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{
          pt: 1
        }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            {edit && <>
                <TextField label={t("Məhsul adı")} value={edit.name} onChange={e => setEdit({
              ...edit,
              name: e.target.value
            })} />
                <TextField select label={t("Kateqoriya")} value={edit.categoryId} onChange={e => setEdit({
              ...edit,
              categoryId: e.target.value
            })}>
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>)}
                </TextField>
                {["sku", "barcode", "salePrice", ...(!edit.id ? ["quantity"] : [])].map(key => <TextField key={key} label={{
              sku: "SKU",
              barcode: "Barkod",
              salePrice: t("Satış qiyməti"),
              quantity: t("İlkin qalıq")
            }[key]} value={edit[key]} onChange={e => setEdit({
              ...edit,
              [key]: e.target.value
            })} />)}
              </>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setEdit(null)}>{t("Ləğv et")}</Button>
          <Button disabled={saving || !edit?.name || !edit?.categoryId} variant="contained" onClick={() => save(() => edit.id ? api.patch(`/catalog/admin/products/${edit.id}`, {
          name: edit.name,
          categoryId: edit.categoryId,
          sku: edit.sku,
          barcode: edit.barcode,
          salePrice: edit.salePrice
        }) : api.post("/catalog/admin/products", edit))}>{t("Saxla")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!count} onClose={() => !saving && setCount(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t("Stok sayımı ·")}{count?.productName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{
          pt: 1
        }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Alert severity="info">{t("Yeni faktiki qalığı yaz. Bu əməliyyatın səbəbi və hesabın adı tarixçədə saxlanacaq.")}</Alert>
            <TextField label={t("Faktiki qalıq")} value={count?.quantity || ""} onChange={e => setCount({
            ...count,
            quantity: e.target.value
          })} />
            <TextField label={t("Düzəlişin səbəbi")} value={count?.reason || ""} onChange={e => setCount({
            ...count,
            reason: e.target.value
          })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setCount(null)}>{t("Ləğv et")}</Button>
          <Button variant="contained" disabled={saving || !count?.reason?.trim()} onClick={() => save(() => api.patch(`/stock/${count.productId}`, {
          quantity: count.quantity,
          expectedVersion: count.version,
          reason: count.reason
        }))}>{t("Sayımı saxla")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!history} onClose={() => setHistory(null)} fullWidth maxWidth="md">
        <DialogTitle>{t("Stok tarixçəsi ·")}{history?.productName}</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity="error">{dialogError}</Alert>}
          <DataTable minWidth={700}>
            <TableHead>
              <TableRow>
                {["Tarix", t("Əməliyyat / səbəb"), t("İstifadəçi"), t("Əvvəl"), t("Dəyişiklik"), "Sonra"].map(h => <TableCell key={h}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {movements?.movements.map(m => <TableRow key={m.id}>
                  <TableCell>
                    <RecordDate value={m.createdAt} />
                  </TableCell>
                  <TableCell>
                    {m.kind}
                    <Typography variant="caption" display="block">
                      {m.reason}
                    </Typography>
                  </TableCell>
                  <TableCell>{m.actorName}</TableCell>
                  <TableCell>{m.before}</TableCell>
                  <TableCell>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </TableCell>
                  <TableCell>{m.after}</TableCell>
                </TableRow>)}
            </TableBody>
          </DataTable>
          <RecordPager pagination={movements?.pagination} onChange={setHistoryPage} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(null)}>{t("Bağla")}</Button>
        </DialogActions>
      </Dialog>
    </PageLayout>;
}
