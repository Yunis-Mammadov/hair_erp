import { useEffect, useState } from "react";
import {
  Alert,
  Box,
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
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
import { DataTable } from "./WorkspaceUI";
import { RecordPager } from "./RecordsTools";
import PdfActions from "./PdfActions";
import { downloadBlob as downloadFile } from "../lib/records";
export default function CustomerStatement({ customer, onClose }) {
  const { t, money, date } = useI18n(),
    [filter, setFilter] = useState({ startDate: "", endDate: "" }),
    [applied, setApplied] = useState({ startDate: "", endDate: "" }),
    [page, setPage] = useState(1),
    [snapshot, setSnapshot] = useState(null),
    [csvError, setCsvError] = useState("");
  const requestKey = JSON.stringify({ id: customer.id, applied, page }),
    current = snapshot?.key === requestKey,
    data = current ? snapshot.data : null,
    aging = current ? snapshot.aging : null,
    error = (current ? snapshot.error : "") || csvError,
    busy = !current;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      api.get(`/extras/customers/${customer.id}/statement`, {
        params: { ...applied, page, limit: 25 },
        signal: controller.signal,
      }),
      api.get(`/extras/customers/${customer.id}/aging`, {
        signal: controller.signal,
      }),
    ])
      .then(([s, a]) => {
        if (active)
          setSnapshot({
            key: requestKey,
            data: s.data,
            aging: a.data,
            error: "",
          });
      })
      .catch((e) => {
        if (active)
          setSnapshot({
            key: requestKey,
            data: null,
            aging: null,
            error: e.response?.data?.message || t("Could not load statement."),
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [customer.id, applied, page, requestKey, t]);
  async function csv() {
    try {
      const r = await api.get(
        `/extras/customers/${customer.id}/statement.csv`,
        { params: applied, responseType: "blob" },
      );
      downloadFile(r.data, "statement.csv");
    } catch {
      setCsvError(t("Could not load statement."));
    }
  }
  return (
    <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
      <DialogTitle>
        {t("Account statement")} · {customer.name}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied({ ...filter });
              setPage(1);
            }}
            sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}
          >
            {[
              ["startDate", "Start date"],
              ["endDate", "End date"],
            ].map(([key, label]) => (
              <TextField
                key={key}
                type="date"
                label={t(label)}
                value={filter[key]}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, [key]: e.target.value }))
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            ))}
            <Button type="submit" disabled={busy}>
              {t("Apply")}
            </Button>
            <Button
              onClick={() => {
                setFilter({ startDate: "", endDate: "" });
                setApplied({ startDate: "", endDate: "" });
                setPage(1);
              }}
            >
              {t("All dates")}
            </Button>
          </Box>
          {aging && (
            <>
              <Typography variant="subtitle2">
                {t("Debt age since invoice date")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {[
                  ["0–30 days", aging.days0to30],
                  ["31–60 days", aging.days31to60],
                  ["Over 60 days", aging.days61plus],
                ].map(([label, value]) => (
                  <Alert key={label} severity={value > 0 ? "warning" : "info"}>
                    {t(label)}: {money(value)}
                  </Alert>
                ))}
              </Stack>
            </>
          )}
          {busy && <Typography role="status">{t("Loading...")}</Typography>}
          {data && (
            <>
              <Typography>
                {t("Opening balance")}: {money(data.openingBalance)} ·{" "}
                {t("Closing balance")}: {money(data.closingBalance)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(
                  "Recorded transactions; negative balance means customer credit.",
                )}
              </Typography>
              <DataTable minWidth={650} label={t("Account statement")}>
                <TableHead>
                  <TableRow>
                    {[
                      "Date",
                      "Type",
                      "Reference",
                      "Debit",
                      "Credit",
                      "Balance",
                    ].map((l) => (
                      <TableCell key={l}>{t(l)}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{date(r.date)}</TableCell>
                      <TableCell>{t(r.type)}</TableCell>
                      <TableCell>{r.reference}</TableCell>
                      <TableCell>{money(r.debit)}</TableCell>
                      <TableCell>{money(r.credit)}</TableCell>
                      <TableCell>{money(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
              <RecordPager
                pagination={data.pagination}
                disabled={busy}
                onChange={setPage}
              />
              <Stack direction="row" spacing={2}>
                <Typography>
                  {t("Debits")}: {money(data.debits)}
                </Typography>
                <Typography>
                  {t("Credits")}: {money(data.credits)}
                </Typography>
              </Stack>
              <PdfActions
                url={`/extras/customers/${customer.id}/statement.pdf`}
                name="statement.pdf"
                params={applied}
              />
              <Button onClick={csv}>{t("Export CSV")}</Button>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("Close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
