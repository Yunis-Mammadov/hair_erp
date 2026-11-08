import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleOutlineRoundedIcon from "@mui/icons-material/PeopleOutlineRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import { useAuth } from "../features/auth/useAuth";
import { canUseFeature } from "../features/plans/access";
import { api } from "../lib/api";

const moneyFormatter = new Intl.NumberFormat("az-AZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("az-AZ");
const paymentLabels = {
  REALİZASİYA: "Realizasiya",
  NAĞD: "Nağd",
  HİSSƏLİ: "Hissəli",
  DİGƏR: "Digər",
};

function money(value) {
  return moneyFormatter.format(Number(value) || 0) + " ₼";
}
function count(value) {
  return numberFormatter.format(Number(value) || 0);
}
function orderTotal(order) {
  // A zero price is valid, including gifts. Do not replace it with the catalogue price.
  return (order.items || []).reduce(
    (sum, item) =>
      sum +
      (item.isGift
        ? 0
        : Number(item.quantity || 0) * Number(item.unitPrice ?? 0)),
    0,
  );
}
function dateParts(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString("az-AZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("az-AZ", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const companyId = user?.company?.id;
  const currentSnapshot = snapshot?.companyId === companyId ? snapshot : null;
  const data = currentSnapshot?.data || null;
  const updatedAt = currentSnapshot?.updatedAt || null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/dashboard/stats", {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSnapshot({
            companyId,
            data: response.data,
            updatedAt: new Date(),
          });
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Məlumatlar yüklənmədi. Bağlantını yoxlayıb yenidən cəhd et.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [reloadKey, companyId]);

  const now = updatedAt || new Date();
  const month = now.toLocaleDateString("az-AZ", {
    month: "long",
    year: "numeric",
  });
  const orders = data?.recentOrders || [];
  const unavailable = !data;
  const metrics = [
    {
      title: "Bu ayın satış məbləği",
      value: unavailable ? "—" : money(data.revenue?.value),
      description: month,
      icon: AccountBalanceWalletOutlinedIcon,
      accent: true,
    },
    {
      title: "Bu ayın sifarişləri",
      value: unavailable ? "—" : count(data.orders?.value),
      description: "Cari təqvim ayı",
      icon: ReceiptLongOutlinedIcon,
    },
    {
      title: "Müştərilər",
      value: unavailable ? "—" : count(data.customers?.value),
      description: "Ümumi müştəri sayı",
      icon: PeopleOutlineRoundedIcon,
    },
    {
      title: "Məhsullar",
      value: unavailable ? "—" : count(data.products?.value),
      description: "Kataloqdakı məhsullar",
      icon: Inventory2OutlinedIcon,
    },
  ];

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, lg: 3.5 },
        py: { xs: 3, md: 3.5 },
        maxWidth: 1600,
        mx: "auto",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            component="h1"
            variant="h2"
            sx={{ fontSize: { xs: 24, md: 28 } }}
          >
            Biznesə ümumi baxış
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 13 }}>
            {user?.company?.name || "z-Index"} · Satışlar və gündəlik
            əməliyyatlar
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Məlumatları yenilə">
            <span>
              <IconButton
                onClick={() => setReloadKey((key) => key + 1)}
                disabled={loading}
                aria-label="Məlumatları yenilə"
                sx={{
                  width: 38,
                  height: 38,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "#fff",
                }}
              >
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            component={RouterLink}
            to="/exp/sales"
            startIcon={<AddRoundedIcon />}
          >
            Yeni satış
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              disabled={loading}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Yenidən yoxla
            </Button>
          }
        >
          {error}
          {data && " Son yüklənmiş məlumatlar göstərilir."}
        </Alert>
      )}

      <Box
        aria-busy={loading}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
          mb: 3,
        }}
      >
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} loading={loading} />
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(0, 1fr) 288px",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Card
          component="section"
          aria-labelledby="recent-orders-title"
          sx={{ minWidth: 0 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ px: 2.5, py: 2.25 }}
          >
            <Box>
              <Typography id="recent-orders-title" component="h2" variant="h6">
                Son satışlar
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 12, mt: 0.35 }}
              >
                Ən son 8 sifariş
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/exp/sales-history"
              size="small"
              endIcon={
                <ArrowForwardRoundedIcon sx={{ fontSize: "16px !important" }} />
              }
              sx={{ whiteSpace: "nowrap", fontSize: 12 }}
            >
              Hamısı
            </Button>
          </Stack>
          <Divider />
          {loading ? (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={40} />
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} height={58} />
              ))}
            </Box>
          ) : unavailable ? (
            <EmptyState
              title="Satışlar yüklənmədi"
              description="Bağlantı bərpa olunandan sonra məlumatları yenilə."
            />
          ) : orders.length === 0 ? (
            <EmptyState
              title="İlk satışını yarat"
              description="Əlavə etdiyin sifarişlər burada görünəcək."
              action
            />
          ) : (
            <TableContainer
              tabIndex={0}
              aria-label="Son satışlar cədvəli"
              sx={{ overflowX: "auto" }}
            >
              <Table size="small" sx={{ minWidth: 580 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Qaimə / tarix</TableCell>
                    <TableCell>Müştəri</TableCell>
                    <TableCell align="right">Say</TableCell>
                    <TableCell>Ödəniş növü</TableCell>
                    <TableCell align="right">Məbləğ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.slice(0, 8).map((order) => {
                    const timestamp = dateParts(order.createdAt);
                    const quantity = (order.items || []).reduce(
                      (sum, item) => sum + Number(item.quantity || 0),
                      0,
                    );
                    const invoiceNumber =
                      order.orderNumber == null
                        ? "—"
                        : "#" + String(order.orderNumber).padStart(5, "0");
                    return (
                      <TableRow
                        key={order.id}
                        hover
                        sx={{ "&:last-child td": { borderBottom: 0 } }}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
                            {invoiceNumber}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              color: "text.secondary",
                              mt: 0.35,
                            }}
                          >
                            {timestamp.date} · {timestamp.time}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          {order.customer?.id ? (
                            <Link
                              component={RouterLink}
                              to={"/exp/customers/" + order.customer.id}
                              underline="hover"
                              color="text.primary"
                              sx={{
                                fontSize: 12.5,
                                fontWeight: 500,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {order.customer.name || "Müştəri"}
                            </Link>
                          ) : (
                            <Typography sx={{ fontSize: 12.5 }}>
                              {order.customer?.name || "—"}
                            </Typography>
                          )}
                          {order.customer?.salon && (
                            <Typography
                              sx={{
                                fontSize: 11,
                                color: "text.secondary",
                                mt: 0.3,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {order.customer.salon}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {count(quantity)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={paymentLabels[order.paymentType] || "—"}
                            sx={{
                              bgcolor: "#f0f3f8",
                              color: "#536079",
                              borderRadius: "5px",
                              fontSize: 10.5,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {money(orderTotal(order))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Divider />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            sx={{ px: 2.5, py: 1.6 }}
          >
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
              Bütün dövrlər üzrə son sifarişlər
            </Typography>
            <Link
              component={RouterLink}
              to="/exp/sales-history"
              underline="hover"
              sx={{ fontSize: 11.5, whiteSpace: "nowrap" }}
            >
              Tarixçəyə keç
            </Link>
          </Stack>
        </Card>

        <Stack spacing={2.5}>
          <Card component="section" aria-labelledby="quick-actions-title">
            <Box sx={{ px: 2.25, pt: 2.25, pb: 1.5 }}>
              <Typography id="quick-actions-title" component="h2" variant="h6">
                Əməliyyatlar
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 12, mt: 0.35 }}
              >
                Lazım olan bölməyə keç
              </Typography>
            </Box>
            <Box sx={{ px: 1, pb: 1 }}>
              <QuickLink
                to="/exp/receipts"
                icon={AccountBalanceWalletOutlinedIcon}
                title="Mədaxil et"
                description="Müştəri ödənişini qeyd et"
              />
              <QuickLink
                to="/exp/customers"
                icon={PeopleOutlineRoundedIcon}
                title="Müştərilər"
                description="Məlumatlar və borclar"
              />
              <QuickLink
                to="/warehouse/stock"
                icon={WarehouseOutlinedIcon}
                title="Anbar qalığı"
                description="Mövcud stoklara bax"
              />
              <QuickLink
                to="/warehouse/purchases"
                icon={ShoppingBagOutlinedIcon}
                title="Yeni alış"
                description="Anbara məhsul əlavə et"
              />
              {canUseFeature(user, "delivery") && (
                <QuickLink
                  to="/driver/deliveries"
                  icon={LocalShippingOutlinedIcon}
                  title="Çatdırılma"
                  description="Sifarişlərin çatdırılması"
                />
              )}
            </Box>
          </Card>

          <Card component="section" aria-labelledby="month-summary-title">
            <Box sx={{ p: 2.25 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 0.5 }}
              >
                <CalendarTodayOutlinedIcon
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
                <Typography
                  id="month-summary-title"
                  component="h2"
                  variant="h6"
                >
                  Aylıq xülasə
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontSize: 12,
                  color: "text.secondary",
                  mb: 2.25,
                  textTransform: "capitalize",
                }}
              >
                {month}
              </Typography>
              <SummaryRow
                title="Məhsul sayı"
                value={unavailable ? "—" : count(data.itemsSold?.value)}
                loading={loading}
              />
              <Divider sx={{ my: 1.5 }} />
              <SummaryRow
                title="Orta sifariş məbləği"
                value={unavailable ? "—" : money(data.averageOrderValue?.value)}
                loading={loading}
              />
              <Typography
                sx={{
                  fontSize: 10.5,
                  lineHeight: 1.7,
                  color: "text.secondary",
                  mt: 2.25,
                }}
              >
                Satış məbləği sifarişlərin ilkin cəmidir. Ödənişlər və geri
                qaytarmalar bu göstəricidən çıxılmır.
              </Typography>
            </Box>
          </Card>
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={0.5}
        sx={{ mt: 2.75 }}
      >
        <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
          z-Index · Biznes idarəetməsi
        </Typography>
        <Typography
          role="status"
          sx={{ fontSize: 10.5, color: "text.secondary" }}
        >
          {loading
            ? "Məlumatlar yenilənir…"
            : updatedAt
              ? "Son yenilənmə: " +
                updatedAt.toLocaleTimeString("az-AZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Məlumatlar yüklənməyib"}
        </Typography>
      </Stack>
    </Box>
  );
}

function MetricCard({ title, value, description, icon, accent, loading }) {
  const Icon = icon;
  return (
    <Card sx={{ p: 2.25, minWidth: 0 }}>
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
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            borderRadius: "8px",
            bgcolor: accent ? "#edf2ff" : "#f5f6fa",
            color: accent ? "primary.main" : "#8993a6",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 17 }} />
        </Box>
      </Stack>
      {loading ? (
        <Skeleton width="75%" height={42} sx={{ mt: 1 }} />
      ) : (
        <Typography
          sx={{
            mt: 1.5,
            fontSize: { xs: 25, md: 28 },
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1.25,
            fontVariantNumeric: "tabular-nums",
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </Typography>
      )}
      <Typography
        sx={{
          fontSize: 10.5,
          color: "text.secondary",
          mt: 1,
          textTransform: "capitalize",
        }}
      >
        {description}
      </Typography>
    </Card>
  );
}

function QuickLink({ to, icon, title, description }) {
  const Icon = icon;
  return (
    <Button
      component={RouterLink}
      to={to}
      fullWidth
      color="inherit"
      sx={{
        px: 1.25,
        py: 1.25,
        justifyContent: "flex-start",
        textAlign: "left",
        "&:hover": { bgcolor: "#f6f8fc" },
      }}
    >
      <Box
        sx={{
          width: 33,
          height: 33,
          mr: 1.2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          color: "#6f7b91",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{title}</Typography>
        <Typography sx={{ fontSize: 10.5, color: "text.secondary", mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
      <ArrowForwardRoundedIcon
        sx={{ ml: 0.5, fontSize: 16, color: "#9aa4b5" }}
      />
    </Button>
  );
}

function SummaryRow({ title, value, loading }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
    >
      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
        {title}
      </Typography>
      {loading ? (
        <Skeleton width={60} />
      ) : (
        <Typography
          sx={{
            fontSize: 12.5,
            fontWeight: 500,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </Typography>
      )}
    </Stack>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <Box sx={{ px: 3, py: 7, textAlign: "center" }}>
      <ReceiptLongOutlinedIcon sx={{ fontSize: 32, color: "#a1abc0", mb: 1 }} />
      <Typography sx={{ fontWeight: 500, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {action && (
        <Button
          component={RouterLink}
          to="/exp/sales"
          variant="outlined"
          size="small"
          sx={{ mt: 2 }}
        >
          Yeni satış
        </Button>
      )}
    </Box>
  );
}