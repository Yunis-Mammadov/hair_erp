import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Chip,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../lib/api";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    categories: 0,
    products: 0,
    customers: 0,
    recentOrders: [],
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // Parallel fetch (ən ucuz olanlar)
        const [catRes, prodRes, custRes, ordRes] = await Promise.allSettled([
          api.get("/catalog/categories"),
          api.get("/catalog/products"),
          api.get("/customers"),
          api.get("/exp/orders", { params: { take: 8 } }),
        ]);

        if (!alive) return;

        const categories =
          catRes.status === "fulfilled"
            ? (catRes.value.data?.categories ?? []).length
            : 0;
        const products =
          prodRes.status === "fulfilled"
            ? (prodRes.value.data?.products ?? []).length
            : 0;
        const customers =
          custRes.status === "fulfilled"
            ? (custRes.value.data?.customers ?? []).length
            : 0;
        const recentOrders =
          ordRes.status === "fulfilled"
            ? (ordRes.value.data?.orders ?? [])
            : [];

        setKpis({ categories, products, customers, recentOrders });
      } catch (e) {
        console.error(e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const topLine = useMemo(() => {
    const o = kpis.recentOrders?.[0];
    if (!o) return null;
    const itemCount = (o.items || []).reduce(
      (s, it) => s + (it.quantity || 0),
      0,
    );
    return { orderId: o.id, itemCount, customer: o.customer?.name || "—" };
  }, [kpis.recentOrders]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, letterSpacing: -0.5 }}
          >
            Ana Səhifə
          </Typography>
          <Typography sx={{ opacity: 0.8, mt: 0.5 }}>
            Sistem xülasəsi və sürətli keçidlər
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            component={RouterLink}
            to="/exp/sales"
            variant="contained"
            startIcon={<ShoppingCartOutlinedIcon />}
            sx={{ borderRadius: 3, textTransform: "none", fontWeight: 700 }}
          >
            Satış yaz
          </Button>
          <Button
            component={RouterLink}
            to="/exp/customers"
            variant="outlined"
            startIcon={<PeopleAltOutlinedIcon />}
            sx={{ borderRadius: 3, textTransform: "none", fontWeight: 700 }}
          >
            Müştərilər
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2.5 }} />

      {/* KPI cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "1fr 1fr 1fr 1fr",
          },
          gap: 2,
        }}
      >
        <KpiCard
          loading={loading}
          title="Kateqoriyalar"
          value={kpis.categories}
          icon={<Inventory2OutlinedIcon />}
          tone="info"
        />
        <KpiCard
          loading={loading}
          title="Məhsullar"
          value={kpis.products}
          icon={<TrendingUpOutlinedIcon />}
          tone="success"
        />
        <KpiCard
          loading={loading}
          title="Müştərilər"
          value={kpis.customers}
          icon={<PeopleAltOutlinedIcon />}
          tone="warning"
        />
        <KpiCard
          loading={loading}
          title="Son satış"
          value={topLine ? `${topLine.customer}` : "—"}
          sub={
            topLine
              ? `${topLine.itemCount} item • ${topLine.orderId.slice(0, 8)}…`
              : "Hələ satış yoxdur"
          }
          icon={<ShoppingCartOutlinedIcon />}
          tone="primary"
          isTextValue
        />
      </Box>

      {/* Recent orders */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" },
          gap: 2,
          mt: 2,
        }}
      >
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Son sifarişlər
              </Typography>
              <Chip label="EXP" size="small" sx={{ fontWeight: 700 }} />
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {loading ? (
              <Stack spacing={1}>
                <Skeleton height={34} />
                <Skeleton height={34} />
                <Skeleton height={34} />
              </Stack>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Tarix</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Müştəri</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Ödəniş</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(kpis.recentOrders || []).slice(0, 8).map((o) => {
                      const count = (o.items || []).reduce(
                        (s, it) => s + (it.quantity || 0),
                        0,
                      );
                      return (
                        <TableRow key={o.id} hover>
                          <TableCell>{formatDate(o.createdAt)}</TableCell>
                          <TableCell>{o.customer?.name || "—"}</TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={o.paymentType || "—"}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(kpis.recentOrders || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ opacity: 0.7 }}>
                          Hələ satış yoxdur.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Right card: Quick Tips */}
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Sürətli plan
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1.2}>
              <Tip
                title="1) Data əlavə et"
                text="Category → Product → Stock (Studio ilə 2 dəqiqə)"
              />
              <Tip
                title="2) Sales UI"
                text="Satış ekranında cart işləsin, sonra customer seçimi"
              />
              <Tip
                title="3) Confirm order"
                text="POST /orders + stock decrement (transaction)"
              />
              <Button
                component={RouterLink}
                to="/exp/sales"
                variant="contained"
                fullWidth
                sx={{
                  mt: 1,
                  borderRadius: 3,
                  textTransform: "none",
                  fontWeight: 800,
                }}
              >
                Satış ekranına keç
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

function KpiCard({ loading, title, value, sub, icon, tone, isTextValue }) {
  return (
    <Card
      sx={{
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            tone === "primary"
              ? "linear-gradient(135deg, rgba(25,118,210,0.18), rgba(0,0,0,0))"
              : tone === "success"
                ? "linear-gradient(135deg, rgba(46,125,50,0.18), rgba(0,0,0,0))"
                : tone === "warning"
                  ? "linear-gradient(135deg, rgba(237,108,2,0.18), rgba(0,0,0,0))"
                  : "linear-gradient(135deg, rgba(2,136,209,0.18), rgba(0,0,0,0))",
          pointerEvents: "none",
        }}
      />
      <CardContent sx={{ position: "relative" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography sx={{ fontWeight: 800, opacity: 0.85 }}>
            {title}
          </Typography>
          <Box sx={{ opacity: 0.8 }}>{icon}</Box>
        </Stack>

        <Box sx={{ mt: 1.2 }}>
          {loading ? (
            <Skeleton width="60%" height={40} />
          ) : (
            <Typography
              variant="h4"
              sx={{ fontWeight: 900, letterSpacing: -0.5 }}
            >
              {isTextValue ? value : Number(value || 0)}
            </Typography>
          )}
          {sub ? (
            <Typography sx={{ opacity: 0.7, mt: 0.4, fontSize: 13 }}>
              {sub}
            </Typography>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}

function Tip({ title, text }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
      <Typography sx={{ opacity: 0.75, fontSize: 13 }}>{text}</Typography>
    </Box>
  );
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return "—";
  }
}
