import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { api } from "../lib/api";

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("az-AZ");
}

function getStatusLabel(status) {
  if (status === "OUT") return "Bitib";
  if (status === "LOW") return "Az qalıb";
  return "Normal";
}

function getStatusColor(status) {
  if (status === "OUT") return "error";
  if (status === "LOW") return "warning";
  return "success";
}

export default function StockPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    outOfStock: 0,
    lowStock: 0,
  });

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("ALL");

  async function fetchCategories() {
    const res = await api.get("/catalog/categories");
    setCategories(res.data?.categories || []);
  }

  async function fetchStock() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/stock", {
        params: {
          search: search.trim() || undefined,
          categoryId: categoryId || undefined,
          status,
        },
      });

      setItems(res.data?.items || []);
      setStats(
        res.data?.stats || {
          totalProducts: 0,
          totalQuantity: 0,
          outOfStock: 0,
          lowStock: 0,
        },
      );
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Stok məlumatı yüklənmədi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStock();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const statCards = useMemo(
    () => [
      {
        title: "Məhsul növü",
        value: stats.totalProducts,
        icon: <CategoryOutlinedIcon color="primary" />,
      },
      {
        title: "Toplam stok",
        value: stats.totalQuantity,
        icon: <Inventory2OutlinedIcon color="success" />,
      },
      {
        title: "Bitib",
        value: stats.outOfStock,
        icon: <CancelOutlinedIcon color="error" />,
      },
      {
        title: "Az qalıb",
        value: stats.lowStock,
        icon: <WarningAmberOutlinedIcon color="warning" />,
      },
    ],
    [stats],
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1600, mx: "auto" }}>
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, letterSpacing: -0.6, mb: 0.5 }}
          >
            Anbar qalığı
          </Typography>

          <Typography sx={{ opacity: 0.75 }}>
            Alış zamanı əlavə olunan məhsulların hazırkı stok vəziyyəti
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                {card.icon}
                <Box>
                  <Typography sx={{ fontSize: 13, opacity: 0.75 }}>
                    {card.title}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 28 }}>
                    {card.value}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              fullWidth
              label="Məhsul axtar"
              placeholder="Məs: 5.00, keratin və s."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <FormControl sx={{ minWidth: { xs: "100%", md: 220 } }}>
              <InputLabel>Kateqoriya</InputLabel>
              <Select
                value={categoryId}
                label="Kateqoriya"
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <MenuItem value="">Hamısı</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: { xs: "100%", md: 220 } }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="ALL">Hamısı</MenuItem>
                <MenuItem value="IN_STOCK">Stokda var</MenuItem>
                <MenuItem value="LOW">Az qalıb</MenuItem>
                <MenuItem value="OUT">Bitib</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography sx={{ fontWeight: 900, mb: 1.5 }}>
            Stok siyahısı
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Stack spacing={1}>
              <Skeleton height={60} />
              <Skeleton height={60} />
              <Skeleton height={60} />
              <Skeleton height={60} />
            </Stack>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : items.length === 0 ? (
            <Alert severity="info">Uyğun stok tapılmadı.</Alert>
          ) : isMobile ? (
            <Stack spacing={1.2}>
              {items.map((item) => (
                <Paper
                  key={item.productId}
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 3 }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontWeight: 900,
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.productName}
                        </Typography>
                        <Typography sx={{ fontSize: 12, opacity: 0.75 }}>
                          {item.category?.name || "-"}
                        </Typography>
                      </Box>

                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        label={`Stok: ${item.quantity}`}
                        color="primary"
                        size="small"
                      />
                      <Chip
                        label={`Satış: ${formatMoney(item.salePrice)}`}
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                      Son yenilənmə: {formatDate(item.updatedAt)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>Məhsul</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Kateqoriya</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Stok</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>
                      Satış qiyməti
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>
                      Son yenilənmə
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId} hover>
                      <TableCell sx={{ fontWeight: 800 }}>
                        {item.productName}
                      </TableCell>
                      <TableCell>{item.category?.name || "-"}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatMoney(item.salePrice)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(item.status)}
                          color={getStatusColor(item.status)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(item.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
