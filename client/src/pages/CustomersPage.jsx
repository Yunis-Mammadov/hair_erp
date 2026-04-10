import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonIcon from "@mui/icons-material/Person";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { getCustomers } from "../lib/customers";
import { api } from "../lib/api";

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("az-AZ");
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

export default function CustomersPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getStoredUser(), []);

  const canFilterExpeditor =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "DRIVER" ||
    currentUser?.role === "WAREHOUSE";

  const [customers, setCustomers] = useState([]);
  const [expeditors, setExpeditors] = useState([]);
  const [search, setSearch] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchCustomers(searchValue = "", selectedExpeditorId = "") {
    try {
      setLoading(true);
      setError("");

      const data = await getCustomers(searchValue, selectedExpeditorId);
      setCustomers(data.customers || []);
    } catch (err) {
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

  const handleRefresh = () => {
    fetchCustomers(search, expeditorId);
  };

  const handleReset = () => {
    setSearch("");
    setExpeditorId("");
    fetchCustomers("", "");
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Müştərilər
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Bütün müştərilərin siyahısı
          </Typography>
        </Box>

        <Chip
          icon={<PeopleAltIcon />}
          label={`Toplam: ${customers.length}`}
          color="primary"
          variant="outlined"
          sx={{ width: "fit-content", fontWeight: 600 }}
        />
      </Stack>

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
        }}
      >
        <Stack spacing={2}>
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
              label="Müştəri axtar"
              placeholder="Ad, telefon və ya salon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                flex: 1,
                minWidth: { xs: "100%", md: 320 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            {canFilterExpeditor && (
              <TextField
                select
                label="Ekspeditor"
                value={expeditorId}
                onChange={(e) => setExpeditorId(e.target.value)}
                sx={{
                  minWidth: { xs: "100%", md: 250 },
                }}
              >
                <MenuItem value="">Hamısı</MenuItem>
                {expeditors.map((expeditor) => (
                  <MenuItem key={expeditor.id} value={expeditor.id}>
                    {expeditor.fullName || expeditor.email || "-"}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                width: { xs: "100%", md: "auto" },
              }}
            >
              <Button
                variant="contained"
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                sx={{
                  minWidth: 140,
                  height: 56,
                }}
              >
                Yenilə
              </Button>

              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{
                  minWidth: 120,
                  height: 56,
                }}
              >
                Sıfırla
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : customers.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="info">Heç bir müştəri tapılmadı.</Alert>
          </Box>
        ) : (
          <TableContainer>
            <Table
              sx={{
                "& th": {
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                },
                "& td": {
                  verticalAlign: "middle",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Ad</TableCell>
                  <TableCell>Telefon</TableCell>
                  <TableCell>Salon</TableCell>
                  <TableCell>Ünvan</TableCell>
                  <TableCell>Ekspeditor</TableCell>
                  <TableCell>Yenilənib</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    hover
                    onClick={() => navigate(`/exp/customers/${customer.id}`)}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "action.hover",
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>
                      {customer.name || "-"}
                    </TableCell>

                    <TableCell>{customer.phone || "-"}</TableCell>

                    <TableCell>{customer.salon || "-"}</TableCell>

                    <TableCell sx={{ maxWidth: 260 }}>
                      {customer.address || "-"}
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonIcon fontSize="small" />
                        <Typography variant="body2">
                          {customer.assignedExpeditor?.fullName ||
                            customer.assignedExpeditor?.email ||
                            "-"}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>{formatDate(customer.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
