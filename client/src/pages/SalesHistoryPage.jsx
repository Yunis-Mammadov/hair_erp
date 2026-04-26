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
  IconButton,
  Alert,
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { useTheme, useMediaQuery } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SignaturePad from "../components/SignaturePad";
import { api } from "../lib/api";

const PAYMENT_OPTIONS = ["", "REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];
const EDIT_PAYMENT_OPTIONS = ["REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

function formatInvoiceNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "00000";
  return String(num).padStart(5, "0");
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

function normalizeProductListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

function normalizeCategoryListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.categories)) return data.categories;
  return [];
}

function buildEditItemsFromOrder(order) {
  if (!order?.items || !Array.isArray(order.items)) return [];

  return order.items.map((item) => ({
    localKey: item.id || `${item.productId}-${Math.random()}`,
    productId: item.productId,
    productName: item.product?.name || "-",
    categoryName: item.product?.category?.name || "-",
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
    isGift: Boolean(item.isGift),
    stockQuantity:
      typeof item.product?.stock?.quantity === "number"
        ? item.product.stock.quantity
        : null,
    returnedQty: Number(item.returnedQty || 0),
  }));
}

export default function SalesHistoryPage() {
  const currentUser = useMemo(() => getStoredUser(), []);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const canFilterExpeditor =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "DRIVER" ||
    currentUser?.role === "WAREHOUSE";

  const canViewOrderDetail =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "EXPEDITOR" ||
    currentUser?.role === "WAREHOUSE" ||
    currentUser?.role === "DRIVER";

  const canEditOrder = currentUser?.role === "ADMIN";

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

  const [isEditMode, setIsEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [editForm, setEditForm] = useState({
    paymentType: "NAĞD",
    note: "",
    items: [],
  });

  const [productCategories, setProductCategories] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

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
    if (!canViewOrderDetail) return;

    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setIsEditMode(false);
      setEditError("");
      setEditSuccess("");

      const { data } = await api.get(`/orders/${id}`);
      const order = data.order || null;

      setSelectedOrder(order);

      if (order) {
        setEditForm({
          paymentType: order.paymentType || "NAĞD",
          note: order.note || "",
          items: buildEditItemsFromOrder(order),
        });
      }
    } catch (error) {
      console.error("Fetch order detail error:", error);
      setSelectedOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/catalog/categories");
      setProductCategories(normalizeCategoryListResponse(data));
    } catch (error) {
      console.error("Fetch categories error:", error);
      setProductCategories([]);
    }
  };

  const fetchProducts = async (
    searchValue = productSearch,
    categoryIdValue = selectedCategoryId,
  ) => {
    try {
      const params = {};
      if (searchValue?.trim()) params.search = searchValue.trim();
      if (categoryIdValue) params.categoryId = categoryIdValue;

      const { data } = await api.get("/catalog/products", { params });
      setCatalogProducts(normalizeProductListResponse(data));
    } catch (error) {
      console.error("Fetch products error:", error);
      setCatalogProducts([]);
    }
  };

  useEffect(() => {
    fetchOrders(1, appliedFilters);
    fetchExpeditors();
    fetchCategories();
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

  useEffect(() => {
    if (!detailOpen || !isEditMode) return;
    fetchProducts(productSearch, selectedCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen, isEditMode, productSearch, selectedCategoryId]);

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

  function hasReturnedItems(items) {
    if (!Array.isArray(items)) return false;
    return items.some((item) => Number(item.returnedQty || 0) > 0);
  }

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

  const editNormalItems = useMemo(() => {
    return editForm.items.filter((item) => !item.isGift);
  }, [editForm.items]);

  const editGiftItems = useMemo(() => {
    return editForm.items.filter((item) => item.isGift);
  }, [editForm.items]);

  const editTotal = useMemo(() => {
    return getOrderTotal(editForm.items);
  }, [editForm.items]);

  function openPrintPreview(order) {
    if (!order) return;
    setPrintOrder(order);
    setPrintPreviewOpen(true);
  }

  function handlePrintCurrentPage() {
    window.print();
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setSelectedOrder(null);
    setIsEditMode(false);
    setEditError("");
    setEditSuccess("");
    setProductSearch("");
    setSelectedCategoryId("");
    setSelectedProductId("");
    setEditForm({
      paymentType: "NAĞD",
      note: "",
      items: [],
    });
  }

  function enterEditMode() {
    if (!selectedOrder) return;

    setEditForm({
      paymentType: selectedOrder.paymentType || "NAĞD",
      note: selectedOrder.note || "",
      items: buildEditItemsFromOrder(selectedOrder),
    });
    setEditError("");
    setEditSuccess("");
    setIsEditMode(true);
  }

  function cancelEditMode() {
    if (!selectedOrder) {
      setIsEditMode(false);
      return;
    }

    setEditForm({
      paymentType: selectedOrder.paymentType || "NAĞD",
      note: selectedOrder.note || "",
      items: buildEditItemsFromOrder(selectedOrder),
    });
    setEditError("");
    setEditSuccess("");
    setIsEditMode(false);
  }

  function updateEditItem(localKey, patch) {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.localKey === localKey ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeEditItem(localKey) {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.localKey !== localKey),
    }));
  }

  function handleAddProductToEdit(isGift = false) {
    if (!selectedProductId) return;

    const product = catalogProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    setEditForm((prev) => {
      const existingIndex = prev.items.findIndex(
        (item) => item.productId === product.id && item.isGift === isGift,
      );

      if (existingIndex !== -1) {
        return {
          ...prev,
          items: prev.items.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity: Number(item.quantity || 0) + 1,
                }
              : item,
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            localKey: `new-${product.id}-${Date.now()}-${Math.random()}`,
            productId: product.id,
            productName: product.name || "-",
            categoryName: product.category?.name || "-",
            quantity: 1,
            unitPrice: isGift ? 0 : Number(product.salePrice || 0),
            isGift,
            stockQuantity:
              typeof product.stock?.quantity === "number"
                ? product.stock.quantity
                : null,
            returnedQty: 0,
          },
        ],
      };
    });

    setSelectedProductId("");
  }

  async function handleSaveEdit() {
    if (!selectedOrder?.id) return;

    try {
      setEditSaving(true);
      setEditError("");
      setEditSuccess("");

      if (!editForm.paymentType) {
        setEditError("Ödəniş növü seçilməlidir");
        return;
      }

      if (!Array.isArray(editForm.items) || editForm.items.length === 0) {
        setEditError("Ən azı 1 məhsul olmalıdır");
        return;
      }

      const invalidItem = editForm.items.find((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        if (!item.productId) return true;
        if (!Number.isInteger(quantity) || quantity <= 0) return true;
        if (item.isGift && unitPrice !== 0) return true;
        if (!item.isGift && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
          return true;
        }

        return false;
      });

      if (invalidItem) {
        setEditError("Məhsul məlumatlarında problem var");
        return;
      }

      const payload = {
        paymentType: editForm.paymentType,
        note: editForm.note,
        items: editForm.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.isGift ? 0 : item.unitPrice),
          isGift: Boolean(item.isGift),
        })),
      };

      await api.put(`/orders/${selectedOrder.id}`, payload);

      const { data } = await api.get(`/orders/${selectedOrder.id}`);
      const freshOrder = data.order || null;

      setSelectedOrder(freshOrder);

      if (freshOrder) {
        setEditForm({
          paymentType: freshOrder.paymentType || "NAĞD",
          note: freshOrder.note || "",
          items: buildEditItemsFromOrder(freshOrder),
        });
      }

      await fetchOrders(pagination.page, appliedFilters);

      setEditSuccess("Sifariş uğurla yeniləndi");
      setIsEditMode(false);
    } catch (error) {
      console.error("Update order error:", error);
      setEditError(
        error?.response?.data?.message || "Sifariş yenilənə bilmədi",
      );
    } finally {
      setEditSaving(false);
    }
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
              padding: 0;
              margin: 0;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            .no-print {
              display: none !important;
            }

            @page {
              size: A4;
              margin: 12mm;
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
                    <TableCell>Qaimə №</TableCell>
                    <TableCell>Ünvan</TableCell>
                    <TableCell>Tarix</TableCell>
                    <TableCell>Müştəri</TableCell>
                    <TableCell>Telefon</TableCell>
                    <TableCell>Salon</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Ödəniş</TableCell>
                    <TableCell>Məhsul sayı</TableCell>
                    <TableCell>Ekspeditor</TableCell>
                    {canViewOrderDetail && <TableCell>Ətraflı</TableCell>}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canViewOrderDetail ? 11 : 10}
                        align="center"
                      >
                        Məlumat tapılmadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow
                        key={order.id}
                        hover
                        sx={{
                          backgroundColor: hasReturnedItems(order.items)
                            ? "rgba(244, 67, 54, 0.12)"
                            : "inherit",
                          "&:hover": {
                            backgroundColor: hasReturnedItems(order.items)
                              ? "rgba(244, 67, 54, 0.18)"
                              : "#fafafa",
                          },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>
                          {formatInvoiceNumber(order.orderNumber)}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          {order.customer?.address || "-"}
                        </TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>

                        <TableCell>
                          <Stack spacing={0.5} alignItems="center">
                            <Typography>
                              {order.customer?.name || "-"}
                            </Typography>

                            {hasReturnedItems(order.items) && (
                              <Chip
                                label="Geri qaytarma"
                                color="error"
                                size="small"
                                sx={{ fontWeight: 700 }}
                              />
                            )}
                          </Stack>
                        </TableCell>

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

                        {canViewOrderDetail && (
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => fetchOrderDetail(order.id)}
                            >
                              Bax
                            </Button>
                          </TableCell>
                        )}
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

      {canViewOrderDetail && (
        <Dialog
          open={detailOpen}
          onClose={handleCloseDetail}
          fullWidth
          maxWidth="lg"
        >
          <DialogTitle>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1}
            >
              <Typography variant="h6" fontWeight={700}>
                {isEditMode ? "Sifariş redaktəsi" : "Sifariş detalları"}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {!isEditMode && !!selectedOrder && !detailLoading && (
                  <>
                    {canEditOrder && (
                      <Button
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={enterEditMode}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        Edit et
                      </Button>
                    )}

                    <Button
                      variant="outlined"
                      startIcon={<PrintOutlinedIcon />}
                      onClick={() => openPrintPreview(selectedOrder)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Çap et
                    </Button>
                  </>
                )}

                {isEditMode && (
                  <>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<CloseOutlinedIcon />}
                      onClick={cancelEditMode}
                      disabled={editSaving}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Ləğv et
                    </Button>

                    <Button
                      variant="contained"
                      startIcon={<SaveOutlinedIcon />}
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {editSaving ? "Yadda saxlanılır..." : "Yadda saxla"}
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
          </DialogTitle>

          <DialogContent dividers sx={{ maxHeight: "80vh" }}>
            {detailLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : !selectedOrder ? (
              <Typography>Məlumat tapılmadı</Typography>
            ) : !isEditMode ? (
              <Box>
                {editSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {editSuccess}
                  </Alert>
                )}

                <Typography variant="subtitle1" fontWeight={700} mb={1}>
                  Əsas məlumatlar
                </Typography>

                <Typography>
                  <b>Qaimə nömrəsi:</b>{" "}
                  {formatInvoiceNumber(selectedOrder.orderNumber)}
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
            ) : (
              <Box>
                {editError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {editError}
                  </Alert>
                )}

                {editSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {editSuccess}
                  </Alert>
                )}

                <Stack spacing={3}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>
                      Edit məlumatları
                    </Typography>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <TextField
                        select
                        label="Ödəniş növü"
                        value={editForm.paymentType}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            paymentType: e.target.value,
                          }))
                        }
                        fullWidth
                      >
                        {EDIT_PAYMENT_OPTIONS.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Qeyd"
                        value={editForm.note}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        fullWidth
                        multiline
                        minRows={2}
                      />
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>
                      Məhsul əlavə et
                    </Typography>

                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      mb={2}
                    >
                      <TextField
                        select
                        label="Kateqoriya"
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Hamısı</MenuItem>
                        {productCategories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.name}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Məhsul axtar"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        fullWidth
                      />

                      <TextField
                        select
                        label="Məhsul seç"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Seçin</MenuItem>
                        {catalogProducts.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name}
                            {typeof product.stock?.quantity === "number"
                              ? ` (stok: ${product.stock.quantity})`
                              : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        variant="contained"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() => handleAddProductToEdit(false)}
                        disabled={!selectedProductId}
                      >
                        Normal məhsul əlavə et
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() => handleAddProductToEdit(true)}
                        disabled={!selectedProductId}
                      >
                        Hədiyyə məhsul əlavə et
                      </Button>
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      mb={2}
                    >
                      <Chip
                        label={`Normal məhsul sayı: ${getItemCount(
                          editNormalItems,
                        )}`}
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label={`Hədiyyə məhsul sayı: ${getItemCount(
                          editGiftItems,
                        )}`}
                        color="secondary"
                        variant="outlined"
                      />
                      <Chip
                        label={`Toplam satış: ${formatMoney(editTotal)}`}
                        color="success"
                        variant="outlined"
                      />
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                      Normal məhsullar
                    </Typography>

                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ mb: 3 }}
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
                            <TableCell>Stok</TableCell>
                            <TableCell>Miqdar</TableCell>
                            <TableCell>Qiymət</TableCell>
                            <TableCell>Cəm</TableCell>
                            <TableCell>Sil</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {editNormalItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7}>
                                Normal məhsul yoxdur
                              </TableCell>
                            </TableRow>
                          ) : (
                            editNormalItems.map((item) => (
                              <TableRow key={item.localKey}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell>
                                  {item.stockQuantity ?? "-"}
                                </TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateEditItem(item.localKey, {
                                        quantity: Number(e.target.value),
                                      })
                                    }
                                    fullWidth
                                    inputProps={{ min: 1 }}
                                  />
                                </TableCell>
                                <TableCell sx={{ minWidth: 140 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={item.unitPrice}
                                    onChange={(e) =>
                                      updateEditItem(item.localKey, {
                                        unitPrice: Number(e.target.value),
                                      })
                                    }
                                    fullWidth
                                    inputProps={{ min: 0, step: "0.01" }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {formatMoney(
                                    Number(item.quantity || 0) *
                                      Number(item.unitPrice || 0),
                                  )}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    color="error"
                                    onClick={() =>
                                      removeEditItem(item.localKey)
                                    }
                                  >
                                    <DeleteOutlineOutlinedIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

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
                            <TableCell>Stok</TableCell>
                            <TableCell>Miqdar</TableCell>
                            <TableCell>Qiymət</TableCell>
                            <TableCell>Sil</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {editGiftItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6}>
                                Hədiyyə məhsul yoxdur
                              </TableCell>
                            </TableRow>
                          ) : (
                            editGiftItems.map((item) => (
                              <TableRow key={item.localKey}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell>
                                  {item.stockQuantity ?? "-"}
                                </TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateEditItem(item.localKey, {
                                        quantity: Number(e.target.value),
                                      })
                                    }
                                    fullWidth
                                    inputProps={{ min: 1 }}
                                  />
                                </TableCell>
                                <TableCell>0.00 ₼</TableCell>
                                <TableCell>
                                  <IconButton
                                    color="error"
                                    onClick={() =>
                                      removeEditItem(item.localKey)
                                    }
                                  >
                                    <DeleteOutlineOutlinedIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Stack>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      )}

      {canViewOrderDetail && (
        <Dialog
          open={printPreviewOpen}
          onClose={() => {
            setPrintPreviewOpen(false);
            setPrintOrder(null);
          }}
          fullWidth
          fullScreen={window.innerWidth < 700}
          maxWidth="lg"
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

          <DialogContent dividers sx={{ bgcolor: "#eef2f7" }}>
            {!printOrder ? (
              <Typography>Məlumat tapılmadı</Typography>
            ) : (
              <Box
                id="print-area"
                sx={{
                  width: "100%",
                  maxWidth: { xs: "100%", md: "210mm" },
                  minHeight: { xs: "auto", md: "297mm" },
                  mx: "auto",
                  bgcolor: "#fff",
                  color: "#111827",
                  p: { xs: 1.5, sm: 2, md: 4 },
                  borderRadius: { xs: 0, md: 2 },
                  boxShadow: {
                    xs: "none",
                    md: "0 10px 30px rgba(15, 23, 42, 0.08)",
                  },
                }}
              >
                <Box
                  sx={{
                    border: "2px solid #111827",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      px: 3,
                      py: 2.5,
                      borderBottom: "2px solid #111827",
                      background:
                        "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={2}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontSize: { xs: 20, md: 28 },
                            fontWeight: 800,
                            letterSpacing: { xs: "0.01em", md: "0.04em" },
                            textTransform: "uppercase",
                            lineHeight: 1.2,
                          }}
                        >
                          Satış Qaiməsi
                        </Typography>

                        <Typography sx={{ mt: 0.5, color: "#475569" }}>
                          Sifariş üzrə satış sənədi
                        </Typography>
                      </Box>

                      <Box>
                        <Typography
                          fontWeight={700}
                          sx={{ fontSize: { xs: 13, md: 16 } }}
                        ></Typography>
                        <Stack spacing={0.75}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Typography fontWeight={700}>Qaimə №</Typography>
                            <Typography fontWeight={800}>
                              {formatInvoiceNumber(printOrder.orderNumber)}
                            </Typography>
                          </Stack>

                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Typography fontWeight={700}>Tarix</Typography>
                            <Typography>
                              {formatDate(printOrder.createdAt)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ p: 3 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      mb={3}
                    >
                      <Box
                        sx={{
                          flex: 1,
                          border: "1.5px solid #cbd5e1",
                          borderRadius: 1.5,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.25,
                            borderBottom: "1.5px solid #cbd5e1",
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          <Typography fontWeight={800}>
                            Müştəri məlumatı
                          </Typography>
                        </Box>

                        <Box sx={{ p: 2 }}>
                          <Stack spacing={1}>
                            <Typography>
                              <b>Ad:</b> {printOrder.customer?.name || "-"}
                            </Typography>
                            <Typography>
                              <b>Telefon:</b>{" "}
                              {printOrder.customer?.phone || "-"}
                            </Typography>
                            <Typography>
                              <b>Salon:</b> {printOrder.customer?.salon || "-"}
                            </Typography>
                            <Typography>
                              <b>Ünvan:</b>{" "}
                              {printOrder.customer?.address || "-"}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          flex: 1,
                          border: "1.5px solid #cbd5e1",
                          borderRadius: 1.5,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.25,
                            borderBottom: "1.5px solid #cbd5e1",
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          <Typography fontWeight={800}>
                            Sifariş məlumatı
                          </Typography>
                        </Box>

                        <Box sx={{ p: 2 }}>
                          <Stack spacing={1}>
                            <Typography>
                              <b>Ödəniş növü:</b>{" "}
                              {printOrder.paymentType || "-"}
                            </Typography>
                            <Typography>
                              <b>Ekspeditor:</b>{" "}
                              {printOrder.createdBy?.fullName ||
                                printOrder.createdBy?.email ||
                                "-"}
                            </Typography>
                            <Typography>
                              <b>Məhsul sayı:</b>{" "}
                              {getItemCount(printNormalItems)}
                            </Typography>
                            {printHasGiftItems && (
                              <Typography>
                                <b>Hədiyyə məhsul sayı:</b>{" "}
                                {getItemCount(printGiftItems)}
                              </Typography>
                            )}
                            <Typography>
                              <b>Qeyd:</b> {printOrder.note || "-"}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    </Stack>

                    <Typography
                      variant="h6"
                      fontWeight={800}
                      mb={1.25}
                      sx={{ letterSpacing: "0.01em" }}
                    >
                      Satılan məhsullar
                    </Typography>

                    <TableContainer
                      sx={{
                        mb: 3,
                        border: "1.5px solid #111827",
                        borderRadius: 1.5,
                        overflowX: "auto",
                        overflowY: "hidden",
                      }}
                    >
                      <Table
                        size="small"
                        sx={{
                          minWidth: 700,
                          "& th, & td": {
                            borderRight: "1px solid #111827",
                            borderBottom: "1px solid #111827",
                            verticalAlign: "middle",
                            p: 1.25,
                            whiteSpace: "nowrap",
                          },
                          "& th:last-child, & td:last-child": {
                            borderRight: "none",
                          },
                          "& tr:last-child td": {
                            borderBottom: "none",
                          },
                          "& th": {
                            backgroundColor: "#e2e8f0",
                            fontWeight: 800,
                            textAlign: "center",
                          },
                        }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 60 }}>№</TableCell>
                            <TableCell>Məhsul</TableCell>
                            <TableCell>Kateqoriya</TableCell>
                            <TableCell sx={{ width: 90 }}>Miqdar</TableCell>
                            <TableCell sx={{ width: 130 }}>
                              Vahid qiymət
                            </TableCell>
                            <TableCell sx={{ width: 130 }}>Cəm</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {printNormalItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} align="center">
                                Satılan məhsul yoxdur
                              </TableCell>
                            </TableRow>
                          ) : (
                            printNormalItems.map((item, index) => (
                              <TableRow key={item.id}>
                                <TableCell align="center">
                                  {index + 1}
                                </TableCell>
                                <TableCell
                                  sx={{ textAlign: "center", fontWeight: 500 }}
                                >
                                  {item.product?.name || "-"}
                                </TableCell>

                                <TableCell
                                  sx={{ textAlign: "center", color: "#475569" }}
                                >
                                  {item.product?.category?.name || "-"}
                                </TableCell>
                                <TableCell align="center">
                                  {item.quantity || 0}
                                </TableCell>
                                <TableCell sx={{ textAlign: "center" }}>
                                  {formatMoney(item.unitPrice)}
                                </TableCell>
                                <TableCell sx={{ textAlign: "center" }}>
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
                        <Typography
                          variant="h6"
                          fontWeight={800}
                          mb={1.25}
                          sx={{ letterSpacing: "0.01em" }}
                        >
                          Hədiyyə məhsullar
                        </Typography>

                        <TableContainer
                          sx={{
                            mb: 3,
                            border: "1.5px solid #111827",
                            borderRadius: 1.5,
                            overflow: "hidden",
                          }}
                        >
                          <Table
                            size="small"
                            sx={{
                              "& th, & td": {
                                borderRight: "1px solid #111827",
                                borderBottom: "1px solid #111827",
                                verticalAlign: "middle",
                                p: 1.25,
                              },
                              "& th:last-child, & td:last-child": {
                                borderRight: "none",
                              },
                              "& tr:last-child td": {
                                borderBottom: "none",
                              },
                              "& th": {
                                backgroundColor: "#f1f5f9",
                                fontWeight: 800,
                                textAlign: "center",
                              },
                            }}
                          >
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: 60 }} align="center">
                                  №
                                </TableCell>
                                <TableCell align="center">Məhsul</TableCell>
                                <TableCell align="center">Kateqoriya</TableCell>
                                <TableCell sx={{ width: 90 }} align="center">
                                  Miqdar
                                </TableCell>
                                <TableCell sx={{ width: 130 }} align="center">
                                  Vahid qiymət
                                </TableCell>
                                <TableCell sx={{ width: 130 }} align="center">
                                  Cəm
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {printNormalItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} align="center">
                                    Satılan məhsul yoxdur
                                  </TableCell>
                                </TableRow>
                              ) : (
                                printNormalItems.map((item, index) => (
                                  <TableRow key={item.id}>
                                    <TableCell align="center">
                                      {index + 1}
                                    </TableCell>
                                    <TableCell align="center">
                                      {item.product?.name || "-"}
                                    </TableCell>
                                    <TableCell align="center">
                                      {item.product?.category?.name || "-"}
                                    </TableCell>
                                    <TableCell align="center">
                                      {item.quantity || 0}
                                    </TableCell>
                                    <TableCell align="center">
                                      {formatMoney(item.unitPrice)}
                                    </TableCell>
                                    <TableCell align="center">
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
                      </>
                    )}

                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", md: "flex-end" }}
                      spacing={3}
                      mt={8}
                    >
                      <Box sx={{ minWidth: { md: 280 } }}>
                        <Typography variant="subtitle1" fontWeight={700} mb={1}>
                          Təhvil verən imzası
                        </Typography>

                        {printOrder.sellerSignature ? (
                          <Box>
                            <img
                              src={printOrder.sellerSignature}
                              alt="seller-signature"
                              style={{ width: 300, border: "1px solid #ccc" }}
                            />
                            <Typography fontSize={12}>
                              {formatDate(printOrder.sellerSignedAt)}
                            </Typography>
                          </Box>
                        ) : (
                          <SignaturePad
                            onSave={async (signature) => {
                              try {
                                const { data } = await api.post(
                                  `/orders/${printOrder.id}/seller-signature`,
                                  { signature },
                                );

                                setPrintOrder((prev) => ({
                                  ...prev,
                                  sellerSignature: data.order.sellerSignature,
                                  sellerSignedAt: data.order.sellerSignedAt,
                                }));
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          />
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle1" fontWeight={700} mb={1}>
                          Təhvil alan imzası
                        </Typography>

                        {selectedOrder.customerSignature ? (
                          <Box>
                            <img
                              src={selectedOrder.customerSignature}
                              alt="signature"
                              style={{ width: 300, border: "1px solid #ccc" }}
                            />
                            <Typography fontSize={12}>
                              {formatDate(selectedOrder.signedAt)}
                            </Typography>
                          </Box>
                        ) : (
                          <SignaturePad
                            onSave={async (signature) => {
                              try {
                                await api.post(
                                  `/orders/${selectedOrder.id}/signature`,
                                  {
                                    signature,
                                  },
                                );

                                fetchOrderDetail(selectedOrder.id);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          />
                        )}
                      </Box>

                      <Box
                        sx={{
                          minWidth: { xs: "100%", md: 340 },
                          border: "2px solid #111827",
                          borderRadius: 1.5,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.25,
                            borderBottom: "1px solid #111827",
                            backgroundColor: "#e2e8f0",
                          }}
                        >
                          <Typography fontWeight={800}>Yekun</Typography>
                        </Box>

                        <Box sx={{ p: 2 }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography fontWeight={800} fontSize={18}>
                              Toplam satış:
                            </Typography>
                            <Typography fontWeight={900} fontSize={20}>
                              {formatMoney(
                                getOrderTotal(printOrder.items || []),
                              )}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}
