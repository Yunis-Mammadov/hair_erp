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
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  TextField,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import StoreIcon from "@mui/icons-material/Store";
import PlaceIcon from "@mui/icons-material/Place";
import PaidIcon from "@mui/icons-material/Paid";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LaunchIcon from "@mui/icons-material/Launch";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { useNavigate, useParams } from "react-router-dom";
import { getCustomerById } from "../lib/customers";
import { api } from "../lib/api";

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("az-AZ");
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)} ₼`;
}

function getItemsCount(items = []) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getOrderNumber(order, index) {
  return (
    order?.invoiceNo ||
    order?.invoiceNumber ||
    order?.orderNumber ||
    order?.orderNo ||
    order?.documentNumber ||
    (order?.id
      ? `ORD-${String(order.id).slice(-6).toUpperCase()}`
      : `ORD-${index + 1}`)
  );
}

function getPaymentMethodLabel(paymentType) {
  if (!paymentType) return "-";

  const map = {
    CASH: "Nağd",
    CARD: "Kart",
    TRANSFER: "Köçürmə",
    CREDIT: "Nisyə",
    DEBT: "Borc",
    NAĞD: "Nağd",
    KART: "Kart",
    KÖÇÜRMƏ: "Köçürmə",
    DİGƏR: "Digər",
    REALİZASİYA: "Realizasiya",
    HİSSƏLİ: "Hissəli",
  };

  return map[paymentType] || paymentType;
}

function getOrderTotal(order) {
  if (order?.totalAmount != null) return Number(order.totalAmount || 0);
  if (order?.grandTotal != null) return Number(order.grandTotal || 0);
  if (order?.total != null) return Number(order.total || 0);

  return (order?.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(
      item.unitPrice ??
        item.price ??
        item.salePrice ??
        item.product?.price ??
        0,
    );
    if (item.isGift) return sum;
    return sum + quantity * unitPrice;
  }, 0);
}

function getReturnTotal(returnDoc) {
  if (returnDoc?.totalAmount != null) return Number(returnDoc.totalAmount || 0);
  if (returnDoc?.total != null) return Number(returnDoc.total || 0);

  return (returnDoc?.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(
      item.unitPrice ??
        item.price ??
        item.salePrice ??
        item.product?.price ??
        0,
    );
    return sum + quantity * unitPrice;
  }, 0);
}

function getPaymentAmount(payment) {
  return Number(payment?.amount || payment?.paidAmount || payment?.value || 0);
}

function getOrderPaidAmount(order) {
  if (order?.allocatedPayment != null) {
    return Number(order.allocatedPayment || 0);
  }

  if (order?.paidAmount != null) {
    return Number(order.paidAmount || 0);
  }

  if (order?.amountPaid != null) {
    return Number(order.amountPaid || 0);
  }

  return 0;
}

function getOrderReturnedAmount(order) {
  if (order?.allocatedReturn != null) {
    return Number(order.allocatedReturn || 0);
  }

  return 0;
}

function getOrderRemainingDebt(order) {
  if (order?.remainingDebt != null) {
    return Number(order.remainingDebt || 0);
  }

  if (order?.remainingAmount != null) {
    return Number(order.remainingAmount || 0);
  }

  const total = getOrderTotal(order);
  const paid = getOrderPaidAmount(order);
  const returned = getOrderReturnedAmount(order);

  const debt = total - paid - returned;
  return debt > 0 ? debt : 0;
}

function getOrderStatus(order) {
  if (order?.financialStatus) return order.financialStatus;

  const total = getOrderTotal(order);
  const paid = getOrderPaidAmount(order);
  const returned = getOrderReturnedAmount(order);
  const debt = getOrderRemainingDebt(order);

  if (total <= 0) return "BORCLU";
  if (debt <= 0) return "ODENIB";
  if (paid > 0 || returned > 0) return "QISMEN_ODENIB";
  return "BORCLU";
}

function getStatusChipProps(status) {
  switch (status) {
    case "ODENIB":
      return { label: "Ödənib", color: "success" };
    case "QISMEN_ODENIB":
      return { label: "Qismən ödənib", color: "warning" };
    case "BORCLU":
      return { label: "Borclu", color: "error" };
    default:
      return { label: "Naməlum", color: "default" };
  }
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

function SummaryCard({ title, value, icon, color = "#111827", subtitle }) {
  return (
    <Paper
      sx={{
        p: 2.25,
        borderRadius: 4,
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
        boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {title}
          </Typography>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ color, lineHeight: 1.2 }}
          >
            {value}
          </Typography>
          {subtitle ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.75, display: "block" }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(15,23,42,0.05)",
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemSaving, setProblemSaving] = useState(false);
  const [problemNote, setProblemNote] = useState("");

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedPaymentImage, setSelectedPaymentImage] = useState(null);

  async function fetchCustomerDetail() {
    try {
      setLoading(true);
      setError("");

      const res = await getCustomerById(id);
      setData(res);
    } catch (err) {
      console.error("CUSTOMER_DETAIL_FETCH_ERROR:", err);
      setError(
        err?.response?.data?.message || "Müştəri detalı yüklənə bilmədi",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomerDetail();
  }, [id]);

  const customer = data?.customer || null;
  const summary = data?.summary || customer?.summary || {};

  useEffect(() => {
    setProblemNote(customer?.problemNote || "");
  }, [customer?.problemNote]);

  function openPaymentImage(payment) {
    if (!payment?.imageUrl) return;
    setSelectedPaymentImage(payment);
    setImagePreviewOpen(true);
  }

  function closePaymentImage() {
    setImagePreviewOpen(false);
    setSelectedPaymentImage(null);
  }

  async function handleSaveProblemCustomer() {
    try {
      setProblemSaving(true);

      await api.put(`/customers/${id}`, {
        isProblematic: true,
        problemNote: problemNote.trim(),
      });

      setProblemModalOpen(false);
      await fetchCustomerDetail();
    } catch (err) {
      console.error("PROBLEM_CUSTOMER_SAVE_ERROR:", err);
    } finally {
      setProblemSaving(false);
    }
  }

  async function handleClearProblemCustomer() {
    try {
      setProblemSaving(true);

      await api.put(`/customers/${id}`, {
        isProblematic: false,
        problemNote: "",
      });

      setProblemModalOpen(false);
      await fetchCustomerDetail();
    } catch (err) {
      console.error("PROBLEM_CUSTOMER_CLEAR_ERROR:", err);
    } finally {
      setProblemSaving(false);
    }
  }

  const orders = customer?.orders || [];
  const returns = customer?.returns || [];
  const payments =
    customer?.payments ||
    customer?.cashEntries ||
    customer?.receipts ||
    customer?.transactions ||
    [];

  const totalOrderedItems = useMemo(() => {
    return orders.reduce(
      (sum, order) => sum + getItemsCount(order.items || []),
      0,
    );
  }, [orders]);

  const totalReturnedItems = useMemo(() => {
    return returns.reduce(
      (sum, item) => sum + getItemsCount(item.items || []),
      0,
    );
  }, [returns]);

  const totalSalesAmount = useMemo(() => {
    const explicit =
      summary?.orderTotal ??
      customer?.totalSalesAmount ??
      customer?.stats?.totalSalesAmount ??
      customer?.stats?.salesAmount ??
      customer?.stats?.ordersTotal;

    if (explicit != null) return Number(explicit || 0);
    return orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [customer, orders, summary]);

  const totalReturnsAmount = useMemo(() => {
    const explicit =
      summary?.returnTotal ??
      customer?.totalReturnsAmount ??
      customer?.stats?.totalReturnsAmount ??
      customer?.stats?.returnsAmount;

    if (explicit != null) return Number(explicit || 0);
    return returns.reduce((sum, item) => sum + getReturnTotal(item), 0);
  }, [customer, returns, summary]);

  const totalPaidAmount = useMemo(() => {
    const explicit =
      summary?.paymentTotal ??
      customer?.totalPaidAmount ??
      customer?.stats?.totalPaidAmount ??
      customer?.stats?.paidAmount ??
      customer?.stats?.cashInTotal;

    if (explicit != null) return Number(explicit || 0);
    return payments.reduce(
      (sum, payment) => sum + getPaymentAmount(payment),
      0,
    );
  }, [customer, payments, summary]);

  const totalDebt = useMemo(() => {
    const explicit =
      summary?.debt ??
      customer?.debtAmount ??
      customer?.stats?.debtAmount ??
      customer?.stats?.remainingDebt ??
      customer?.stats?.currentDebt;

    if (explicit != null) return Number(explicit || 0);

    const debt = totalSalesAmount - totalPaidAmount - totalReturnsAmount;
    return debt > 0 ? debt : 0;
  }, [
    customer,
    summary,
    totalSalesAmount,
    totalPaidAmount,
    totalReturnsAmount,
  ]);

  const ordersCount = Number(summary?.ordersCount ?? orders.length ?? 0);
  const returnsCount = Number(summary?.returnsCount ?? returns.length ?? 0);
  const paymentsCount = Number(summary?.paymentsCount ?? payments.length ?? 0);

  const mapsUrl =
    customer?.lat != null && customer?.lng != null
      ? `https://www.google.com/maps?q=${customer.lat},${customer.lng}`
      : null;

  const wazeUrl =
    customer?.lat != null && customer?.lng != null
      ? `https://waze.com/ul?ll=${customer.lat},${customer.lng}&navigate=yes`
      : null;

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
  }, [orders]);

  const sortedReturns = useMemo(() => {
    return [...returns].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
  }, [returns]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort(
      (a, b) =>
        new Date(b.paymentDate || b.createdAt || b.date || 0).getTime() -
        new Date(a.paymentDate || a.createdAt || a.date || 0).getTime(),
    );
  }, [payments]);

  if (loading) {
    return (
      <Box sx={{ py: 10, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/exp/customers")}
        >
          Geri
        </Button>
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Müştəri tapılmadı.
        </Alert>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/exp/customers")}
        >
          Geri
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc", minHeight: "100vh" }}>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 5,
          mb: 3,
          border: "1px solid",
          borderColor: customer.isProblematic ? "error.light" : "divider",
          boxShadow: "0 12px 40px rgba(15,23,42,0.07)",
          background: customer.isProblematic
            ? "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(254,242,242,1) 55%, rgba(255,245,245,1) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 55%, rgba(241,245,249,1) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ mb: 1 }}
              flexWrap="wrap"
              useFlexGap
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/exp/customers")}
                sx={{ borderRadius: 3 }}
              >
                Geri
              </Button>

              <Chip
                label={`Müştəri ID: ${
                  customer?.id ? String(customer.id).slice(-6) : "-"
                }`}
                variant="outlined"
                size="small"
              />

              {customer.isProblematic && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Problemli müştəri"
                  color="error"
                  size="small"
                  sx={{ fontWeight: 800 }}
                />
              )}
            </Stack>

            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                mb: 1,
                color: customer.isProblematic ? "error.main" : "inherit",
              }}
            >
              {customer.name || "Adsız müştəri"}
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              flexWrap="wrap"
              useFlexGap
            >
              <Chip
                icon={<PhoneIcon />}
                label={customer.phone || "-"}
                component={customer.phone ? "a" : "div"}
                href={customer.phone ? `tel:${customer.phone}` : undefined}
                clickable={!!customer.phone}
              />
              <Chip
                icon={<StoreIcon />}
                label={customer.salon || "Salon yoxdur"}
              />
              <Chip
                icon={<PlaceIcon />}
                label={customer.address || "Ünvan daxil edilməyib"}
              />
            </Stack>

            {customer.isProblematic && customer.problemNote ? (
              <Paper
                variant="outlined"
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: 3,
                  borderColor: "error.light",
                  bgcolor: "rgba(244, 67, 54, 0.05)",
                  maxWidth: 700,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: "error.main", fontWeight: 800, mb: 0.5 }}
                >
                  Problem qeydi
                </Typography>
                <Typography variant="body2">{customer.problemNote}</Typography>
                {customer.problemMarkedAt ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.75 }}
                  >
                    İşarələnib: {formatDate(customer.problemMarkedAt)}
                  </Typography>
                ) : null}
              </Paper>
            ) : null}
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="flex-start"
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant={customer.isProblematic ? "contained" : "outlined"}
              color="error"
              startIcon={<WarningAmberIcon />}
              onClick={() => setProblemModalOpen(true)}
              sx={{ borderRadius: 3, minWidth: 190 }}
            >
              Problemli müştəri
            </Button>

            <Button
              variant="contained"
              endIcon={<LaunchIcon />}
              href={mapsUrl || undefined}
              target="_blank"
              rel="noreferrer"
              disabled={!mapsUrl}
              sx={{ borderRadius: 3, minWidth: 150 }}
            >
              Google Maps
            </Button>

            <Button
              variant="outlined"
              endIcon={<LaunchIcon />}
              href={wazeUrl || undefined}
              target="_blank"
              rel="noreferrer"
              disabled={!wazeUrl}
              sx={{ borderRadius: 3, minWidth: 130 }}
            >
              Waze
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Toplam sifariş"
            value={ordersCount}
            icon={<ShoppingCartIcon />}
            subtitle={`${totalOrderedItems} məhsul satılıb`}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Toplam satış məbləği"
            value={formatCurrency(totalSalesAmount)}
            icon={<TrendingUpIcon />}
            color="#0f172a"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Toplam mədaxil"
            value={formatCurrency(totalPaidAmount)}
            icon={<PaidIcon />}
            color="#166534"
            subtitle={`${paymentsCount} ödəniş`}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Cari borc"
            value={formatCurrency(totalDebt)}
            icon={<AccountBalanceWalletIcon />}
            color={totalDebt > 0 ? "#b91c1c" : "#166534"}
            subtitle={
              totalDebt > 0 ? "Müştərinin qalıq borcu var" : "Borc görünmür"
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
              height: "100%",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 2.5 }}
            >
              <PersonIcon />
              <Typography variant="h6" fontWeight={800}>
                Müştəri məlumatları
              </Typography>
            </Stack>

            <Stack spacing={2.2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Müştəri adı
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{
                    color: customer.isProblematic ? "error.main" : "inherit",
                  }}
                >
                  {customer.name || "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Telefon
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {customer.phone || "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Salon
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {customer.salon || "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Ünvan
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {customer.address || "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Yaradılıb
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatDate(customer.createdAt)}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Son yenilənmə
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatDate(customer.updatedAt)}
                </Typography>
              </Box>

              {customer.isProblematic && (
                <>
                  <Divider />

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Problem statusu
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight={700}
                      color="error.main"
                    >
                      Problemli müştəri
                    </Typography>
                  </Box>
                </>
              )}

              <Divider />

              <Box
                sx={{
                  p: 2,
                  borderRadius: 4,
                  bgcolor: "#f8fafc",
                  border: "1px dashed",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <InfoOutlinedIcon fontSize="small" />
                  <Typography fontWeight={700}>
                    Əlavə qısa statistika
                  </Typography>
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="body2">
                    Return sayı: <strong>{returnsCount}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Qaytarılan məhsul sayı:{" "}
                    <strong>{totalReturnedItems}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Qaytarma məbləği:{" "}
                    <strong>{formatCurrency(totalReturnsAmount)}</strong>
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, newValue) => setTab(newValue)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                mb: 1,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 700,
                  minHeight: 44,
                },
              }}
            >
              <Tab label={`Satış tarixçəsi (${sortedOrders.length})`} />
              <Tab label={`Mədaxil (${sortedPayments.length})`} />
              <Tab label={`Geri qaytarma (${sortedReturns.length})`} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              {sortedOrders.length === 0 ? (
                <Alert severity="info">
                  Bu müştərinin hələ sifarişi yoxdur.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {sortedOrders.map((order, index) => {
                    const orderNumber = getOrderNumber(order, index);
                    const total = getOrderTotal(order);
                    const paid = getOrderPaidAmount(order);
                    const returned = getOrderReturnedAmount(order);
                    const debt = getOrderRemainingDebt(order);
                    const statusProps = getStatusChipProps(
                      getOrderStatus(order),
                    );

                    return (
                      <Paper
                        key={order.id || `${orderNumber}-${index}`}
                        variant="outlined"
                        onClick={() => setSelectedOrder(order)}
                        sx={{
                          p: 2.25,
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "0.2s ease",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
                            borderColor: "primary.main",
                          },
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          justifyContent="space-between"
                          spacing={2}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              sx={{ mb: 1.2 }}
                            >
                              <Typography variant="h6" fontWeight={800}>
                                {orderNumber}
                              </Typography>

                              <Chip
                                size="small"
                                label={statusProps.label}
                                color={statusProps.color}
                              />

                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Məhsul sayı: ${getItemsCount(
                                  order.items || [],
                                )}`}
                              />
                            </Stack>

                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={2}
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mb: 1.2 }}
                            >
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                              >
                                <CalendarMonthIcon fontSize="small" />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {formatDate(order.createdAt)}
                                </Typography>
                              </Stack>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Ödəniş növü:{" "}
                                <strong>
                                  {getPaymentMethodLabel(order.paymentType)}
                                </strong>
                              </Typography>
                            </Stack>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {(order.items || [])
                                .map(
                                  (item) =>
                                    `${item.product?.name || "Məhsul"} (${
                                      item.quantity || 0
                                    } əd.)`,
                                )
                                .join(", ") || "Məhsul yoxdur"}
                            </Typography>

                            {order.note ? (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Qeyd:</strong> {order.note}
                              </Typography>
                            ) : null}
                          </Box>

                          <Box
                            sx={{
                              minWidth: { xs: "100%", md: 230 },
                              p: 1.5,
                              borderRadius: 3,
                              bgcolor: "#f8fafc",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Toplam
                                </Typography>
                                <Typography fontWeight={800}>
                                  {formatCurrency(total)}
                                </Typography>
                              </Stack>

                              <Stack
                                direction="row"
                                justifyContent="space-between"
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Ödənilən
                                </Typography>
                                <Typography
                                  fontWeight={700}
                                  color="success.main"
                                >
                                  {formatCurrency(paid)}
                                </Typography>
                              </Stack>

                              <Stack
                                direction="row"
                                justifyContent="space-between"
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Qaytarma
                                </Typography>
                                <Typography
                                  fontWeight={700}
                                  color="warning.main"
                                >
                                  {formatCurrency(returned)}
                                </Typography>
                              </Stack>

                              <Stack
                                direction="row"
                                justifyContent="space-between"
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Borc
                                </Typography>
                                <Typography
                                  fontWeight={800}
                                  color={
                                    debt > 0 ? "error.main" : "success.main"
                                  }
                                >
                                  {formatCurrency(debt)}
                                </Typography>
                              </Stack>

                              <Divider sx={{ my: 0.5 }} />

                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ textAlign: "right" }}
                              >
                                Açmaq üçün klik et
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </TabPanel>

            <TabPanel value={tab} index={1}>
              {sortedPayments.length === 0 ? (
                <Alert severity="info">
                  Bu müştəri üçün hələ mədaxil qeydi yoxdur.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {sortedPayments.map((payment, index) => (
                    <Paper
                      key={payment.id || index}
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 4 }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            sx={{ mb: 1 }}
                          >
                            <Typography fontWeight={800}>
                              {payment.referenceNumber ||
                                payment.receiptNumber ||
                                `Mədaxil #${index + 1}`}
                            </Typography>

                            <Chip
                              size="small"
                              color="success"
                              label={getPaymentMethodLabel(
                                payment.paymentType || payment.method,
                              )}
                            />

                            {payment.imageUrl ? (
                              <Chip
                                size="small"
                                icon={<ImageOutlinedIcon />}
                                label="Şəkil var"
                                color="info"
                                variant="outlined"
                              />
                            ) : null}

                            {payment.soldItems?.length > 0 ? (
                              <Chip
                                size="small"
                                icon={<Inventory2OutlinedIcon />}
                                label={`Məhsul: ${payment.soldItems.length}`}
                                color="primary"
                                variant="outlined"
                              />
                            ) : null}
                          </Stack>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            Tarix:{" "}
                            {formatDate(
                              payment.paymentDate ||
                                payment.createdAt ||
                                payment.date,
                            )}
                          </Typography>

                          {payment.note ? (
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              Qeyd: {payment.note}
                            </Typography>
                          ) : null}

                          {payment.createdBy?.fullName ||
                          payment.user?.fullName ? (
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              Əlavə edən:{" "}
                              {payment.createdBy?.fullName ||
                                payment.user?.fullName}
                            </Typography>
                          ) : null}

                          {payment.soldItems?.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 0.5 }}
                              >
                                Satılmış kimi qeyd olunan məhsullar:
                              </Typography>

                              <Stack
                                direction="row"
                                spacing={1}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                {payment.soldItems.map((item) => (
                                  <Chip
                                    key={item.id}
                                    size="small"
                                    variant="outlined"
                                    label={`${
                                      item.product?.name || "Məhsul"
                                    } (${item.quantity || 0} əd.)`}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          ) : null}
                        </Box>

                        <Box
                          sx={{
                            minWidth: { xs: "100%", md: 220 },
                            p: 1.5,
                            borderRadius: 3,
                            bgcolor: "#f8fafc",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Stack spacing={1}>
                            <Typography
                              variant="h6"
                              fontWeight={800}
                              color="success.main"
                              sx={{ textAlign: { xs: "left", md: "right" } }}
                            >
                              {formatCurrency(getPaymentAmount(payment))}
                            </Typography>

                            <Stack
                              direction={{
                                xs: "column",
                                sm: "row",
                                md: "column",
                              }}
                              spacing={1}
                            >
                              {payment.imageUrl ? (
                                <Button
                                  variant="outlined"
                                  startIcon={<ImageOutlinedIcon />}
                                  onClick={() => openPaymentImage(payment)}
                                  sx={{
                                    textTransform: "none",
                                    fontWeight: 700,
                                  }}
                                >
                                  Şəkilə bax
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </TabPanel>

            <TabPanel value={tab} index={2}>
              {sortedReturns.length === 0 ? (
                <Alert severity="info">
                  Bu müştərinin hələ geri qaytarması yoxdur.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {sortedReturns.map((returnDoc, index) => (
                    <Paper
                      key={returnDoc.id || index}
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 4 }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="h6" fontWeight={800}>
                              {returnDoc.returnNumber ||
                                returnDoc.documentNumber ||
                                `RETURN-${index + 1}`}
                            </Typography>

                            <Chip
                              size="small"
                              variant="outlined"
                              color="warning"
                              label={`Məhsul sayı: ${getItemsCount(
                                returnDoc.items || [],
                              )}`}
                            />
                          </Stack>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                          >
                            {formatDate(returnDoc.createdAt)}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            {(returnDoc.items || [])
                              .map(
                                (item) =>
                                  `${item.product?.name || "Məhsul"} (${
                                    item.quantity || 0
                                  } əd.)`,
                              )
                              .join(", ") || "Məhsul yoxdur"}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            minWidth: { xs: "100%", md: 220 },
                            p: 1.5,
                            borderRadius: 3,
                            bgcolor: "#fffaf0",
                            border: "1px solid",
                            borderColor: "warning.light",
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Typography variant="body2" color="text.secondary">
                              Qaytarma məbləği
                            </Typography>
                            <Typography
                              variant="h6"
                              fontWeight={800}
                              color="warning.main"
                            >
                              {formatCurrency(getReturnTotal(returnDoc))}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1}
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Qaimə
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder ? getOrderNumber(selectedOrder, 0) : "-"}
              </Typography>
            </Box>

            {selectedOrder ? (
              <Chip
                {...getStatusChipProps(getOrderStatus(selectedOrder))}
                size="small"
              />
            ) : null}
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {selectedOrder ? (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Müştəri
                    </Typography>
                    <Typography fontWeight={800}>
                      {customer.name || "-"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Telefon
                    </Typography>
                    <Typography fontWeight={600}>
                      {customer.phone || "-"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Salon
                    </Typography>
                    <Typography fontWeight={600}>
                      {customer.salon || "-"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Ünvan
                    </Typography>
                    <Typography fontWeight={600}>
                      {customer.address || "-"}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Tarix
                    </Typography>
                    <Typography fontWeight={700}>
                      {formatDate(selectedOrder.createdAt)}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Ödəniş növü
                    </Typography>
                    <Typography fontWeight={700}>
                      {getPaymentMethodLabel(selectedOrder.paymentType)}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Ödənilən
                    </Typography>
                    <Typography fontWeight={700} color="success.main">
                      {formatCurrency(getOrderPaidAmount(selectedOrder))}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Qaytarma
                    </Typography>
                    <Typography fontWeight={700} color="warning.main">
                      {formatCurrency(getOrderReturnedAmount(selectedOrder))}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.25 }}
                    >
                      Qalıq borc
                    </Typography>
                    <Typography
                      fontWeight={800}
                      color={
                        getOrderRemainingDebt(selectedOrder) > 0
                          ? "error.main"
                          : "success.main"
                      }
                    >
                      {formatCurrency(getOrderRemainingDebt(selectedOrder))}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper
                variant="outlined"
                sx={{ borderRadius: 3, overflow: "hidden" }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.8fr 0.7fr 0.8fr 0.8fr",
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    bgcolor: "#f8fafc",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography fontWeight={800}>Məhsul</Typography>
                  <Typography fontWeight={800}>Miqdar</Typography>
                  <Typography fontWeight={800}>Vahid qiymət</Typography>
                  <Typography fontWeight={800}>Cəmi</Typography>
                </Box>

                {(selectedOrder.items || []).length === 0 ? (
                  <Box sx={{ p: 2 }}>
                    <Alert severity="info">
                      Bu sifarişdə məhsul görünmədi.
                    </Alert>
                  </Box>
                ) : (
                  (selectedOrder.items || []).map((item) => {
                    const quantity = Number(item.quantity || 0);
                    const unitPrice = Number(
                      item.unitPrice ??
                        item.price ??
                        item.salePrice ??
                        item.product?.price ??
                        0,
                    );
                    const rowTotal = item.isGift ? 0 : quantity * unitPrice;

                    return (
                      <Box
                        key={item.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1.8fr 0.7fr 0.8fr 0.8fr",
                          gap: 1,
                          px: 2,
                          py: 1.5,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography>
                          {item.product?.name || "Məhsul"}
                        </Typography>
                        <Typography>{quantity}</Typography>
                        <Typography>{formatCurrency(unitPrice)}</Typography>
                        <Typography fontWeight={700}>
                          {formatCurrency(rowTotal)}
                        </Typography>
                      </Box>
                    );
                  })
                )}
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3, bgcolor: "#f8fafc" }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Toplam məbləğ
                    </Typography>
                    <Typography fontWeight={800}>
                      {formatCurrency(getOrderTotal(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Ödənilən məbləğ
                    </Typography>
                    <Typography fontWeight={800} color="success.main">
                      {formatCurrency(getOrderPaidAmount(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Qaytarma məbləği
                    </Typography>
                    <Typography fontWeight={800} color="warning.main">
                      {formatCurrency(getOrderReturnedAmount(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Qalan borc</Typography>
                    <Typography
                      fontWeight={900}
                      color={
                        getOrderRemainingDebt(selectedOrder) > 0
                          ? "error.main"
                          : "success.main"
                      }
                    >
                      {formatCurrency(getOrderRemainingDebt(selectedOrder))}
                    </Typography>
                  </Stack>

                  {selectedOrder.note ? (
                    <>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2">
                        <strong>Qeyd:</strong> {selectedOrder.note}
                      </Typography>
                    </>
                  ) : null}
                </Stack>
              </Paper>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={imagePreviewOpen}
        onClose={closePaymentImage}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Typography component="span" variant="h6" fontWeight={800}>
            Mədaxil şəkli
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {!selectedPaymentImage ? (
            <Typography>Məlumat tapılmadı</Typography>
          ) : (
            <Stack spacing={2}>
              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3, bgcolor: "#f8fafc" }}
              >
                <Stack spacing={1}>
                  <Typography>
                    <b>Məbləğ:</b>{" "}
                    {formatCurrency(getPaymentAmount(selectedPaymentImage))}
                  </Typography>
                  <Typography>
                    <b>Tarix:</b>{" "}
                    {formatDate(
                      selectedPaymentImage.paymentDate ||
                        selectedPaymentImage.createdAt ||
                        selectedPaymentImage.date,
                    )}
                  </Typography>
                  <Typography>
                    <b>Ödəniş növü:</b>{" "}
                    {getPaymentMethodLabel(
                      selectedPaymentImage.paymentType ||
                        selectedPaymentImage.method,
                    )}
                  </Typography>
                  <Typography>
                    <b>Qeyd:</b> {selectedPaymentImage.note || "-"}
                  </Typography>
                </Stack>
              </Paper>

              {selectedPaymentImage.soldItems?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography fontWeight={800} mb={1.5}>
                    Bu mədaxildə qeyd olunan satılmış məhsullar
                  </Typography>

                  <Stack spacing={1}>
                    {selectedPaymentImage.soldItems.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography>{item.product?.name || "-"}</Typography>
                        <Chip label={`${item.quantity} ədəd`} size="small" />
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              )}

              {selectedPaymentImage.imageUrl ? (
                <Box
                  component="img"
                  src={selectedPaymentImage.imageUrl}
                  alt="payment-proof"
                  sx={{
                    width: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "#fff",
                  }}
                />
              ) : (
                <Alert severity="info">Şəkil tapılmadı</Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closePaymentImage}>Bağla</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={problemModalOpen}
        onClose={() => setProblemModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Problemli müştəri qeydi</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Bu müştəri problemli kimi işarələnəcək. Qeyd yazıldıqdan sonra
              ümumi siyahıda adı qırmızı görünəcək.
            </Typography>

            <TextField
              label="Qeyd"
              value={problemNote}
              onChange={(e) => setProblemNote(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              placeholder="Məsələn: ödəniş problemi var, kobud davranış edib, sifarişlə bağlı risk var və s."
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          {customer?.isProblematic && (
            <Button
              color="warning"
              variant="outlined"
              onClick={handleClearProblemCustomer}
              disabled={problemSaving}
            >
              Problem statusunu sil
            </Button>
          )}

          <Button
            variant="outlined"
            onClick={() => setProblemModalOpen(false)}
            disabled={problemSaving}
          >
            Bağla
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleSaveProblemCustomer}
            disabled={problemSaving}
          >
            {problemSaving ? "Yazılır..." : "Təsdiqlə"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
