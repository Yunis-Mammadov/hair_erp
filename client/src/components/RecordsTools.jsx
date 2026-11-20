import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useState } from "react";
import { Button, Stack, Typography, Pagination } from "@mui/material";
import CustomerImport from "./CustomerImport";
import { exportRecords } from "../lib/records";
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
export function ImportButton(props) { return <CustomerImport {...props}/>; }
