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
  IconButton,
  Divider,
} from "@mui/material";
import PaidIcon from "@mui/icons-material/Paid";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import StoreIcon from "@mui/icons-material/Store";
import PhoneIcon from "@mui/icons-material/Phone";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import RefreshIcon from "@mui/icons-material/Refresh";
import PhotoCameraBackOutlinedIcon from "@mui/icons-material/PhotoCameraBackOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
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
      if (item?.isGift) return itemSum;
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

  if (customer?.summary?.returnTotal != null) {
    return Number(customer.summary.returnTotal || 0);
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

function getCustomerAggregatedProducts(customer) {
  if (!customer?.orders || !Array.isArray(customer.orders)) return [];

  const soldMap = {};
  const returnedMap = {};

  for (const order of customer.orders || []) {
    for (const item of order.items || []) {
      if (!item?.productId || item?.isGift) continue;

      if (!soldMap[item.productId]) {
        soldMap[item.productId] = {
          productId: item.productId,
          productName: item.product?.name || "-",
          categoryName: item.product?.category?.name || "-",
          soldQty: 0,
          returnedQty: 0,
          returnableQty: 0,
        };
      }

      soldMap[item.productId].soldQty += Number(item.quantity || 0);
    }
  }

  for (const ret of customer.returns || []) {
    for (const item of ret.items || []) {
      if (!item?.productId) continue;
      returnedMap[item.productId] =
        Number(returnedMap[item.productId] || 0) + Number(item.quantity || 0);
    }
  }

  const result = Object.values(soldMap)
    .map((item) => {
      const returnedQty = Number(returnedMap[item.productId] || 0);
      const returnableQty = Math.max(
        Number(item.soldQty || 0) - returnedQty,
        0,
      );

      return {
        ...item,
        returnedQty,
        returnableQty,
      };
    })
    .filter((item) => item.returnableQty > 0);

  result.sort((a, b) => a.productName.localeCompare(b.productName, "az"));
  return result;
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
    imageFile: null,
    imagePreview: "",
    soldItems: [],
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

  const customerProducts = useMemo(() => {
    return getCustomerAggregatedProducts(selectedCustomer);
  }, [selectedCustomer]);

  const selectedSoldItemsCount = useMemo(() => {
    return form.soldItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
  }, [form.soldItems]);

  function openReceiptModal(customer) {
    if (!canCreateReceipt) return;

    setSelectedCustomer(customer);
    setForm({
      amount: "",
      paymentType: "NAĞD",
      note: "",
      date: new Date().toISOString().slice(0, 10),
      imageFile: null,
      imagePreview: "",
      soldItems: [],
    });
    setOpen(true);
  }

  function closeReceiptModal() {
    setOpen(false);
    setSelectedCustomer(null);

    if (form.imagePreview) {
      URL.revokeObjectURL(form.imagePreview);
    }

    setForm({
      amount: "",
      paymentType: "NAĞD",
      note: "",
      date: new Date().toISOString().slice(0, 10),
      imageFile: null,
      imagePreview: "",
      soldItems: [],
    });
  }

  function handleRefresh() {
    fetchCustomers(search, expeditorId);
  }

  function handleReset() {
    setSearch("");
    setExpeditorId("");
    fetchCustomers("", "");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (form.imagePreview) {
      URL.revokeObjectURL(form.imagePreview);
    }

    const preview = URL.createObjectURL(file);

    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  }

  function removeSelectedImage() {
    if (form.imagePreview) {
      URL.revokeObjectURL(form.imagePreview);
    }

    setForm((prev) => ({
      ...prev,
      imageFile: null,
      imagePreview: "",
    }));
  }

  function changeSoldItemQty(product, nextQty) {
    const safeMax = Number(product.returnableQty || 0);
    const safeQty = Math.max(0, Math.min(Number(nextQty || 0), safeMax));

    setForm((prev) => {
      const others = prev.soldItems.filter(
        (item) => item.productId !== product.productId,
      );

      if (safeQty <= 0) {
        return {
          ...prev,
          soldItems: others,
        };
      }

      return {
        ...prev,
        soldItems: [
          ...others,
          {
            productId: product.productId,
            quantity: safeQty,
          },
        ],
      };
    });
  }

  function getSelectedQty(productId) {
    return (
      form.soldItems.find((item) => item.productId === productId)?.quantity || 0
    );
  }

  async function uploadImageAndGetUrl(file) {
    if (!file) return "";

    // Əgər ayrıca upload endpoint-in varsa bunu onunla əvəz et
    // const fd = new FormData();
    // fd.append("file", file);
    // const { data } = await api.post("/uploads", fd, {
    //   headers: { "Content-Type": "multipart/form-data" },
    // });
    // return data.url;

    // Müvəqqəti variant: base64 çevirib göndərmək
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

      let imageUrl = "";

      if (form.imageFile) {
        imageUrl = await uploadImageAndGetUrl(form.imageFile);
      }

      await api.post("/payments", {
        customerId: selectedCustomer.id,
        amount,
        paymentType: form.paymentType,
        note: form.note,
        date: form.date,
        imageUrl,
        soldItems: form.soldItems,
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

      <Dialog open={open} onClose={closeReceiptModal} fullWidth maxWidth="md">
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

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Məbləğ"
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label="Ödəniş növü"
                    value={form.paymentType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        paymentType: e.target.value,
                      }))
                    }
                    fullWidth
                  >
                    {PAYMENT_METHODS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12}>
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
                </Grid>

                <Grid item xs={12}>
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
                </Grid>
              </Grid>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                  spacing={2}
                  mb={form.imagePreview ? 2 : 0}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ImageOutlinedIcon />
                      <Typography fontWeight={800}>Şəkil əlavə et</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Çek, vitrin və ya ödənişlə bağlı şəkil əlavə edə bilərsən
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCameraBackOutlinedIcon />}
                    >
                      Qalereyadan seç
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </Button>

                    {form.imagePreview && (
                      <Button
                        color="error"
                        variant="outlined"
                        startIcon={<DeleteOutlineOutlinedIcon />}
                        onClick={removeSelectedImage}
                      >
                        Sil
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {form.imagePreview && (
                  <Box
                    sx={{
                      mt: 1,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      component="img"
                      src={form.imagePreview}
                      alt="payment-preview"
                      sx={{
                        width: "100%",
                        maxWidth: 320,
                        height: 220,
                        objectFit: "cover",
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  </Box>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                  spacing={1.5}
                  mb={2}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Inventory2OutlinedIcon />
                      <Typography fontWeight={800}>
                        Satılmış məhsulları qeyd et
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Bu mədaxildə hansı məhsulların pulu yığıldığını qeyd et
                    </Typography>
                  </Box>

                  <Chip
                    color="primary"
                    variant="outlined"
                    label={`Seçilən ümumi say: ${selectedSoldItemsCount}`}
                  />
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {customerProducts.length === 0 ? (
                  <Alert severity="info">
                    Bu müştərinin seçilə biləcək satış məhsulu tapılmadı
                  </Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {customerProducts.map((product) => {
                      const selectedQty = getSelectedQty(product.productId);

                      return (
                        <Paper
                          key={product.productId}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            backgroundColor:
                              selectedQty > 0
                                ? "rgba(25,118,210,0.04)"
                                : "#fff",
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "stretch", md: "center" }}
                            justifyContent="space-between"
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight={800}>
                                {product.productName}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {product.categoryName}
                              </Typography>

                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                mt={1}
                              >
                                <Chip
                                  size="small"
                                  label={`Satılıb: ${product.soldQty}`}
                                  variant="outlined"
                                />
                                <Chip
                                  size="small"
                                  label={`Qaytarılıb: ${product.returnedQty}`}
                                  variant="outlined"
                                />
                                <Chip
                                  size="small"
                                  color="primary"
                                  label={`Qeyd edilə bilər: ${product.returnableQty}`}
                                  variant="outlined"
                                />
                              </Stack>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              justifyContent="center"
                            >
                              <IconButton
                                onClick={() =>
                                  changeSoldItemQty(
                                    product,
                                    Number(selectedQty || 0) - 1,
                                  )
                                }
                                disabled={selectedQty <= 0}
                              >
                                <RemoveIcon />
                              </IconButton>

                              <TextField
                                size="small"
                                type="number"
                                label="Satıldı"
                                value={selectedQty}
                                onChange={(e) =>
                                  changeSoldItemQty(product, e.target.value)
                                }
                                inputProps={{
                                  min: 0,
                                  max: product.returnableQty,
                                }}
                                sx={{ width: 120 }}
                              />

                              <IconButton
                                onClick={() =>
                                  changeSoldItemQty(
                                    product,
                                    Number(selectedQty || 0) + 1,
                                  )
                                }
                                disabled={selectedQty >= product.returnableQty}
                              >
                                <AddIcon />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
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
