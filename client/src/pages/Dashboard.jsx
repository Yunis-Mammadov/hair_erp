import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

import { api } from "../lib/api";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    products: 0,
    customers: 0,
    recentOrders: [],
  });

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const res = await api.get("/dashboard/stats");

        setData({
          products: res.data.products.value,
          customers: res.data.customers.value,
          recentOrders: res.data.recentOrders,
          ordersChange: res.data.orders.change,
          itemsSold: res.data.itemsSold.value,
          itemsSoldChange: res.data.itemsSold.change,
          revenue: res.data.revenue.value,
          revenueChange: res.data.revenue.change,
          averageOrderValue: res.data.averageOrderValue.value,
        });

        if (!alive) return;

        setData({
          products:
            prodRes.status === "fulfilled"
              ? (prodRes.value.data?.products?.length ?? 0)
              : 0,
          customers:
            custRes.status === "fulfilled"
              ? (custRes.value.data?.customers?.length ?? 0)
              : 0,
          recentOrders:
            ordRes.status === "fulfilled"
              ? (ordRes.value.data?.orders ?? [])
              : [],
        });
      } catch (error) {
        console.error("DASHBOARD_LOAD_ERROR:", error);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const orders = data.recentOrders || [];

    const totalItems = orders.reduce((sum, order) => {
      return (
        sum +
        (order.items || []).reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        )
      );
    }, 0);

    const estimatedRevenue = orders.reduce((sum, order) => {
      const orderTotal = (order.items || []).reduce((itemSum, item) => {
        return (
          itemSum +
          Number(item.quantity || 0) *
            Number(item.unitPrice || item.product?.salePrice || 0)
        );
      }, 0);

      return sum + orderTotal;
    }, 0);

    return {
      orderCount: orders.length,
      totalItems,
      estimatedRevenue,
      lastCustomer: orders[0]?.customer?.name || "—",
    };
  }, [data.recentOrders]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5f7fb",
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1480, mx: "auto" }}>
        <HeroCard />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              xl: "repeat(4, 1fr)",
            },
            gap: 2,
            mb: 2.5,
          }}
        >
          <MetricCard
            loading={loading}
            title="Aktiv Məhsullar"
            value={data.products}
            change="+12% bu ay"
            icon={<Inventory2RoundedIcon />}
            tone="red"
          />

          <MetricCard
            loading={loading}
            title="Müştərilər"
            value={data.customers}
            change="+18% bu ay"
            icon={<PeopleAltRoundedIcon />}
            tone="blue"
          />

          <MetricCard
            loading={loading}
            title="Son Sifarişlər"
            value={data.recentOrders.length}
            change={`${data.ordersChange >= 0 ? "+" : ""}${data.ordersChange}% bu ay`}
            icon={<ShoppingCartRoundedIcon />}
            tone="green"
          />

          <MetricCard
            loading={loading}
            title="Gündəlik Satış"
            value={summary.totalItems}
            change="+22% bu ay"
            icon={<TrendingUpRoundedIcon />}
            tone="orange"
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "1.35fr 0.85fr" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <OrdersCard loading={loading} orders={data.recentOrders} />

          <Stack spacing={2}>
            <QuickLinksCard />
            <MiniStatsCard revenue={summary.estimatedRevenue} />
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
            mt: 2,
          }}
        >
          <BottomStatCard
            title="Toplam Dövriyyə"
            value={`${summary.estimatedRevenue.toFixed(0)} ₼`}
            change="+16% bu ay"
            icon={<TrendingUpRoundedIcon />}
            tone="purple"
          />
          <BottomStatCard
            title="Orta Sifariş Dəyəri"
            value={
              summary.orderCount
                ? `${(summary.estimatedRevenue / summary.orderCount).toFixed(0)} ₼`
                : "0 ₼"
            }
            change="+9% bu ay"
            icon={<ReceiptLongRoundedIcon />}
            tone="orange"
          />
          <BottomStatCard
            title="Tamamlanan Çatdırılma"
            value="96%"
            change="+4% bu ay"
            icon={<CheckCircleRoundedIcon />}
            tone="green"
          />
        </Box>

        <Typography
          sx={{
            mt: 3,
            color: "#94a3b8",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          © 2026 Nanoplastica.az ERP Sistemi. Bütün hüquqlar qorunur.
        </Typography>
      </Box>
    </Box>
  );
}

function HeroCard() {
  return (
    <Card
      elevation={0}
      sx={{
        mb: 2.5,
        borderRadius: 5,
        overflow: "hidden",
        position: "relative",
        color: "white",
        minHeight: { xs: 230, md: 260 },
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "radial-gradient(circle at 78% 38%, rgba(185,28,28,0.42), transparent 28%), radial-gradient(circle at 92% 18%, rgba(255,255,255,0.12), transparent 18%), linear-gradient(135deg, #080b12 0%, #0f172a 58%, #111827 100%)",
        boxShadow: "0 24px 70px rgba(15,23,42,0.28)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          opacity: 0.55,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          right: { xs: -70, md: 70 },
          top: { xs: 20, md: 28 },
          width: { xs: 220, md: 390 },
          height: { xs: 160, md: 210 },
          borderRadius: 6,
          transform: "rotate(8deg)",
          border: "1px solid rgba(255,255,255,0.14)",
          bgcolor: "rgba(255,255,255,0.045)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
          display: { xs: "none", md: "block" },
        }}
      />

      <Box
        sx={{
          position: "absolute",
          right: { md: 130 },
          top: { md: 64 },
          width: 205,
          height: 120,
          borderRadius: 5,
          bgcolor: "rgba(255,255,255,0.075)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          display: { xs: "none", md: "flex" },
          alignItems: "end",
          gap: 1,
          p: 2,
        }}
      >
        {[42, 74, 98, 62, 86, 52].map((h, i) => (
          <Box
            key={i}
            sx={{
              width: 18,
              height: h,
              borderRadius: 2,
              background:
                i % 2 === 0
                  ? "linear-gradient(180deg, #ef4444, #7f1d1d)"
                  : "linear-gradient(180deg, #ffffff, #64748b)",
              opacity: i % 2 === 0 ? 0.95 : 0.65,
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          position: "absolute",
          right: { md: 82 },
          top: { md: 38 },
          width: 78,
          height: 78,
          borderRadius: "50%",
          display: { xs: "none", md: "grid" },
          placeItems: "center",
          bgcolor: "#7f1d1d",
          boxShadow: "0 18px 40px rgba(185,28,28,0.45)",
          fontWeight: 950,
          fontSize: 24,
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      >
        NP
      </Box>

      <CardContent
        sx={{
          position: "relative",
          zIndex: 2,
          p: { xs: 3, md: 4 },
          height: "100%",
        }}
      >
        <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.82)" }}>
          Xoş gəldiniz, Admin! 👋
        </Typography>

        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: 38, md: 52 },
            lineHeight: 0.95,
            letterSpacing: -2,
            fontWeight: 950,
            maxWidth: 650,
          }}
        >
          İdarəetmə Paneli
        </Typography>

        <Typography
          sx={{
            mt: 2,
            maxWidth: 620,
            color: "rgba(255,255,255,0.72)",
            fontSize: 15.5,
            lineHeight: 1.7,
          }}
        >
          Satışları, müştəriləri, anbarı və çatdırılmanı bir ekrandan izləyin və
          biznesinizə nəzarəti asanlaşdırın.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: "wrap" }}>
          <HeroChip icon={<SpeedRoundedIcon />} label="Sürətli" />
          <HeroChip icon={<ShieldRoundedIcon />} label="Təhlükəsiz" />
          <HeroChip icon={<CheckCircleRoundedIcon />} label="Effektiv" />
        </Stack>
      </CardContent>
    </Card>
  );
}

function HeroChip({ icon, label }) {
  return (
    <Chip
      icon={icon}
      label={label}
      sx={{
        color: "white",
        fontWeight: 850,
        borderRadius: 999,
        bgcolor: "rgba(255,255,255,0.09)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        "& .MuiChip-icon": { color: "white" },
      }}
    />
  );
}

function MetricCard({ loading, title, value, change, icon, tone }) {
  const toneMap = {
    red: ["#fee2e2", "#dc2626"],
    blue: ["#dbeafe", "#2563eb"],
    green: ["#dcfce7", "#16a34a"],
    orange: ["#ffedd5", "#f97316"],
  };

  const [bg, color] = toneMap[tone] || toneMap.blue;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4.5,
        border: "1px solid #e5e7eb",
        bgcolor: "rgba(255,255,255,0.92)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
        overflow: "hidden",
        position: "relative",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 24px 55px rgba(15,23,42,0.1)",
        },
        transition: "0.2s ease",
      }}
    >
      <CardContent sx={{ p: 2.6 }}>
        <Stack direction="row" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontWeight: 800, color: "#64748b" }}>
              {title}
            </Typography>

            {loading ? (
              <Skeleton width={90} height={48} sx={{ mt: 1 }} />
            ) : (
              <Typography
                sx={{
                  mt: 0.8,
                  fontSize: 32,
                  lineHeight: 1,
                  fontWeight: 950,
                  letterSpacing: -1,
                  color: "#0f172a",
                }}
              >
                {Number(value || 0)}
              </Typography>
            )}

            <Typography
              sx={{
                mt: 1.3,
                fontSize: 13,
                color: "#16a34a",
                fontWeight: 850,
              }}
            >
              {change}
            </Typography>
          </Box>

          <Avatar
            sx={{
              width: 54,
              height: 54,
              bgcolor: bg,
              color,
              borderRadius: 4,
            }}
          >
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );
}

function OrdersCard({ loading, orders }) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4.5,
        border: "1px solid #e5e7eb",
        bgcolor: "white",
        boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              sx={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}
            >
              Son Sifarişlər
            </Typography>
            <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.3 }}>
              Ən son satış əməliyyatları
            </Typography>
          </Box>

          <Button
            component={RouterLink}
            to="/exp/sales-history"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ fontWeight: 900, borderRadius: 3 }}
          >
            Hamısı
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Stack spacing={1}>
            <Skeleton height={45} />
            <Skeleton height={45} />
            <Skeleton height={45} />
            <Skeleton height={45} />
          </Stack>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCell}>Tarix</TableCell>
                  <TableCell sx={headCell}>Müştəri</TableCell>
                  <TableCell sx={headCell}>Məhsul sayı</TableCell>
                  <TableCell sx={headCell}>Məbləğ</TableCell>
                  <TableCell sx={headCell}>Ödəniş</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {(orders || []).slice(0, 8).map((order) => {
                  const count = (order.items || []).reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0,
                  );

                  const total = (order.items || []).reduce((sum, item) => {
                    return (
                      sum +
                      Number(item.quantity || 0) *
                        Number(item.unitPrice || item.product?.salePrice || 0)
                    );
                  }, 0);

                  return (
                    <TableRow
                      key={order.id}
                      hover
                      sx={{
                        "& td": { borderColor: "#eef2f7" },
                        "&:hover": { bgcolor: "#f8fafc" },
                      }}
                    >
                      <TableCell sx={bodyCell}>
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontWeight: 900 }}>
                        {order.customer?.name || "—"}
                      </TableCell>
                      <TableCell sx={bodyCell}>{count}</TableCell>
                      <TableCell sx={bodyCell}>{total.toFixed(2)} ₼</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={order.paymentType || "—"}
                          sx={{
                            fontWeight: 950,
                            borderRadius: 2,
                            bgcolor: "#dcfce7",
                            color: "#15803d",
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {(orders || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 5 }}>
                      <Typography
                        align="center"
                        sx={{ color: "#64748b", fontWeight: 800 }}
                      >
                        Hələ sifariş yoxdur.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}

        <Button
          component={RouterLink}
          to="/exp/sales-history"
          variant="outlined"
          sx={{
            mt: 2,
            borderRadius: 3,
            fontWeight: 900,
            borderColor: "#e5e7eb",
            color: "#0f172a",
          }}
        >
          Bütün sifarişlər
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickLinksCard() {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4.5,
        border: "1px solid #e5e7eb",
        bgcolor: "white",
        boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
      }}
    >
      <CardContent sx={{ p: 2.8 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
          Sürətli Keçidlər
        </Typography>
        <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.3, mb: 2 }}>
          Günlük işlədilən əsas bölmələr
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "1fr 1fr" },
            gap: 1.3,
          }}
        >
          <QuickLink
            to="/exp/sales"
            icon={<ShoppingCartRoundedIcon />}
            title="Yeni Satış"
            text="Satış yarat"
            tone="blue"
          />
          <QuickLink
            to="/exp/customers"
            icon={<PeopleAltRoundedIcon />}
            title="Müştərilər"
            text="Müştəri bazası"
            tone="sky"
          />
          <QuickLink
            to="/warehouse/stock"
            icon={<WarehouseRoundedIcon />}
            title="Anbar Qalığı"
            text="Stok vəziyyəti"
            tone="orange"
          />
          <QuickLink
            to="/driver/deliveries"
            icon={<LocalShippingRoundedIcon />}
            title="Çatdırılma"
            text="Çatdırılmanı idarə et"
            tone="green"
          />
        </Box>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, icon, title, text, tone }) {
  const toneMap = {
    blue: ["#eef2ff", "#4f46e5"],
    sky: ["#e0f2fe", "#0284c7"],
    orange: ["#ffedd5", "#f97316"],
    green: ["#dcfce7", "#16a34a"],
  };

  const [bg, color] = toneMap[tone] || toneMap.blue;

  return (
    <Button
      component={RouterLink}
      to={to}
      fullWidth
      sx={{
        justifyContent: "space-between",
        textAlign: "left",
        borderRadius: 4,
        p: 1.6,
        minHeight: 76,
        border: "1px solid #e5e7eb",
        color: "#0f172a",
        textTransform: "none",
        bgcolor: "white",
        "&:hover": {
          bgcolor: "#f8fafc",
          borderColor: "#cbd5e1",
          transform: "translateY(-2px)",
        },
        transition: "0.2s ease",
      }}
    >
      <Stack direction="row" spacing={1.3} alignItems="center">
        <Avatar sx={{ width: 44, height: 44, bgcolor: bg, color }}>
          {icon}
        </Avatar>

        <Box>
          <Typography sx={{ fontWeight: 950, lineHeight: 1.1 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: "#64748b", mt: 0.4 }}>
            {text}
          </Typography>
        </Box>
      </Stack>

      <ArrowForwardRoundedIcon sx={{ color: "#0f172a" }} />
    </Button>
  );
}

function MiniStatsCard({ revenue }) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4.5,
        border: "1px solid #e5e7eb",
        bgcolor: "white",
        boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
      }}
    >
      <CardContent sx={{ p: 2.8 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              sx={{ fontSize: 22, fontWeight: 950, color: "#0f172a" }}
            >
              Satış Statistikası
            </Typography>
            <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.3 }}>
              Bu ay üzrə ümumi görüntü
            </Typography>
          </Box>

          <Chip
            label="Bu ay"
            sx={{
              bgcolor: "#f8fafc",
              border: "1px solid #e5e7eb",
              fontWeight: 850,
            }}
          />
        </Stack>

        <Box sx={{ mt: 3 }}>
          <FakeLineChart />
        </Box>

        <Typography sx={{ mt: 2, color: "#64748b", fontSize: 13 }}>
          Son sifarişlər üzrə təxmini dövriyyə:
        </Typography>
        <Typography
          sx={{ mt: 0.4, color: "#0f172a", fontSize: 28, fontWeight: 950 }}
        >
          {revenue.toFixed(2)} ₼
        </Typography>
      </CardContent>
    </Card>
  );
}

function FakeLineChart() {
  const points = [22, 31, 28, 44, 38, 19, 34, 48, 41, 55, 47];

  return (
    <Box
      sx={{
        height: 190,
        borderRadius: 4,
        bgcolor: "#f8fafc",
        border: "1px solid #eef2f7",
        p: 2,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            left: 16,
            right: 16,
            top: 28 + i * 38,
            height: 1,
            bgcolor: "#e5e7eb",
          }}
        />
      ))}

      <Box
        sx={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 28,
          height: 120,
        }}
      >
        <svg
          width="100%"
          height="120"
          viewBox="0 0 300 120"
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#b91c1c"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points
              .map(
                (p, i) => `${(i / (points.length - 1)) * 300},${120 - p * 1.7}`,
              )
              .join(" ")}
          />
          <circle cx="210" cy="43" r="5" fill="#b91c1c" />
        </svg>
      </Box>
    </Box>
  );
}

function BottomStatCard({ title, value, change, icon, tone }) {
  const toneMap = {
    purple: ["#ede9fe", "#7c3aed"],
    orange: ["#ffedd5", "#f97316"],
    green: ["#dcfce7", "#16a34a"],
  };

  const [bg, color] = toneMap[tone] || toneMap.green;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4.5,
        border: "1px solid #e5e7eb",
        bgcolor: "white",
        boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
      }}
    >
      <CardContent sx={{ p: 2.4 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              sx={{ color: "#64748b", fontSize: 13, fontWeight: 850 }}
            >
              {title}
            </Typography>
            <Typography
              sx={{ mt: 0.5, color: "#0f172a", fontSize: 25, fontWeight: 950 }}
            >
              {value}
            </Typography>
            <Typography
              sx={{ mt: 0.5, color: "#16a34a", fontSize: 13, fontWeight: 850 }}
            >
              {change}
            </Typography>
          </Box>

          <Avatar sx={{ width: 52, height: 52, bgcolor: bg, color }}>
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );
}

const headCell = {
  fontWeight: 950,
  color: "#0f172a",
  fontSize: 14,
  borderColor: "#e5e7eb",
};

const bodyCell = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 650,
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("az-AZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
