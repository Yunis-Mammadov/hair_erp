import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { api } from "../lib/api";
import { RecordPager } from "./RecordsTools";
export default function ProductSearch({
  onAdd
}) {
  useI18n();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        setData(null);
        return;
      }
      setBusy(true);
      try {
        const {
          data
        } = await api.get("/catalog/products", {
          params: {
            search,
            page,
            limit: 10
          }
        });
        if (active) {
          setData(data);
          setError("");
        }
      } catch {
        if (active) setError(t("Axtarış alınmadı."));
      } finally {
        if (active) setBusy(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page]);
  return <Box sx={{
    mb: 2
  }}>
      <TextField fullWidth label={t("Bütün məhsullarda axtar")} placeholder={t("Məhsul adı, SKU və ya barkod")} value={search} onChange={e => {
      setSearch(e.target.value);
      setPage(1);
    }} />
      {error && <Alert severity="error">{error}</Alert>}
      {data && <Box sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      mt: 1,
      p: 1
    }}>
          {busy && <Typography variant="caption">{t("Yüklənir…")}</Typography>}
          {data.products.length === 0 && <Typography sx={{
        p: 1
      }}>{t("Məhsul tapılmadı.")}</Typography>}
          {data.products.map(p => <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{
        p: 1,
        borderBottom: "1px solid",
        borderColor: "divider"
      }}>
              <Box>
                <Typography fontWeight={500}>{p.name}</Typography>
                <Typography variant="caption">
                  {p.category?.name} · {p.sku || p.barcode || "Kodsuz"}{t("· Qalıq:")}{" "}
                  {p.stockQty}
                </Typography>
              </Box>
              <Button size="small" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await onAdd(p);
          } catch {
            setError(t("Məhsul əlavə edilmədi. Yenidən cəhd et."));
          } finally {
            setBusy(false);
          }
        }}>{t("Əlavə et")}</Button>
            </Stack>)}
          <RecordPager pagination={data.pagination} onChange={setPage} disabled={busy} />
        </Box>}
    </Box>;
}
