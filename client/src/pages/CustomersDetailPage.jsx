import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/useAuth";
import { canUseFeature } from "../features/plans/access";
import {
  PageLayout,
  PageHeader,
  PageCard,
  DataTable,
  EmptyState,
  StatusBadge,
  RecordDate,
} from "../components/WorkspaceUI";
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
  Link,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
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

const EMPTY_LIST = [];
const EMPTY_SUMMARY = {};
const amountCellSx = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return (
    <Box
      role="tabpanel"
      id={"customer-panel-" + index}
      aria-labelledby={"customer-tab-" + index}
    >
      {children}
    </Box>
  );
}

function SummaryCard({ title, value, icon, color = "#1c2536", subtitle }) {
  return (
    <PageCard sx={{ p: 2.25 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {title}
        </Typography>
        <Box
          sx={{
            width: 29,
            height: 29,
            bgcolor: "#f5f6fa",
            borderRadius: "7px",
            display: "grid",
            placeItems: "center",
            color: "#8993a6",
            flexShrink: 0,
            "& svg": { fontSize: 17 },
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography
        sx={{
          mt: 1.5,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.6px",
          color,
          overflowWrap: "anywhere",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>
      {subtitle && (
        <Typography sx={{ mt: 0.6, fontSize: 11, color: "text.secondary" }}>
          {subtitle}
        </Typography>
      )}
    </PageCard>
  );
}

function InfoField({ label, children }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.4 }}>
        {label}
      </Typography>
      <Box sx={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{children}</Box>
    </Box>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemSaving, setProblemSaving] = useState(false);
  const [problemError, setProblemError] = useState("");
  const [problemNote, setProblemNote] = useState("");

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedPaymentImage, setSelectedPaymentImage] = useState(null);

  const fetchCustomerDetail = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    fetchCustomerDetail();
  }, [fetchCustomerDetail]);

  const customer = data?.customer || null;
  const summary = data?.summary || customer?.summary || EMPTY_SUMMARY;

  function openProblemEditor() {
    setProblemNote(customer?.problemNote || "");
    setProblemError("");
    setProblemModalOpen(true);
  }

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
      setProblemError("");

      await api.put(`/customers/${id}`, {
        isProblematic: true,
        problemNote: problemNote.trim(),
      });

      setProblemModalOpen(false);
      await fetchCustomerDetail();
    } catch (err) {
      console.error("PROBLEM_CUSTOMER_SAVE_ERROR:", err);
      setProblemError(
        err?.response?.data?.message || "Status saxlanılmadı. Yenidən cəhd et.",
      );
    } finally {
      setProblemSaving(false);
    }
  }

  async function handleClearProblemCustomer() {
    try {
      setProblemSaving(true);
      setProblemError("");

      await api.put(`/customers/${id}`, {
        isProblematic: false,
        problemNote: "",
      });

      setProblemModalOpen(false);
      await fetchCustomerDetail();
    } catch (err) {
      console.error("PROBLEM_CUSTOMER_CLEAR_ERROR:", err);
      setProblemError(
        err?.response?.data?.message || "Status silinmədi. Yenidən cəhd et.",
      );
    } finally {
      setProblemSaving(false);
    }
  }

  const orders = customer?.orders || EMPTY_LIST;
  const returns = customer?.returns || EMPTY_LIST;
  const payments =
    customer?.payments ||
    customer?.cashEntries ||
    customer?.receipts ||
    customer?.transactions ||
    EMPTY_LIST;

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
    <PageLayout>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ mb: 1.5 }}
        useFlexGap
        flexWrap="wrap"
      >
        <Button
          size="small"
          color="inherit"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate("/exp/customers")}
          sx={{ px: 0, color: "text.secondary", fontSize: 12 }}
        >
          Müştərilər
        </Button>
        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
          Müştəri #{String(customer.id || "").slice(-6)}
        </Typography>
        {customer.isProblematic && (
          <StatusBadge label="Problemli müştəri" tone="error" />
        )}
      </Stack>
      <PageHeader
        title={customer.name || "Adsız müştəri"}
        description={[customer.salon, customer.phone]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button
              variant="outlined"
              color="inherit"
              onClick={openProblemEditor}
              sx={{ fontSize: 12 }}
            >
              Statusu dəyiş
            </Button>
            <Button
              variant="outlined"
              href={mapsUrl || undefined}
              target="_blank"
              rel="noreferrer"
              disabled={!mapsUrl}
              endIcon={<LaunchIcon sx={{ fontSize: "15px !important" }} />}
              sx={{ fontSize: 12 }}
            >
              Google Maps
            </Button>
            <Button
              variant="outlined"
              href={wazeUrl || undefined}
              target="_blank"
              rel="noreferrer"
              disabled={!wazeUrl}
              endIcon={<LaunchIcon sx={{ fontSize: "15px !important" }} />}
              sx={{ fontSize: 12 }}
            >
              Waze
            </Button>
          </>
        }
      />
      {customer.isProblematic && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5, fontSize: 12.5, borderRadius: "8px" }}
        >
          {customer.problemNote || "Bu müştəri problemli kimi işarələnib."}
          {customer.problemMarkedAt && (
            <Typography
              sx={{ fontSize: 10.5, mt: 0.5, color: "text.secondary" }}
            >
              Qeyd tarixi: {formatDate(customer.problemMarkedAt)}
            </Typography>
          )}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
          mb: 2.5,
        }}
      >
        <SummaryCard
          title="Ümumi sifariş"
          value={ordersCount}
          icon={<ShoppingCartIcon />}
          subtitle={totalOrderedItems + " məhsul"}
        />
        <SummaryCard
          title="Satış məbləği"
          value={formatCurrency(totalSalesAmount)}
          icon={<TrendingUpIcon />}
          subtitle="Qaytarmadan əvvəlki məbləğ"
        />
        <SummaryCard
          title="Ümumi mədaxil"
          value={formatCurrency(totalPaidAmount)}
          icon={<PaidIcon />}
          color="#20704f"
          subtitle={paymentsCount + " ödəniş"}
        />
        <SummaryCard
          title="Cari borc"
          value={formatCurrency(totalDebt)}
          icon={<AccountBalanceWalletIcon />}
          color={totalDebt > 0 ? "#b53b35" : "#20704f"}
          subtitle={"Qaytarma: " + formatCurrency(totalReturnsAmount)}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(0, 1fr) 270px",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <PageCard component="section" aria-label="Müştəri əməliyyatları">
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Müştəri tarixçəsi"
            sx={{
              px: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              minHeight: 50,
              "& .MuiTab-root": {
                fontSize: 12,
                fontWeight: 500,
                minHeight: 50,
                px: 1.5,
                textTransform: "none",
              },
            }}
          >
            <Tab
              id="customer-tab-0"
              aria-controls="customer-panel-0"
              label={"Satışlar (" + sortedOrders.length + ")"}
            />
            <Tab
              id="customer-tab-1"
              aria-controls="customer-panel-1"
              label={"Mədaxillər (" + sortedPayments.length + ")"}
            />
            <Tab
              id="customer-tab-2"
              aria-controls="customer-panel-2"
              label={"Qaytarmalar (" + sortedReturns.length + ")"}
            />
          </Tabs>

          <TabPanel value={tab} index={0}>
            {sortedOrders.length === 0 ? (
              <EmptyState
                title="Hələ satış yoxdur"
                description="Bu müştərinin sifarişləri burada görünəcək."
              />
            ) : (
              <DataTable minWidth={760} label="Müştərinin satışları">
                <TableHead>
                  <TableRow>
                    <TableCell>Qaimə / tarix</TableCell>
                    <TableCell align="right">Say</TableCell>
                    <TableCell align="right">Məbləğ</TableCell>
                    <TableCell align="right">Ödənən</TableCell>
                    <TableCell align="right">Qaytarma</TableCell>
                    <TableCell align="right">Borc</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ətraflı</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedOrders.map((order, index) => {
                    const status = getStatusChipProps(getOrderStatus(order));
                    const number = getOrderNumber(order, index);
                    return (
                      <TableRow key={order.id || index} hover>
                        <TableCell>
                          <Typography
                            sx={{ fontSize: 12.5, fontWeight: 500, mb: 0.4 }}
                          >
                            {number}
                          </Typography>
                          <RecordDate value={order.createdAt} />
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              color: "text.secondary",
                              mt: 0.4,
                            }}
                          >
                            {getPaymentMethodLabel(order.paymentType)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {getItemsCount(order.items || [])}
                        </TableCell>
                        <TableCell align="right" sx={amountCellSx}>
                          {formatCurrency(getOrderTotal(order))}
                        </TableCell>
                        <TableCell align="right" sx={amountCellSx}>
                          {formatCurrency(getOrderPaidAmount(order))}
                        </TableCell>
                        <TableCell align="right" sx={amountCellSx}>
                          {formatCurrency(getOrderReturnedAmount(order))}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            ...amountCellSx,
                            fontWeight: 500,
                            color:
                              getOrderRemainingDebt(order) > 0
                                ? "error.main"
                                : "text.secondary",
                          }}
                        >
                          {formatCurrency(getOrderRemainingDebt(order))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={status.label}
                            tone={
                              status.color === "default"
                                ? "neutral"
                                : status.color
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => setSelectedOrder(order)}
                            aria-label={"Qaiməyə bax: " + number}
                            sx={{ fontSize: 12, minWidth: 0 }}
                          >
                            Bax
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            )}
          </TabPanel>

          <TabPanel value={tab} index={1}>
            {sortedPayments.length === 0 ? (
              <EmptyState
                title="Hələ mədaxil yoxdur"
                description="Bu müştərinin ödəniş qeydləri burada görünəcək."
              />
            ) : (
              <DataTable minWidth={670} label="Müştərinin mədaxilləri">
                <TableHead>
                  <TableRow>
                    <TableCell>Mədaxil / tarix</TableCell>
                    <TableCell>Ödəniş növü</TableCell>
                    <TableCell>Qeyd / əməkdaş</TableCell>
                    <TableCell align="right">Məbləğ</TableCell>
                    <TableCell align="right">Qəbz</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedPayments.map((payment, index) => (
                    <TableRow key={payment.id || index} hover>
                      <TableCell>
                        <Typography
                          sx={{ fontSize: 12, fontWeight: 500, mb: 0.4 }}
                        >
                          {payment.referenceNumber ||
                            payment.receiptNumber ||
                            "Mədaxil #" + (index + 1)}
                        </Typography>
                        <RecordDate
                          value={
                            payment.paymentDate ||
                            payment.createdAt ||
                            payment.date
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={getPaymentMethodLabel(
                            payment.paymentType || payment.method,
                          )}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ maxWidth: 280, overflowWrap: "anywhere" }}
                      >
                        <Typography sx={{ fontSize: 12 }}>
                          {payment.note || "—"}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            color: "text.secondary",
                            mt: 0.4,
                          }}
                        >
                          {payment.createdBy?.fullName ||
                            payment.user?.fullName ||
                            "—"}
                        </Typography>
                        {payment.soldItems?.length > 0 && (
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              color: "text.secondary",
                              mt: 0.4,
                            }}
                          >
                            Məhsullar:{" "}
                            {payment.soldItems
                              .map(
                                (item) =>
                                  (item.product?.name || "Məhsul") +
                                  " (" +
                                  (item.quantity || 0) +
                                  " əd.)",
                              )
                              .join(", ")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...amountCellSx,
                          color: "success.main",
                          fontWeight: 500,
                        }}
                      >
                        {formatCurrency(getPaymentAmount(payment))}
                      </TableCell>
                      <TableCell align="right">
                        {payment.imageUrl ? (
                          <Button
                            size="small"
                            startIcon={
                              <ImageOutlinedIcon
                                sx={{ fontSize: "16px !important" }}
                              />
                            }
                            onClick={() => openPaymentImage(payment)}
                            sx={{ fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            Şəkilə bax
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            {sortedReturns.length === 0 ? (
              <EmptyState
                title="Hələ qaytarma yoxdur"
                description="Qaytarılan məhsullar burada görünəcək."
              />
            ) : (
              <DataTable minWidth={540} label="Müştərinin qaytarmaları">
                <TableHead>
                  <TableRow>
                    <TableCell>Qaytarma / tarix</TableCell>
                    <TableCell>Məhsullar</TableCell>
                    <TableCell align="right">Say</TableCell>
                    <TableCell align="right">Məbləğ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedReturns.map((returnDoc, index) => (
                    <TableRow key={returnDoc.id || index} hover>
                      <TableCell>
                        <Typography
                          sx={{ fontSize: 12, fontWeight: 500, mb: 0.4 }}
                        >
                          {returnDoc.returnNumber ||
                            returnDoc.documentNumber ||
                            "Qaytarma #" + (index + 1)}
                        </Typography>
                        <RecordDate value={returnDoc.createdAt} />
                      </TableCell>
                      <TableCell
                        sx={{ maxWidth: 300, overflowWrap: "anywhere" }}
                      >
                        <Typography sx={{ fontSize: 12 }}>
                          {(returnDoc.items || [])
                            .map(
                              (item) =>
                                (item.product?.name || "Məhsul") +
                                " (" +
                                (item.quantity || 0) +
                                " əd.)",
                            )
                            .join(", ") || "—"}
                        </Typography>
                        {returnDoc.note && (
                          <Typography
                            sx={{
                              fontSize: 11,
                              color: "text.secondary",
                              mt: 0.4,
                            }}
                          >
                            {returnDoc.note}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {getItemsCount(returnDoc.items || [])}
                      </TableCell>
                      <TableCell align="right" sx={amountCellSx}>
                        {formatCurrency(getReturnTotal(returnDoc))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
          </TabPanel>
        </PageCard>

        <PageCard component="aside" sx={{ p: 2.25 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 14, fontWeight: 500, mb: 2 }}
          >
            Müştəri məlumatları
          </Typography>
          <Stack spacing={1.75} divider={<Divider />}>
            <InfoField label="Telefon">
              {customer.phone ? (
                <Link
                  href={"tel:" + customer.phone}
                  color="inherit"
                  underline="hover"
                >
                  {customer.phone}
                </Link>
              ) : (
                "—"
              )}
            </InfoField>
            <InfoField label="Salon / mağaza">
              {customer.salon || "—"}
            </InfoField>
            <InfoField label="Ünvan">{customer.address || "—"}</InfoField>
            {canUseFeature(user, "customerAssignments") && (
              <InfoField label="Ekspeditor">
                {customer.assignedExpeditor?.fullName ||
                  customer.assignedExpeditor?.email ||
                  "—"}
              </InfoField>
            )}
            <InfoField label="Yaradılıb">
              {formatDate(customer.createdAt)}
            </InfoField>
            <InfoField label="Son yenilənmə">
              {formatDate(customer.updatedAt)}
            </InfoField>
            <InfoField label="Geri qaytarmalar">
              {returnsCount} qeyd · {totalReturnedItems} məhsul
              <br />
              {formatCurrency(totalReturnsAmount)}
            </InfoField>
          </Stack>
        </PageCard>
      </Box>

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
              <Typography variant="h6" fontWeight={600}>
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
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: "8px" }}>
                    <Typography variant="body2" color="text.secondary">
                      Müştəri
                    </Typography>
                    <Typography fontWeight={600}>
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

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: "8px" }}>
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
                      fontWeight={600}
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
                sx={{ borderRadius: "8px", overflow: "hidden" }}
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
                  <Typography fontWeight={600}>Məhsul</Typography>
                  <Typography fontWeight={600}>Miqdar</Typography>
                  <Typography fontWeight={600}>Vahid qiymət</Typography>
                  <Typography fontWeight={600}>Cəmi</Typography>
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
                sx={{ p: 2, borderRadius: "8px", bgcolor: "#f8fafc" }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Toplam məbləğ
                    </Typography>
                    <Typography fontWeight={600}>
                      {formatCurrency(getOrderTotal(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Ödənilən məbləğ
                    </Typography>
                    <Typography fontWeight={600} color="success.main">
                      {formatCurrency(getOrderPaidAmount(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">
                      Qaytarma məbləği
                    </Typography>
                    <Typography fontWeight={600} color="warning.main">
                      {formatCurrency(getOrderReturnedAmount(selectedOrder))}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Qalan borc</Typography>
                    <Typography
                      fontWeight={600}
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
        <DialogActions>
          <Button onClick={() => setSelectedOrder(null)}>Bağla</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={imagePreviewOpen}
        onClose={closePaymentImage}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Typography component="span" variant="h6" fontWeight={600}>
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
                sx={{ p: 2, borderRadius: "8px", bgcolor: "#f8fafc" }}
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
                <Paper variant="outlined" sx={{ p: 2, borderRadius: "8px" }}>
                  <Typography fontWeight={600} mb={1.5}>
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
                  alt="Müştəri ödənişinin qəbzi"
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
          {problemError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {problemError}
            </Alert>
          )}
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Bu müştəri problemli kimi işarələnəcək. Qeyd yazıldıqdan sonra
              ümumi siyahıda adının yanında status nişanı görünəcək.
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
    </PageLayout>
  );
}