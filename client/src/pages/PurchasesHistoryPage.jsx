import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Collapse,
  IconButton,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { api } from "../lib/api";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("az-AZ");
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

function PurchaseRow({ purchase }) {
  const [open, setOpen] = useState(false);

  const totals = useMemo(() => {
    const totalQty = (purchase.items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );

    const totalAmount = (purchase.items || []).reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
      0,
    );

    return { totalQty, totalAmount };
  }, [purchase.items]);

  return (
    <>
      <TableRow hover>
        <TableCell width={60}>
          <IconButton size="small" onClick={() => setOpen((p) => !p)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell>
          <Typography fontWeight={700}>
            {purchase.id?.slice(0, 8) || "-"}...
          </Typography>
        </TableCell>

        <TableCell>{purchase.supplier || "-"}</TableCell>
        <TableCell>{purchase.invoiceNo || "-"}</TableCell>
        <TableCell>
          <Chip
            label={`${totals.totalQty} ədəd`}
            size="small"
            sx={{ fontWeight: 800, borderRadius: 999 }}
          />
        </TableCell>
        <TableCell>
          <Chip
            label={formatMoney(totals.totalAmount)}
            size="small"
            color="success"
            sx={{ fontWeight: 800, borderRadius: 999 }}
          />
        </TableCell>
        <TableCell>{purchase.createdBy?.fullName || "-"}</TableCell>
        <TableCell>{formatDate(purchase.createdAt)}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: "background.default" }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    Qeyd:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {purchase.note || "-"}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                    Məhsullar
                  </Typography>

                  {purchase.items?.length ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              <strong>Məhsul</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Kateqoriya</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Miqdar</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Alış qiyməti</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Məbləğ</strong>
                            </TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {purchase.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.product?.name || "-"}</TableCell>
                              <TableCell>
                                {item.product?.category?.name || "-"}
                              </TableCell>
                              <TableCell>{item.quantity || 0}</TableCell>
                              <TableCell>
                                {formatMoney(item.unitCost)}
                              </TableCell>
                              <TableCell>
                                {formatMoney(
                                  Number(item.quantity || 0) *
                                    Number(item.unitCost || 0),
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Məhsul yoxdur.
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function PurchaseHistoryPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    startDate: "",
    endDate: "",
  });

  async function fetchPurchases(customFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/purchases", {
        params: customFilters,
      });

      setRows(res.data?.purchases || []);
      setPagination(res.data?.pagination || null);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Purchase history yüklənmədi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit]);

  function handleSearch() {
    const next = { ...filters, page: 1 };
    setFilters(next);
    fetchPurchases(next);
  }

  function resetFilters() {
    const next = {
      page: 1,
      limit: 10,
      search: "",
      startDate: "",
      endDate: "",
    };
    setFilters(next);
    fetchPurchases(next);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1500, mx: "auto" }}>
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            alignItems={{ lg: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 900, letterSpacing: -0.6 }}
              >
                Alış tarixçəsi
              </Typography>
              <Typography sx={{ opacity: 0.8, mt: 0.5 }}>
                Yazılmış alış sənədləri və onların məhsul detalları
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={resetFilters}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                Sıfırla
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 140px 140px" },
              gap: 1.5,
            }}
          >
            <TextField
              label="Search"
              placeholder="Supplier, invoice, qeyd..."
              value={filters.search}
              onChange={(e) =>
                setFilters((p) => ({ ...p, search: e.target.value }))
              }
            />

            <TextField
              label="Başlanğıc tarix"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((p) => ({ ...p, startDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Son tarix"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((p) => ({ ...p, endDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              select
              label="Limit"
              value={filters.limit}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  limit: Number(e.target.value),
                  page: 1,
                }))
              }
            >
              {[10, 20, 50, 100].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              onClick={handleSearch}
              sx={{ borderRadius: 3, fontWeight: 900 }}
            >
              Axtar
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          {loading ? (
            <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : rows.length === 0 ? (
            <Alert severity="info">Alış tarixçəsi boşdur.</Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell width={60}></TableCell>
                      <TableCell>
                        <strong>ID</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Supplier</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Invoice No</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Miqdar</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Məbləğ</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Yazan</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Tarix</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {rows.map((purchase) => (
                      <PurchaseRow key={purchase.id} purchase={purchase} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Typography variant="body2" color="text.secondary">
                  Toplam: {pagination?.total || 0} sənəd | Səhifə:{" "}
                  {pagination?.page || 1} / {pagination?.totalPages || 1}
                </Typography>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    disabled={!pagination || pagination.page <= 1}
                    onClick={() =>
                      setFilters((p) => ({ ...p, page: p.page - 1 }))
                    }
                  >
                    Geri
                  </Button>

                  <Button
                    variant="outlined"
                    disabled={
                      !pagination || pagination.page >= pagination.totalPages
                    }
                    onClick={() =>
                      setFilters((p) => ({ ...p, page: p.page + 1 }))
                    }
                  >
                    Növbəti
                  </Button>
                </Stack>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
