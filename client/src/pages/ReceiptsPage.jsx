import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import PaidIcon from "@mui/icons-material/Paid";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import StoreIcon from "@mui/icons-material/Store";
import PhoneIcon from "@mui/icons-material/Phone";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getCustomers } from "../lib/customers";
import { api } from "../lib/api";

const PAYMENT_METHODS = ["NAĞD", "KART", "DİGƏR"];

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return null;
    return JSON.parse(rawUser);
  } catch (error) {
    console.error("User parse error:", error);
    return null;
  }
}

function calcOrdersTotal(customer) {
  if (customer?.totalSalesAmount != null) {
    return Number(customer.totalSalesAmount || 0);
  }

  if (customer?.stats?.totalSalesAmount != null) {
    return Number(customer.stats.totalSalesAmount || 0);
  }

  if (customer?.summary?.orderTotal != null) {
    return Number(customer.summary.orderTotal || 0);
  }

  return (customer?.orders || []).reduce((sum, order) => {
    const itemsTotal = (order?.items || []).reduce((itemSum, item) => {
      return (
        itemSum + Number(item?.quantity || 0) * Number(item?.unitPrice || 0)
      );
    }, 0);

    return sum + itemsTotal;
  }, 0);
}

function calcPaymentsTotal(customer) {
  if (customer?.totalPaidAmount != null) {
    return Number(customer.totalPaidAmount || 0);
  }

  if (customer?.stats?.totalPaidAmount != null) {
    return Number(customer.stats.totalPaidAmount || 0);
  }

  if (customer?.summary?.paymentTotal != null) {
    return Number(customer.summary.paymentTotal || 0);
  }

  return (customer?.payments || []).reduce((sum, payment) => {
    return sum + Number(payment?.amount || 0);
  }, 0);
}

function calcReturnsTotal(customer) {
  if (customer?.totalReturnsAmount != null) {
    return Number(customer.totalReturnsAmount || 0);
  }

  if (customer?.stats?.totalReturnsAmount != null) {
    return Number(customer.stats.totalReturnsAmount || 0);
  }

  return (customer?.returns || []).reduce((sum, ret) => {
    const itemsTotal = (ret?.items || []).reduce((itemSum, item) => {
      return (
        itemSum + Number(item?.quantity || 0) * Number(item?.unitPrice || 0)
      );
    }, 0);

    return sum + itemsTotal;
  }, 0);
}

function getCustomerDebt(customer) {
  const explicitDebt =
    customer?.debtAmount ??
    customer?.currentDebt ??
    customer?.remainingDebt ??
    customer?.stats?.debtAmount ??
    customer?.summary?.debt;

  if (explicitDebt != null) return Number(explicitDebt || 0);

  const totalSales = calcOrdersTotal(customer);
  const totalPaid = calcPaymentsTotal(customer);
  const totalReturns = calcReturnsTotal(customer);

  const debt = Number(totalSales) - Number(totalPaid) - Number(totalReturns);
  return debt > 0 ? debt : 0;
}

export default function ReceiptsPage() {
  const currentUser = useMemo(() => getStoredUser(), []);

  const canFilterExpeditor =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "DRIVER" ||
    currentUser?.role === "WAREHOUSE";

  const canCreateReceipt =
    currentUser?.role === "ADMIN" || currentUser?.role === "EXPEDITOR";

  const [customers, setCustomers] = useState([]);
  const [expeditors, setExpeditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    paymentType: "NAĞD",
    note: "",
    date: new Date().toISOString().slice(0, 10),
  });

  async function fetchCustomers(searchValue = "", selectedExpeditorId = "") {
    try {
      setLoading(true);
      setError("");

      const data = await getCustomers(searchValue, selectedExpeditorId);
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Fetch customers error:", err);
      setError(err?.response?.data?.message || "Müştərilər yüklənə bilmədi");
    } finally {
      setLoading(false);
    }
  }

  async function fetchExpeditors() {
    if (!canFilterExpeditor) return;

    try {
      const { data } = await api.get("/users", {
        params: { role: "EXPEDITOR" },
      });

      setExpeditors(data.users || []);
    } catch (err) {
      console.error("Fetch expeditors error:", err);
      setExpeditors([]);
    }
  }

  useEffect(() => {
    fetchExpeditors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search, expeditorId);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, expeditorId]);

  useEffect(() => {
    fetchCustomers("", "");
  }, []);

  const filteredCustomers = useMemo(() => {
    const mapped = customers.map((customer) => {
      const totalSales = calcOrdersTotal(customer);
      const totalPaid = calcPaymentsTotal(customer);
      const totalReturns = calcReturnsTotal(customer);
      const calculatedDebt = getCustomerDebt(customer);

      return {
        ...customer,
        totalSalesCalculated: totalSales,
        totalPaidCalculated: totalPaid,
        totalReturnsCalculated: totalReturns,
        calculatedDebt,
      };
    });

    return mapped.sort((a, b) => b.calculatedDebt - a.calculatedDebt);
  }, [customers]);

  const totalDebt = useMemo(() => {
    return filteredCustomers.reduce(
      (sum, customer) => sum + Number(customer.calculatedDebt || 0),
      0,
    );
  }, [filteredCustomers]);

  const totalCustomersWithDebt = useMemo(() => {
    return filteredCustomers.filter((customer) => customer.calculatedDebt > 0)
      .length;
  }, [filteredCustomers]);

  function openReceiptModal(customer) {
    if (!canCreateReceipt) return;

    setSelectedCustomer(customer);
    setForm({
      amount: "",
      paymentType: "NAĞD",
      note: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  }

  function closeReceiptModal() {
    setOpen(false);
    setSelectedCustomer(null);
  }

  async function handleSaveReceipt() {
    if (!selectedCustomer?.id) return;

    const amount = Number(form.amount || 0);
    const customerDebt = Number(selectedCustomer.calculatedDebt || 0);

    if (!amount || amount <= 0) {
      alert("Məbləğ düzgün daxil edilməlidir");
      return;
    }

    if (amount > customerDebt) {
      alert("Daxil edilən məbləğ cari borcdan çox ola bilməz");
      return;
    }

    try {
      setSaving(true);

      await api.post("/payments", {
        customerId: selectedCustomer.id,
        amount,
        paymentType: form.paymentType,
        note: form.note,
        date: form.date,
      });

      closeReceiptModal();
      await fetchCustomers(search, expeditorId);
    } catch (err) {
      console.error("Create payment error:", err);
      alert(err?.response?.data?.message || "Mədaxil əlavə edilə bilmədi");
    } finally {
      setSaving(false);
    }
  }

  function handleRefresh() {
    fetchCustomers(search, expeditorId);
  }

  function handleReset() {
    setSearch("");
    setExpeditorId("");
    fetchCustomers("", "");
  }

  return (
    <Box sx={{ p: 3, bgcolor: "#f8fafc", minHeight: "100vh" }}>
      <Paper
        sx={{
          p: 3,
          borderRadius: 4,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                Mədaxil / Tahsilat
              </Typography>
              <Typography color="text.secondary">
                Müştərilərin cari borclarını izlə və ödəniş əlavə et
              </Typography>
            </Box>
          </Stack>

          <Typography variant="subtitle1" fontWeight={700}>
            Filterlər
          </Typography>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            useFlexGap
            flexWrap="wrap"
          >
            <TextField
              label="Axtarış"
              placeholder="Ad, telefon, salon üzrə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
              sx={{ flex: 1, minWidth: { xs: "100%", md: 320 } }}
            />

            {canFilterExpeditor && (
              <TextField
                select
                label="Ekspeditor"
                value={expeditorId}
                onChange={(e) => setExpeditorId(e.target.value)}
                sx={{ minWidth: { xs: "100%", md: 240 } }}
              >
                <MenuItem value="">Hamısı</MenuItem>
                {expeditors.map((expeditor) => (
                  <MenuItem key={expeditor.id} value={expeditor.id}>
                    {expeditor.fullName || expeditor.email || "-"}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                sx={{ minWidth: 140, height: 56 }}
              >
                Yenilə
              </Button>

              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{ minWidth: 120, height: 56 }}
              >
                Sıfırla
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Müştəri sayı
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {filteredCustomers.length}
                </Typography>
              </Box>
              <PersonIcon />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Borclu müştəri sayı
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {totalCustomersWithDebt}
                </Typography>
              </Box>
              <AccountBalanceWalletIcon />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Ümumi cari borc
                </Typography>
                <Typography variant="h5" fontWeight={800} color="error.main">
                  {formatMoney(totalDebt)}
                </Typography>
              </Box>
              <PaidIcon />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
        }}
      >
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <TableContainer>
            <Table
              sx={{
                "& th, & td": {
                  textAlign: "center",
                  verticalAlign: "middle",
                },
                "& th": {
                  backgroundColor: "#f8fafc",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Müştəri</TableCell>
                  <TableCell>Telefon</TableCell>
                  <TableCell>Salon</TableCell>
                  <TableCell>Ekspeditor</TableCell>
                  <TableCell>Toplam satış</TableCell>
                  <TableCell>Toplam mədaxil</TableCell>
                  <TableCell>Cari borc</TableCell>
                  <TableCell>Əməliyyat</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>Müştəri tapılmadı</TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => {
                    const sales = Number(customer.totalSalesCalculated || 0);
                    const paid = Number(customer.totalPaidCalculated || 0);
                    const debt = Number(customer.calculatedDebt || 0);

                    return (
                      <TableRow
                        key={customer.id}
                        hover
                        sx={{
                          "&:hover": {
                            backgroundColor: "#fafafa",
                          },
                        }}
                      >
                        <TableCell>
                          <Typography fontWeight={700}>
                            {customer.name || "-"}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            justifyContent="center"
                            alignItems="center"
                          >
                            <PhoneIcon fontSize="small" />
                            <Typography>{customer.phone || "-"}</Typography>
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            justifyContent="center"
                            alignItems="center"
                          >
                            <StoreIcon fontSize="small" />
                            <Typography>{customer.salon || "-"}</Typography>
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            justifyContent="center"
                            alignItems="center"
                          >
                            <PersonIcon fontSize="small" />
                            <Typography>
                              {customer.assignedExpeditor?.fullName ||
                                customer.assignedExpeditor?.email ||
                                "-"}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell>{formatMoney(sales)}</TableCell>
                        <TableCell>{formatMoney(paid)}</TableCell>

                        <TableCell>
                          <Chip
                            label={formatMoney(debt)}
                            color={debt > 0 ? "error" : "success"}
                            variant={debt > 0 ? "filled" : "outlined"}
                          />
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PaidIcon />}
                            disabled={!canCreateReceipt || debt <= 0}
                            onClick={() => openReceiptModal(customer)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Mədaxil əlavə et
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={closeReceiptModal} fullWidth maxWidth="sm">
        <DialogTitle>
          <Typography component="span" variant="h6" fontWeight={800}>
            Mədaxil əlavə et
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {!selectedCustomer ? null : (
            <Stack spacing={2.25}>
              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3, bgcolor: "#f8fafc" }}
              >
                <Stack spacing={1}>
                  <Typography>
                    <b>Müştəri:</b> {selectedCustomer.name || "-"}
                  </Typography>
                  <Typography>
                    <b>Telefon:</b> {selectedCustomer.phone || "-"}
                  </Typography>
                  <Typography>
                    <b>Salon:</b> {selectedCustomer.salon || "-"}
                  </Typography>
                  <Typography>
                    <b>Ekspeditor:</b>{" "}
                    {selectedCustomer.assignedExpeditor?.fullName ||
                      selectedCustomer.assignedExpeditor?.email ||
                      "-"}
                  </Typography>
                  <Typography color="error.main" fontWeight={800}>
                    <b>Cari borc:</b>{" "}
                    {formatMoney(selectedCustomer.calculatedDebt)}
                  </Typography>
                </Stack>
              </Paper>

              <TextField
                label="Məbləğ"
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                fullWidth
              />

              <TextField
                select
                label="Ödəniş növü"
                value={form.paymentType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paymentType: e.target.value }))
                }
                fullWidth
              >
                {PAYMENT_METHODS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Tarix"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                label="Qeyd"
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeReceiptModal} disabled={saving}>
            Bağla
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveReceipt}
            disabled={saving}
            startIcon={<PaidIcon />}
          >
            {saving ? "Yadda saxlanır..." : "Yadda saxla"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
