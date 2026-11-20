import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
import { DataTable } from "./WorkspaceUI";
import { RecordPager } from "./RecordsTools";
export default function DebtAging({ onClose }) {
  const { t, money, date } = useI18n(),
    [page, setPage] = useState(1),
    [snapshot, setSnapshot] = useState(null);
  const current = snapshot?.page === page,
    data = current ? snapshot.data : null,
    error = current ? snapshot.error : "";
  useEffect(() => {
    let active = true;
    api
      .get("/extras/aging", { params: { page, limit: 25 } })
      .then((r) => {
        if (active) setSnapshot({ page, data: r.data, error: "" });
      })
      .catch((e) => {
        if (active)
          setSnapshot({
            page,
            data: null,
            error: e.response?.data?.message || t("Could not load statement."),
          });
      });
    return () => {
      active = false;
    };
  }, [page, t]);
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{t("Debt aging")}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error ? (
          <Typography role="status">{t("Loading...")}</Typography>
        ) : data ? (
          <Stack spacing={2}>
            <Typography>
              {t("Debt age since invoice date")} · {date(data.asOf)}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {[
                ["0–30 days", data.days0to30],
                ["31–60 days", data.days31to60],
                ["Over 60 days", data.days61plus],
                ["Total", data.totalDebt],
              ].map(([l, v]) => (
                <Alert key={l} severity="info">
                  {t(l)}: {money(v)}
                </Alert>
              ))}
            </Stack>
            <DataTable minWidth={650}>
              <TableHead>
                <TableRow>
                  {[
                    "Customer",
                    "Invoice",
                    "Date",
                    "Age (days)",
                    "Outstanding",
                  ].map((l) => (
                    <TableCell key={l}>{t(l)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.invoices.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Button
                        component={RouterLink}
                        to={`/exp/customers/${r.customerId}`}
                        onClick={onClose}
                      >
                        {r.customerName}
                      </Button>
                    </TableCell>
                    <TableCell>{r.type==='OPENING_BALANCE'?t('OPENING_BALANCE'):r.invoiceNumber || r.orderNumber}</TableCell>
                    <TableCell>{date(r.createdAt)}</TableCell>
                    <TableCell>{r.ageDays}</TableCell>
                    <TableCell>{money(r.remainingDebt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
            <RecordPager pagination={data.pagination} onChange={setPage} />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("Close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
