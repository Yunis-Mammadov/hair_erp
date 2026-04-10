import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Divider,
  Link,
  Chip,
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { api } from "../lib/api";

const PAYMENT_OPTIONS = ["", "REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];

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

export default function SalesHistoryPage() {
  const currentUser = useMemo(() => getStoredUser(), []);

  const canFilterExpeditor =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "DRIVER" ||
    currentUser?.role === "WAREHOUSE";

  const [orders, setOrders] = useState([]);
  const [expeditors, setExpeditors] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    expeditorId: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    expeditorId: "",
  });

  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);

  const fetchOrders = async (page = 1, customFilters = appliedFilters) => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: pagination.limit,
      };

      if (customFilters.search) params.search = customFilters.search;
      if (customFilters.paymentType) {
        params.paymentType = customFilters.paymentType;
      }
      if (customFilters.startDate) params.startDate = customFilters.startDate;
      if (customFilters.endDate) params.endDate = customFilters.endDate;

      if (canFilterExpeditor && customFilters.expeditorId) {
        params.expeditorId = customFilters.expeditorId;
      }

      const { data } = await api.get("/orders", { params });

      setOrders(data.orders || []);
      setPagination((prev) => ({
        ...prev,
        page: data.pagination?.page || 1,
        limit: data.pagination?.limit || 10,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
      }));
    } catch (error) {
      console.error("Fetch orders error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpeditors = async () => {
    if (!canFilterExpeditor) return;

    try {
      const { data } = await api.get("/users", {
        params: { role: "EXPEDITOR" },
      });

      setExpeditors(data.users || []);
    } catch (error) {
      console.error("Fetch expeditors error:", error);
      setExpeditors([]);
    }
  };

  const fetchOrderDetail = async (id) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);

      const { data } = await api.get(`/orders/${id}`);
      setSelectedOrder(data.order || null);
    } catch (error) {
      console.error("Fetch order detail error:", error);
      setSelectedOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1, appliedFilters);
    fetchExpeditors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (filters.search !== appliedFilters.search) {
        const nextFilters = {
          ...filters,
        };

        setAppliedFilters(nextFilters);
        fetchOrders(1, nextFilters);
      }
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const handleSearch = () => {
    setAppliedFilters(filters);
    fetchOrders(1, filters);
  };

  const handleReset = () => {
    const reset = {
      search: "",
      paymentType: "",
      startDate: "",
      endDate: "",
      expeditorId: "",
    };

    setFilters(reset);
    setAppliedFilters(reset);
    fetchOrders(1, reset);
  };

  const handlePageChange = (_, value) => {
    fetchOrders(value, appliedFilters);
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("az-AZ");
  };

  const getItemCount = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };

  const getOrderTotal = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      if (item.isGift) return sum;

      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      return sum + qty * price;
    }, 0);
  };

  const getGoogleMapsLink = (lat, lng) => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const getWazeLink = (lat, lng) => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  };

  const renderLocationLinks = (customer) => {
    const lat = customer?.lat;
    const lng = customer?.lng;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return "-";
    }

    return (
      <Stack spacing={0.5} alignItems="center">
        <Link
          href={getGoogleMapsLink(lat, lng)}
          target="_blank"
          rel="noreferrer"
          underline="hover"
        >
          Google Maps
        </Link>
        <Link
          href={getWazeLink(lat, lng)}
          target="_blank"
          rel="noreferrer"
          underline="hover"
        >
          Waze
        </Link>
      </Stack>
    );
  };

  const normalItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items.filter((item) => !item.isGift);
  }, [selectedOrder]);

  const giftItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items.filter((item) => item.isGift);
  }, [selectedOrder]);

  const hasGiftItems = giftItems.length > 0;

  const printNormalItems = useMemo(() => {
    if (!printOrder?.items) return [];
    return printOrder.items.filter((item) => !item.isGift);
  }, [printOrder]);

  const printGiftItems = useMemo(() => {
    if (!printOrder?.items) return [];
    return printOrder.items.filter((item) => item.isGift);
  }, [printOrder]);

  const printHasGiftItems = printGiftItems.length > 0;

  function openPrintPreview(order) {
    if (!order) return;
    setPrintOrder(order);
    setPrintPreviewOpen(true);
  }

  function handlePrintCurrentPage() {
    window.print();
  }

  return (
    <Box p={3}>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            #print-area, #print-area * {
              visibility: visible !important;
            }

            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 24px;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <Typography variant="h5" fontWeight={700} mb={2}>
        Satış tarixçəsi
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          useFlexGap
          flexWrap="wrap"
        >
          <TextField
            label="Axtarış (ad, telefon, salon)"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            fullWidth
          />

          <TextField
            select
            label="Ödəniş növü"
            value={filters.paymentType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, paymentType: e.target.value }))
            }
            sx={{ minWidth: 180 }}
          >
            {PAYMENT_OPTIONS.map((option) => (
              <MenuItem key={option || "ALL"} value={option}>
                {option || "Hamısı"}
              </MenuItem>
            ))}
          </TextField>

          {canFilterExpeditor && (
            <TextField
              select
              label="Ekspeditor"
              value={filters.expeditorId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  expeditorId: e.target.value,
                }))
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Hamısı</MenuItem>
              {expeditors.map((expeditor) => (
                <MenuItem key={expeditor.id} value={expeditor.id}>
                  {expeditor.fullName || expeditor.email}
                </MenuItem>
              ))}
            </TextField>
          )}

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

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSearch}>
              Axtar
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Sıfırla
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={6}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table
                sx={{
                  border: "1px solid rgba(224, 224, 224, 1)",
                  "& th, & td": {
                    border: "1px solid rgba(224, 224, 224, 1)",
                    textAlign: "center",
                    verticalAlign: "middle",
                    padding: "10px",
                  },
                  "& th": {
                    fontWeight: 700,
                    backgroundColor: "#f5f5f5",
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Ünvan</TableCell>
                    <TableCell>Tarix</TableCell>
                    <TableCell>Müştəri</TableCell>
                    <TableCell>Telefon</TableCell>
                    <TableCell>Salon</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Ödəniş</TableCell>
                    <TableCell>Məhsul sayı</TableCell>
                    <TableCell>Ekspeditor</TableCell>
                    <TableCell>Ətraflı</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        Məlumat tapılmadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow
                        key={order.id}
                        hover
                        sx={{
                          "&:hover": {
                            backgroundColor: "#fafafa",
                          },
                        }}
                      >
                        <TableCell sx={{ maxWidth: 220 }}>
                          {order.customer?.address || "-"}
                        </TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>{order.customer?.name || "-"}</TableCell>
                        <TableCell>{order.customer?.phone || "-"}</TableCell>
                        <TableCell>{order.customer?.salon || "-"}</TableCell>
                        <TableCell>
                          {renderLocationLinks(order.customer)}
                        </TableCell>
                        <TableCell>{order.paymentType || "-"}</TableCell>
                        <TableCell>{getItemCount(order.items)}</TableCell>
                        <TableCell>
                          {order.createdBy?.fullName ||
                            order.createdBy?.email ||
                            "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => fetchOrderDetail(order.id)}
                          >
                            Bax
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={2}
              flexDirection={{ xs: "column", sm: "row" }}
              gap={2}
            >
              <Typography variant="body2">Ümumi: {pagination.total}</Typography>

              <Pagination
                page={pagination.page}
                count={pagination.totalPages || 1}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          </>
        )}
      </Paper>

      <Dialog
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedOrder(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1}
          >
            <Typography variant="h6" fontWeight={700}>
              Sifariş detalları
            </Typography>

            {!!selectedOrder && !detailLoading && (
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => openPrintPreview(selectedOrder)}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Çap et
              </Button>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : !selectedOrder ? (
            <Typography>Məlumat tapılmadı</Typography>
          ) : (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Əsas məlumatlar
              </Typography>

              <Typography>
                <b>Tarix:</b> {formatDate(selectedOrder.createdAt)}
              </Typography>
              <Typography>
                <b>Ödəniş növü:</b> {selectedOrder.paymentType || "-"}
              </Typography>
              <Typography>
                <b>Qeyd:</b> {selectedOrder.note || "-"}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Müştəri
              </Typography>

              <Typography>
                <b>Ad:</b> {selectedOrder.customer?.name || "-"}
              </Typography>
              <Typography>
                <b>Telefon:</b> {selectedOrder.customer?.phone || "-"}
              </Typography>
              <Typography>
                <b>Salon:</b> {selectedOrder.customer?.salon || "-"}
              </Typography>
              <Typography>
                <b>Ünvan:</b> {selectedOrder.customer?.address || "-"}
              </Typography>

              {typeof selectedOrder.customer?.lat === "number" &&
                typeof selectedOrder.customer?.lng === "number" && (
                  <>
                    <Typography>
                      <Link
                        href={getGoogleMapsLink(
                          selectedOrder.customer.lat,
                          selectedOrder.customer.lng,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                      >
                        Google Maps-də aç
                      </Link>
                    </Typography>
                    <Typography>
                      <Link
                        href={getWazeLink(
                          selectedOrder.customer.lat,
                          selectedOrder.customer.lng,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                      >
                        Waze-də aç
                      </Link>
                    </Typography>
                  </>
                )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Sifarişi yazan
              </Typography>

              <Typography>
                <b>Ad:</b>{" "}
                {selectedOrder.createdBy?.fullName ||
                  selectedOrder.createdBy?.email ||
                  "-"}
              </Typography>
              <Typography>
                <b>Rol:</b> {selectedOrder.createdBy?.role || "-"}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                mb={1.5}
              >
                <Chip
                  label={`Məhsul sayı: ${getItemCount(normalItems)}`}
                  color="primary"
                  variant="outlined"
                />

                {hasGiftItems && (
                  <Chip
                    label={`Hədiyyə məhsul sayı: ${getItemCount(giftItems)}`}
                    color="secondary"
                    variant="outlined"
                  />
                )}

                <Chip
                  label={`Toplam satış: ${formatMoney(
                    getOrderTotal(selectedOrder.items || []),
                  )}`}
                  color="success"
                  variant="outlined"
                />
              </Stack>

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Satılan məhsullar
              </Typography>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ mb: hasGiftItems ? 2 : 0 }}
              >
                <Table
                  sx={{
                    border: "1px solid rgba(224, 224, 224, 1)",
                    "& th, & td": {
                      border: "1px solid rgba(224, 224, 224, 1)",
                      textAlign: "center",
                      verticalAlign: "middle",
                      padding: "10px",
                    },
                    "& th": {
                      fontWeight: 700,
                      backgroundColor: "#f5f5f5",
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Məhsul</TableCell>
                      <TableCell>Kateqoriya</TableCell>
                      <TableCell>Miqdar</TableCell>
                      <TableCell>Qiymət</TableCell>
                      <TableCell>Cəm</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {normalItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          Normal satış məhsulu yoxdur
                        </TableCell>
                      </TableRow>
                    ) : (
                      normalItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product?.name || "-"}</TableCell>
                          <TableCell>
                            {item.product?.category?.name || "-"}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                          <TableCell>
                            {formatMoney(
                              Number(item.quantity || 0) *
                                Number(item.unitPrice || 0),
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {hasGiftItems && (
                <>
                  <Typography variant="subtitle1" fontWeight={700} mb={1}>
                    Hədiyyə məhsullar
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table
                      sx={{
                        border: "1px solid rgba(224, 224, 224, 1)",
                        "& th, & td": {
                          border: "1px solid rgba(224, 224, 224, 1)",
                          textAlign: "center",
                          verticalAlign: "middle",
                          padding: "10px",
                        },
                        "& th": {
                          fontWeight: 700,
                          backgroundColor: "#f5f5f5",
                        },
                      }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell>Məhsul</TableCell>
                          <TableCell>Kateqoriya</TableCell>
                          <TableCell>Miqdar</TableCell>
                          <TableCell>Qiymət</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {giftItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product?.name || "-"}</TableCell>
                            <TableCell>
                              {item.product?.category?.name || "-"}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>0.00 ₼</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={printPreviewOpen}
        onClose={() => {
          setPrintPreviewOpen(false);
          setPrintOrder(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle className="no-print">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1}
          >
            <Typography variant="h6" fontWeight={700}>
              Çap önizləmə
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  setPrintPreviewOpen(false);
                  setPrintOrder(null);
                }}
              >
                Bağla
              </Button>

              <Button
                variant="contained"
                startIcon={<PrintOutlinedIcon />}
                onClick={handlePrintCurrentPage}
              >
                Print
              </Button>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
          {!printOrder ? (
            <Typography>Məlumat tapılmadı</Typography>
          ) : (
            <Box
              id="print-area"
              sx={{
                bgcolor: "white",
                color: "#111",
                p: 3,
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" fontWeight={700} mb={2}>
                Satış Qaiməsi
              </Typography>

              <Typography mb={3}>
                <b>Tarix:</b> {formatDate(printOrder.createdAt)}
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>
                    Müştəri məlumatı
                  </Typography>
                  <Typography>
                    <b>Ad:</b> {printOrder.customer?.name || "-"}
                  </Typography>
                  <Typography>
                    <b>Telefon:</b> {printOrder.customer?.phone || "-"}
                  </Typography>
                  <Typography>
                    <b>Salon:</b> {printOrder.customer?.salon || "-"}
                  </Typography>
                  <Typography>
                    <b>Ünvan:</b> {printOrder.customer?.address || "-"}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>
                    Sifariş məlumatı
                  </Typography>
                  <Typography>
                    <b>Ödəniş növü:</b> {printOrder.paymentType || "-"}
                  </Typography>
                  <Typography>
                    <b>Ekspeditor:</b>{" "}
                    {printOrder.createdBy?.fullName ||
                      printOrder.createdBy?.email ||
                      "-"}
                  </Typography>
                  <Typography>
                    <b>Məhsul sayı:</b> {getItemCount(printNormalItems)}
                  </Typography>

                  {printHasGiftItems && (
                    <Typography>
                      <b>Hədiyyə məhsul sayı:</b> {getItemCount(printGiftItems)}
                    </Typography>
                  )}

                  <Typography>
                    <b>Qeyd:</b> {printOrder.note || "-"}
                  </Typography>
                </Paper>
              </Stack>

              <Typography variant="h6" fontWeight={700} mb={1}>
                Satılan məhsullar
              </Typography>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ mb: 3 }}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>№</TableCell>
                      <TableCell>Məhsul</TableCell>
                      <TableCell>Kateqoriya</TableCell>
                      <TableCell>Miqdar</TableCell>
                      <TableCell>Vahid qiymət</TableCell>
                      <TableCell>Cəm</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {printNormalItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>Satılan məhsul yoxdur</TableCell>
                      </TableRow>
                    ) : (
                      printNormalItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{item.product?.name || "-"}</TableCell>
                          <TableCell>
                            {item.product?.category?.name || "-"}
                          </TableCell>
                          <TableCell>{item.quantity || 0}</TableCell>
                          <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                          <TableCell>
                            {formatMoney(
                              Number(item.quantity || 0) *
                                Number(item.unitPrice || 0),
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {printHasGiftItems && (
                <>
                  <Typography variant="h6" fontWeight={700} mb={1}>
                    Hədiyyə məhsullar
                  </Typography>

                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ mb: 3 }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>№</TableCell>
                          <TableCell>Məhsul</TableCell>
                          <TableCell>Kateqoriya</TableCell>
                          <TableCell>Miqdar</TableCell>
                          <TableCell>Vahid qiymət</TableCell>
                          <TableCell>Cəm</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {printGiftItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{item.product?.name || "-"}</TableCell>
                            <TableCell>
                              {item.product?.category?.name || "-"}
                            </TableCell>
                            <TableCell>{item.quantity || 0}</TableCell>
                            <TableCell>0.00 ₼</TableCell>
                            <TableCell>0.00 ₼</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              <Box display="flex" justifyContent="flex-end">
                <Paper variant="outlined" sx={{ p: 2, minWidth: 320 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>Toplam satış:</Typography>
                    <Typography fontWeight={700}>
                      {formatMoney(getOrderTotal(printOrder.items || []))}
                    </Typography>
                  </Stack>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
