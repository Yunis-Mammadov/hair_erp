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
  Paper,
  Grid,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
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
      <TableRow hover sx={{ "& td": { verticalAlign: "middle" } }}>
        <TableCell width={64} align="center">
          <IconButton
            size="small"
            onClick={() => setOpen((p) => !p)}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: open ? "rgba(25,118,210,0.05)" : "#fff",
            }}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell>
          <Typography fontWeight={800}>
            {purchase.id?.slice(0, 8) || "-"}...
          </Typography>
        </TableCell>

        <TableCell>{purchase.supplier || "-"}</TableCell>
        <TableCell>{purchase.invoiceNo || "-"}</TableCell>

        <TableCell>
          <Chip
            label={`${totals.totalQty} ədəd`}
            size="small"
            color="primary"
            variant="outlined"
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
        <TableCell colSpan={8} sx={{ py: 0, border: "none" }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Paper
              variant="outlined"
              sx={{
                m: 1.5,
                p: 2,
                borderRadius: 4,
                bgcolor: "#f8fafc",
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 3, height: "100%" }}
                  >
                    <Stack spacing={1.2}>
                      <Typography fontWeight={800}>Sənəd məlumatı</Typography>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Supplier</Typography>
                        <Typography fontWeight={700}>
                          {purchase.supplier || "-"}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">
                          Invoice No
                        </Typography>
                        <Typography fontWeight={700}>
                          {purchase.invoiceNo || "-"}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Yazan</Typography>
                        <Typography fontWeight={700}>
                          {purchase.createdBy?.fullName || "-"}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Tarix</Typography>
                        <Typography fontWeight={700}>
                          {formatDate(purchase.createdAt)}
                        </Typography>
                      </Stack>

                      <Divider />

                      <Typography variant="body2" color="text.secondary">
                        Qeyd
                      </Typography>
                      <Typography variant="body2">
                        {purchase.note || "-"}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        bgcolor: "#eef2f7",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography fontWeight={800}>Məhsullar</Typography>
                    </Box>

                    {purchase.items?.length ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell align="center">
                                <strong>Məhsul</strong>
                              </TableCell>
                              <TableCell align="center">
                                <strong>Kateqoriya</strong>
                              </TableCell>
                              <TableCell align="center">
                                <strong>Miqdar</strong>
                              </TableCell>
                              <TableCell align="center">
                                <strong>Alış qiyməti</strong>
                              </TableCell>
                              <TableCell align="center">
                                <strong>Məbləğ</strong>
                              </TableCell>
                            </TableRow>
                          </TableHead>

                          <TableBody>
                            {purchase.items.map((item) => (
                              <TableRow key={item.id} hover>
                                <TableCell align="center">
                                  {item.product?.name || "-"}
                                </TableCell>
                                <TableCell align="center">
                                  {item.product?.category?.name || "-"}
                                </TableCell>
                                <TableCell align="center">
                                  {item.quantity || 0}
                                </TableCell>
                                <TableCell align="center">
                                  {formatMoney(item.unitCost)}
                                </TableCell>
                                <TableCell align="center">
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
                      <Box sx={{ p: 2 }}>
                        <Alert severity="info">Məhsul yoxdur.</Alert>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
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
      setError(e?.response?.data?.message || "Alış tarixçəsi yüklənmədi");
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

  const stats = useMemo(() => {
    const documents = rows.length;

    const totalQty = rows.reduce((sum, purchase) => {
      return (
        sum +
        (purchase.items || []).reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        )
      );
    }, 0);

    const totalAmount = rows.reduce((sum, purchase) => {
      return (
        sum +
        (purchase.items || []).reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unitCost || 0),
          0,
        )
      );
    }, 0);

    return {
      documents,
      totalQty,
      totalAmount,
    };
  }, [rows]);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        maxWidth: 1600,
        mx: "auto",
        bgcolor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <Card
        sx={{
          borderRadius: 5,
          mb: 2.5,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 12px 35px rgba(15,23,42,0.06)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={2.5}
            justifyContent="space-between"
            alignItems={{ xl: "center" }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 900, letterSpacing: -0.8 }}
              >
                Alış tarixçəsi
              </Typography>
              <Typography sx={{ opacity: 0.78, mt: 0.5 }}>
                Yazılmış alış sənədləri, məhsul detalları və ümumi məbləğlər
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              flexWrap="wrap"
              useFlexGap
            >
              <Chip
                icon={<ReceiptLongOutlinedIcon />}
                label={`Sənəd: ${stats.documents}`}
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
              <Chip
                icon={<Inventory2OutlinedIcon />}
                label={`Miqdar: ${stats.totalQty}`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
              <Chip
                icon={<PaidOutlinedIcon />}
                label={formatMoney(stats.totalAmount)}
                color="success"
                sx={{ fontWeight: 900, borderRadius: 999 }}
              />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2.2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 140px 140px" },
              gap: 1.5,
            }}
          >
            <TextField
              label="Axtarış"
              placeholder="Supplier, invoice, qeyd..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
            />

            <TextField
              label="Başlanğıc tarix"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, startDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Son tarix"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, endDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              select
              label="Limit"
              value={filters.limit}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
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

            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                sx={{ borderRadius: 3, fontWeight: 900 }}
              >
                Axtar
              </Button>

              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={resetFilters}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                Sıfırla
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: 5,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
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
                <Table
                  sx={{
                    "& th": {
                      backgroundColor: "#f8fafc",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    },
                    "& td, & th": {
                      textAlign: "center",
                      verticalAlign: "middle",
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={64}></TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Invoice No</TableCell>
                      <TableCell>Miqdar</TableCell>
                      <TableCell>Məbləğ</TableCell>
                      <TableCell>Yazan</TableCell>
                      <TableCell>Tarix</TableCell>
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
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<ReceiptLongOutlinedIcon />}
                    label={`Toplam: ${pagination?.total || 0}`}
                    variant="outlined"
                    sx={{ fontWeight: 800, borderRadius: 999 }}
                  />
                  <Chip
                    icon={<CalendarMonthOutlinedIcon />}
                    label={`Səhifə: ${pagination?.page || 1} / ${pagination?.totalPages || 1}`}
                    variant="outlined"
                    sx={{ fontWeight: 800, borderRadius: 999 }}
                  />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    disabled={!pagination || pagination.page <= 1}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
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
                      setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
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
