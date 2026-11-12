import LedgerDialog from "../components/LedgerDialog";
import InvoiceDialog from "../components/InvoiceDialog";
import { amountValue } from "../lib/money-input.mjs";
import { formatDate as localeDate } from "../i18n/runtime";
import { useI18n } from "../i18n/useI18n";
import { formatMoney as localeMoney, t } from "../i18n/runtime";
import { RecordPager, ExportButton } from "../components/RecordsTools";
import { canUseFeature } from "../features/plans/access";
import { useAuth } from "../features/auth/useAuth";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { PageHeader, PageCard, DataTable, EmptyState, StatusBadge, RecordDate } from "../components/WorkspaceUI";
import { Box, Paper, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Pagination, Stack, Dialog, DialogTitle, DialogContent, CircularProgress, Divider, Link, Chip, IconButton, Alert } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SignaturePad from "../components/SignaturePad";
import { api } from "../lib/api";
const PAYMENT_OPTIONS = ["", "REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];
const EDIT_PAYMENT_OPTIONS = ["REALİZASİYA", "NAĞD", "HİSSƏLİ", "DİGƏR"];
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    bgcolor: "#fff"
  }
};
function paymentLabel(value) {
  return t({
    REALİZASİYA: "Realizasiya",
    NAĞD: t("Nağd"),
    HİSSƏLİ: t("Hissəli"),
    DİGƏR: t("Digər")
  }[value] || value || "—");
}
function formatMoney(value, currency) {
  return localeMoney(value, currency);
}
function formatInvoiceNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "00000";
  return String(num).padStart(5, "0");
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
  return order.items.map(item => ({
    localKey: item.id || `${item.productId}-${Math.random()}`,
    productId: item.productId,
    productName: item.product?.name || "-",
    categoryName: item.product?.category?.name || "-",
    quantity: Number(item.quantity || 0),
    unitPrice: amountValue(item.unitPrice || 0),
    isGift: Boolean(item.isGift),
    stockQuantity: typeof item.product?.stock?.quantity === "number" ? item.product.stock.quantity : null,
    returnedQty: Number(item.returnedQty || 0)
  }));
}
export default function SalesHistoryPage() {
  useI18n();
  const {
    user: currentUser
  } = useAuth();
  const canFilterExpeditor = canUseFeature(currentUser, "teamManagement") && ["ADMIN", "DRIVER", "WAREHOUSE"].includes(currentUser?.role);
  const canViewOrderDetail = currentUser?.role === "ADMIN" || currentUser?.role === "EXPEDITOR" || currentUser?.role === "WAREHOUSE" || currentUser?.role === "DRIVER";
  const canEditOrder = currentUser?.role === "ADMIN";
  const [collect, setCollect] = useState(false);
  const [orders, setOrders] = useState([]);
  const [expeditors, setExpeditors] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState({
    search: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    expeditorId: ""
  });
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    expeditorId: ""
  });
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
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
    items: []
  });
  const [productCategories, setProductCategories] = useState([]);
  const [catalogPagination, setCatalogPagination] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const fetchOrders = async (page = 1, customFilters = appliedFilters) => {
    try {
      setLoading(true);
      setListError("");
      const params = {
        page,
        limit: pagination.limit
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
      const {
        data
      } = await api.get("/orders", {
        params
      });
      setOrders(data.orders || []);
      setPagination(prev => ({
        ...prev,
        page: data.pagination?.page || 1,
        limit: data.pagination?.limit || 10,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1
      }));
    } catch (error) {
      console.error("Fetch orders error:", error);
      setListError(error?.response?.data?.message || t("Satışlar yüklənmədi. Yenidən cəhd et."));
    } finally {
      setLoading(false);
    }
  };
  const fetchExpeditors = async () => {
    if (!canFilterExpeditor) return;
    try {
      const {
        data
      } = await api.get("/users", {
        params: {
          role: "EXPEDITOR"
        }
      });
      setExpeditors(data.users || []);
    } catch (error) {
      console.error("Fetch expeditors error:", error);
      setExpeditors([]);
    }
  };
  const fetchOrderDetail = async id => {
    if (!canViewOrderDetail) return;
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setIsEditMode(false);
      setEditError("");
      setEditSuccess("");
      const {
        data
      } = await api.get(`/orders/${id}`);
      const order = data.order || null;
      setSelectedOrder(order);
      if (order) {
        setEditForm({
          paymentType: order.paymentType || "NAĞD",
          note: order.note || "",
          items: buildEditItemsFromOrder(order)
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
      const {
        data
      } = await api.get("/catalog/categories");
      setProductCategories(normalizeCategoryListResponse(data));
    } catch (error) {
      console.error("Fetch categories error:", error);
      setProductCategories([]);
    }
  };
  const fetchProducts = async (searchValue = productSearch, categoryIdValue = selectedCategoryId, catalogPage = 1) => {
    try {
      const params = {};
      if (searchValue?.trim()) params.search = searchValue.trim();
      if (categoryIdValue) params.categoryId = categoryIdValue;
      const {
        data
      } = await api.get("/catalog/products", {
        params: {
          ...params,
          limit: 25,
          page: catalogPage
        }
      });
      setCatalogProducts(normalizeProductListResponse(data));
      setCatalogPagination(data.pagination);
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
          ...filters
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
      expeditorId: ""
    };
    setFilters(reset);
    setAppliedFilters(reset);
    fetchOrders(1, reset);
  };
  const handlePageChange = (_, value) => {
    fetchOrders(value, appliedFilters);
  };
  const formatDate = value => {
    if (!value) return "-";
    return localeDate(new Date(value), true);
  };
  const getItemCount = items => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };
  function hasReturnedItems(items) {
    if (!Array.isArray(items)) return false;
    return items.some(item => Number(item.returnedQty || 0) > 0);
  }
  const getOrderTotal = items => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      if (item.isGift) return sum;
      const qty = Number(item.quantity || 0);
      const price = amountValue(item.unitPrice || 0);
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
  const normalItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items.filter(item => !item.isGift);
  }, [selectedOrder]);
  const giftItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items.filter(item => item.isGift);
  }, [selectedOrder]);
  const hasGiftItems = giftItems.length > 0;
  const editNormalItems = useMemo(() => {
    return editForm.items.filter(item => !item.isGift);
  }, [editForm.items]);
  const editGiftItems = useMemo(() => {
    return editForm.items.filter(item => item.isGift);
  }, [editForm.items]);
  const editTotal = useMemo(() => {
    return getOrderTotal(editForm.items);
  }, [editForm.items]);
  function openPrintPreview(order) {
    if (!order) return;
    setPrintOrder(order);
    setPrintPreviewOpen(true);
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
      items: []
    });
  }
  function enterEditMode() {
    if (!selectedOrder) return;
    setEditForm({
      paymentType: selectedOrder.paymentType || "NAĞD",
      note: selectedOrder.note || "",
      items: buildEditItemsFromOrder(selectedOrder)
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
      items: buildEditItemsFromOrder(selectedOrder)
    });
    setEditError("");
    setEditSuccess("");
    setIsEditMode(false);
  }
  function updateEditItem(localKey, patch) {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.localKey === localKey ? {
        ...item,
        ...patch
      } : item)
    }));
  }
  function removeEditItem(localKey) {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.localKey !== localKey)
    }));
  }
  function handleAddProductToEdit(isGift = false) {
    if (!selectedProductId) return;
    const product = catalogProducts.find(p => p.id === selectedProductId);
    if (!product) return;
    setEditForm(prev => {
      const existingIndex = prev.items.findIndex(item => item.productId === product.id && item.isGift === isGift);
      if (existingIndex !== -1) {
        return {
          ...prev,
          items: prev.items.map((item, index) => index === existingIndex ? {
            ...item,
            quantity: Number(item.quantity || 0) + 1
          } : item)
        };
      }
      return {
        ...prev,
        items: [...prev.items, {
          localKey: `new-${product.id}-${Date.now()}-${Math.random()}`,
          productId: product.id,
          productName: product.name || "-",
          categoryName: product.category?.name || "-",
          quantity: 1,
          unitPrice: isGift ? 0 : amountValue(product.salePrice || 0),
          isGift,
          stockQuantity: typeof product.stock?.quantity === "number" ? product.stock.quantity : null,
          returnedQty: 0
        }]
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
        setEditError(t("Ödəniş növü seçilməlidir"));
        return;
      }
      if (!Array.isArray(editForm.items) || editForm.items.length === 0) {
        setEditError(t("Ən azı 1 məhsul olmalıdır"));
        return;
      }
      const invalidItem = editForm.items.find(item => {
        const quantity = Number(item.quantity);
        const unitPrice = amountValue(item.unitPrice);
        if (!item.productId) return true;
        if (!Number.isInteger(quantity) || quantity <= 0) return true;
        if (item.isGift && unitPrice !== 0) return true;
        if (!item.isGift && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
          return true;
        }
        return false;
      });
      if (invalidItem) {
        setEditError(t("Məhsul məlumatlarında problem var"));
        return;
      }
      const payload = {
        paymentType: editForm.paymentType,
        note: editForm.note,
        items: editForm.items.map(item => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: amountValue(item.isGift ? 0 : item.unitPrice),
          isGift: Boolean(item.isGift)
        }))
      };
      await api.put(`/orders/${selectedOrder.id}`, payload);
      const {
        data
      } = await api.get(`/orders/${selectedOrder.id}`);
      const freshOrder = data.order || null;
      setSelectedOrder(freshOrder);
      if (freshOrder) {
        setEditForm({
          paymentType: freshOrder.paymentType || "NAĞD",
          note: freshOrder.note || "",
          items: buildEditItemsFromOrder(freshOrder)
        });
      }
      await fetchOrders(pagination.page, appliedFilters);
      setEditSuccess(t("Sifariş uğurla yeniləndi"));
      setIsEditMode(false);
    } catch (error) {
      console.error("Update order error:", error);
      setEditError(error?.response?.data?.message || t("Sifariş yenilənə bilmədi"));
    } finally {
      setEditSaving(false);
    }
  }
  return <Box sx={{
    minHeight: "calc(100dvh - 64px)",
    bgcolor: "background.default",
    px: {
      xs: 2,
      sm: 3,
      lg: 3.5
    },
    py: {
      xs: 3,
      md: 3.5
    },
    maxWidth: 1600,
    mx: "auto"
  }}>


      <Box>
        <PageHeader title={t("Satış tarixçəsi")} description={t("Qaimələr, məhsullar və satış məlumatları.")} actions={<>
              {currentUser?.role === "ADMIN" && <ExportButton kind="sales" />}
              <Button variant="outlined" disabled={loading} onClick={() => fetchOrders(pagination.page, appliedFilters)} startIcon={<RefreshRoundedIcon sx={{
          fontSize: 18
        }} />}>{t("Yenilə")}</Button>
              {["ADMIN", "EXPEDITOR"].includes(currentUser?.role) && <Button component={RouterLink} to="/exp/sales" variant="contained" startIcon={<AddOutlinedIcon sx={{
          fontSize: 18
        }} />}>{t("Yeni satış")}</Button>}
            </>} />
        <PageCard component="form" onSubmit={event => {
        event.preventDefault();
        handleSearch();
      }} sx={{
        p: 2,
        mb: 2.5
      }}>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1.5} alignItems="center">
            <TextField label={t("Axtarış")} placeholder={t("Ad, telefon və ya salon")} value={filters.search} onChange={event => setFilters(prev => ({
            ...prev,
            search: event.target.value
          }))} InputProps={{
            startAdornment: <SearchRoundedIcon sx={{
              mr: 1,
              fontSize: 18,
              color: "text.secondary"
            }} />
          }} sx={{
            ...fieldSx,
            flex: "1 1 220px",
            minWidth: 0
          }} />
            <TextField select label={t("Ödəniş növü")} value={filters.paymentType} onChange={event => setFilters(prev => ({
            ...prev,
            paymentType: event.target.value
          }))} sx={{
            ...fieldSx,
            width: {
              xs: "100%",
              sm: 150
            }
          }}>
              {PAYMENT_OPTIONS.map(value => <MenuItem key={value || "all"} value={value}>
                  {value ? paymentLabel(value) : t("Hamısı")}
                </MenuItem>)}
            </TextField>
            {canFilterExpeditor && <TextField select label={t("Ekspeditor")} value={filters.expeditorId} onChange={event => setFilters(prev => ({
            ...prev,
            expeditorId: event.target.value
          }))} sx={{
            ...fieldSx,
            width: {
              xs: "100%",
              sm: 175
            }
          }}>
                <MenuItem value="">{t("Hamısı")}</MenuItem>
                {expeditors.map(person => <MenuItem key={person.id} value={person.id}>
                    {person.fullName || person.email}
                  </MenuItem>)}
              </TextField>}
            <TextField label={t("Başlanğıc tarix")} type="date" value={filters.startDate} onChange={event => setFilters(prev => ({
            ...prev,
            startDate: event.target.value
          }))} InputLabelProps={{
            shrink: true
          }} sx={{
            ...fieldSx,
            width: {
              xs: "100%",
              sm: 155
            }
          }} />
            <TextField label={t("Son tarix")} type="date" value={filters.endDate} onChange={event => setFilters(prev => ({
            ...prev,
            endDate: event.target.value
          }))} InputLabelProps={{
            shrink: true
          }} sx={{
            ...fieldSx,
            width: {
              xs: "100%",
              sm: 155
            }
          }} />
            <Stack direction="row" spacing={0.5}>
              <Button type="submit" variant="contained" disabled={loading} startIcon={<SearchRoundedIcon sx={{
              fontSize: 17
            }} />}>{t("Axtar")}</Button>
              <Button type="button" color="inherit" onClick={handleReset} sx={{
              color: "text.secondary"
            }}>{t("Sıfırla")}</Button>
            </Stack>
          </Stack>
        </PageCard>

        {listError && <Alert severity="error" sx={{
        mb: 2
      }}>
            {listError}
          </Alert>}
        <PageCard>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{
          px: 2,
          py: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}>
            <Typography component="h2" sx={{
            fontSize: 14,
            fontWeight: 500
          }}>{t("Satış siyahısı")}</Typography>
            <Typography sx={{
            fontSize: 11.5,
            color: "text.secondary"
          }}>
              {loading ? t("Yüklənir…") : listError ? t("Yüklənmə alınmadı") : pagination.total + " nəticə"}
            </Typography>
          </Stack>
          {loading ? <Box role="status" aria-label={t("Satışlar yüklənir")} sx={{
          py: 7,
          textAlign: "center"
        }}>
              <CircularProgress size={24} />
            </Box> : listError ? <EmptyState title={t("Satışlar yüklənmədi")} description={t("Yenilə düyməsi ilə təkrar yoxla.")} /> : orders.length === 0 ? <EmptyState title={t("Satış tapılmadı")} description={t("Axtarış sözünü və tarix aralığını dəyişərək yoxla.")} /> : <DataTable minWidth={canFilterExpeditor ? 1000 : 850} label={t("Satış tarixçəsi")}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("Qaimə / tarix")}</TableCell>
                  <TableCell>{t("Müştəri / salon")}</TableCell>
                  <TableCell>{t("Əlaqə / ünvan")}</TableCell>
                  <TableCell>{t("Ödəniş növü")}</TableCell>
                  <TableCell align="right">{t("Say")}</TableCell>
                  <TableCell align="right">{t("Məbləğ")}</TableCell>
                  {canFilterExpeditor && <TableCell>{t("Əməkdaş")}</TableCell>}
                  {canViewOrderDetail && <TableCell align="right">{t("Ətraflı")}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map(order => <TableRow key={order.id} hover>
                    <TableCell sx={{
                whiteSpace: "nowrap"
              }}>
                      <Typography sx={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  mb: 0.45
                }}>
                        #
                        {order.invoiceNumber || formatInvoiceNumber(order.orderNumber)}
                      </Typography>
                      <RecordDate value={order.createdAt} />
                      {hasReturnedItems(order.items) && <Box sx={{
                  mt: 0.65
                }}>
                          <StatusBadge tone="warning" label={t("Qaytarma var")} />
                        </Box>}
                    </TableCell>
                    <TableCell sx={{
                maxWidth: 240
              }}>
                      {["ADMIN", "EXPEDITOR"].includes(currentUser?.role) && order.customer?.id ? <Link component={RouterLink} to={"/exp/customers/" + order.customer.id} color="text.primary" underline="hover" sx={{
                  fontWeight: 500,
                  overflowWrap: "anywhere"
                }}>
                          {order.customer.name || t("Adsız müştəri")}
                        </Link> : <Typography sx={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  overflowWrap: "anywhere"
                }}>
                          {order.customer?.name || "—"}
                        </Typography>}
                      <Typography sx={{
                  fontSize: 11.5,
                  color: "text.secondary",
                  mt: 0.35,
                  overflowWrap: "anywhere"
                }}>
                        {order.customer?.salon || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{
                maxWidth: 230
              }}>
                      <Typography sx={{
                  fontSize: 12,
                  whiteSpace: "nowrap"
                }}>
                        {order.customer?.phone || "—"}
                      </Typography>
                      <Typography sx={{
                  fontSize: 11,
                  color: "text.secondary",
                  mt: 0.35,
                  overflowWrap: "anywhere"
                }}>
                        {order.customer?.address || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={paymentLabel(order.paymentType)} />
                    </TableCell>
                    <TableCell align="right">
                      {getItemCount(order.items)}
                    </TableCell>
                    <TableCell align="right" sx={{
                whiteSpace: "nowrap",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums"
              }}>
                      {formatMoney(getOrderTotal(order.items))}
                    </TableCell>
                    {canFilterExpeditor && <TableCell>
                        {order.createdBy?.fullName || order.createdBy?.email || "—"}
                      </TableCell>}
                    {canViewOrderDetail && <TableCell align="right">
                        <Button size="small" onClick={() => fetchOrderDetail(order.id)} aria-label={t("View invoice: {number}", {
                  number: order.invoiceNumber || formatInvoiceNumber(order.orderNumber)
                })} sx={{
                  minWidth: 0,
                  fontSize: 12
                }}>{t("Bax")}</Button>
                      </TableCell>}
                  </TableRow>)}
              </TableBody>
            </DataTable>}
          {!loading && !listError && orders.length > 0 && <Stack direction={{
          xs: "column",
          sm: "row"
        }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider"
        }}>
              <Typography sx={{
            fontSize: 11.5,
            color: "text.secondary"
          }}>{t("Səhifə")}{pagination.page} / {pagination.totalPages || 1}
              </Typography>
              <Pagination size="small" page={pagination.page} count={pagination.totalPages || 1} onChange={handlePageChange} color="primary" />
            </Stack>}
        </PageCard>
      </Box>

      {canViewOrderDetail && <Dialog open={detailOpen} PaperProps={{
      sx: {
        borderRadius: "12px"
      }
    }} onClose={handleCloseDetail} fullWidth maxWidth="lg">
          <DialogTitle>
            <Stack direction={{
          xs: "column",
          sm: "row"
        }} justifyContent="space-between" alignItems={{
          xs: "stretch",
          sm: "center"
        }} spacing={1}>
              <Typography component="span" variant="h6" fontWeight={600}>
                {isEditMode ? t("Sifariş redaktəsi") : t("Sifariş detalları")}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {!isEditMode && !!selectedOrder && !detailLoading && <>
                    {["ADMIN", "EXPEDITOR"].includes(currentUser?.role) && selectedOrder.remainingDebt > 0 && <Button variant="contained" onClick={() => setCollect(true)}>{t("Record payment")}</Button>}
                    {canEditOrder && <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={enterEditMode} sx={{
                textTransform: "none",
                fontWeight: 700
              }}>{t("Düzəliş et")}</Button>}

                    <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => openPrintPreview(selectedOrder)} sx={{
                textTransform: "none",
                fontWeight: 700
              }}>{t("Çap et")}</Button>
                  </>}

                {isEditMode && <>
                    <Button variant="outlined" color="inherit" startIcon={<CloseOutlinedIcon />} onClick={cancelEditMode} disabled={editSaving} sx={{
                textTransform: "none",
                fontWeight: 700
              }}>{t("Ləğv et")}</Button>

                    <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSaveEdit} disabled={editSaving} sx={{
                textTransform: "none",
                fontWeight: 700
              }}>
                      {editSaving ? t("Yadda saxlanılır...") : "Yadda saxla"}
                    </Button>
                  </>}
                <IconButton size="small" aria-label={t("Sifariş detallarını bağla")} onClick={handleCloseDetail} disabled={editSaving}>
                  <CloseOutlinedIcon sx={{
                fontSize: 20
              }} />
                </IconButton>
              </Stack>
            </Stack>
          </DialogTitle>

          <DialogContent dividers sx={{
        maxHeight: "80vh"
      }}>
            {detailLoading ? <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box> : !selectedOrder ? <Typography>{t("Məlumat tapılmadı")}</Typography> : !isEditMode ? <Box>
                {editSuccess && <Alert severity="success" sx={{
            mb: 2
          }}>
                    {editSuccess}
                  </Alert>}

                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{
            mb: 2
          }}><Typography>{t("Paid")}: {formatMoney(selectedOrder.allocatedPayment)}</Typography><Typography fontWeight={600}>{t("Outstanding")}: {formatMoney(selectedOrder.remainingDebt)}</Typography></Stack>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Əsas məlumatlar")}</Typography>

                <Typography>
                  <b>{t("Qaimə nömrəsi:")}</b>{" "}
                  {selectedOrder.invoiceNumber || formatInvoiceNumber(selectedOrder.orderNumber)}
                </Typography>
                <Typography>
                  <b>{t("Tarix:")}</b> {formatDate(selectedOrder.createdAt)}
                </Typography>
                <Typography>
                  <b>{t("Ödəniş növü:")}</b> {selectedOrder.paymentType || "-"}
                </Typography>
                <Typography>
                  <b>{t("Qeyd:")}</b> {selectedOrder.note || "-"}
                </Typography>

                <Divider sx={{
            my: 2
          }} />

                <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Müştəri")}</Typography>

                <Typography>
                  <b>{t("Ad:")}</b> {selectedOrder.customer?.name || "-"}
                </Typography>
                <Typography>
                  <b>{t("Telefon:")}</b> {selectedOrder.customer?.phone || "-"}
                </Typography>
                <Typography>
                  <b>{t("Salon:")}</b> {selectedOrder.customer?.salon || "-"}
                </Typography>
                <Typography>
                  <b>{t("Ünvan:")}</b> {selectedOrder.customer?.address || "-"}
                </Typography>

                {typeof selectedOrder.customer?.lat === "number" && typeof selectedOrder.customer?.lng === "number" && <>
                      <Typography>
                        <Link href={getGoogleMapsLink(selectedOrder.customer.lat, selectedOrder.customer.lng)} target="_blank" rel="noreferrer" underline="hover">{t("Google Maps-də aç")}</Link>
                      </Typography>
                      <Typography>
                        <Link href={getWazeLink(selectedOrder.customer.lat, selectedOrder.customer.lng)} target="_blank" rel="noreferrer" underline="hover">{t("Waze-də aç")}</Link>
                      </Typography>
                    </>}

                <Divider sx={{
            my: 2
          }} />

                <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Sifarişi yazan")}</Typography>

                <Typography>
                  <b>{t("Ad:")}</b>{" "}
                  {selectedOrder.createdBy?.fullName || selectedOrder.createdBy?.email || "-"}
                </Typography>
                <Typography>
                  <b>{t("Rol:")}</b> {selectedOrder.createdBy?.role || "-"}
                </Typography>

                <Divider sx={{
            my: 2
          }} />

                <Stack direction={{
            xs: "column",
            sm: "row"
          }} spacing={1} mb={1.5}>
                  <Chip label={t("Məhsul sayı: {value0}", {
              value0: getItemCount(normalItems)
            })} color="primary" variant="outlined" />

                  {hasGiftItems && <Chip label={t("Hədiyyə məhsul sayı: {value0}", {
              value0: getItemCount(giftItems)
            })} color="secondary" variant="outlined" />}

                  <Chip label={t("Toplam satış: {value0}", {
              value0: formatMoney(getOrderTotal(selectedOrder.items || []))
            })} color="success" variant="outlined" />
                </Stack>

                <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Satılan məhsullar")}</Typography>

                <TableContainer component={Paper} variant="outlined" sx={{
            mb: hasGiftItems ? 2 : 0
          }}>
                  <Table sx={{
              border: "1px solid rgba(224, 224, 224, 1)",
              "& th, & td": {
                border: "1px solid rgba(224, 224, 224, 1)",
                textAlign: "center",
                verticalAlign: "middle",
                padding: "10px"
              },
              "& th": {
                fontWeight: 700,
                backgroundColor: "#f5f5f5"
              }
            }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("Məhsul")}</TableCell>
                        <TableCell>{t("Kateqoriya")}</TableCell>
                        <TableCell>{t("Miqdar")}</TableCell>
                        <TableCell>{t("Qiymət")}</TableCell>
                        <TableCell>{t("Cəm")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {normalItems.length === 0 ? <TableRow>
                          <TableCell colSpan={5}>{t("Normal satış məhsulu yoxdur")}</TableCell>
                        </TableRow> : normalItems.map(item => <TableRow key={item.id}>
                            <TableCell>{item.product?.name || "-"}</TableCell>
                            <TableCell>
                              {item.product?.category?.name || "-"}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                            <TableCell>
                              {formatMoney(Number(item.quantity || 0) * amountValue(item.unitPrice || 0))}
                            </TableCell>
                          </TableRow>)}
                    </TableBody>
                  </Table>
                </TableContainer>

                {hasGiftItems && <>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Hədiyyə məhsullar")}</Typography>

                    <TableContainer component={Paper} variant="outlined">
                      <Table sx={{
                border: "1px solid rgba(224, 224, 224, 1)",
                "& th, & td": {
                  border: "1px solid rgba(224, 224, 224, 1)",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "10px"
                },
                "& th": {
                  fontWeight: 700,
                  backgroundColor: "#f5f5f5"
                }
              }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{t("Məhsul")}</TableCell>
                            <TableCell>{t("Kateqoriya")}</TableCell>
                            <TableCell>{t("Miqdar")}</TableCell>
                            <TableCell>{t("Qiymət")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {giftItems.map(item => <TableRow key={item.id}>
                              <TableCell>{item.product?.name || "-"}</TableCell>
                              <TableCell>
                                {item.product?.category?.name || "-"}
                              </TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{formatMoney(0)}</TableCell>
                            </TableRow>)}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>}
              </Box> : <Box>
                {editError && <Alert severity="error" sx={{
            mb: 2
          }}>
                    {editError}
                  </Alert>}

                {editSuccess && <Alert severity="success" sx={{
            mb: 2
          }}>
                    {editSuccess}
                  </Alert>}

                <Stack spacing={3}>
                  <Paper variant="outlined" sx={{
              p: 2
            }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>{t("Edit məlumatları")}</Typography>

                    <Stack direction={{
                xs: "column",
                md: "row"
              }} spacing={2}>
                      <TextField select label={t("Ödəniş növü")} value={editForm.paymentType} onChange={e => setEditForm(prev => ({
                  ...prev,
                  paymentType: e.target.value
                }))} fullWidth>
                        {EDIT_PAYMENT_OPTIONS.map(option => <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>)}
                      </TextField>

                      <TextField label={t("Qeyd")} value={editForm.note} onChange={e => setEditForm(prev => ({
                  ...prev,
                  note: e.target.value
                }))} fullWidth multiline minRows={2} />
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{
              p: 2
            }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>{t("Məhsul əlavə et")}</Typography>

                    <Stack direction={{
                xs: "column",
                md: "row"
              }} spacing={2} mb={2}>
                      <TextField select label={t("Kateqoriya")} value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} fullWidth>
                        <MenuItem value="">{t("Hamısı")}</MenuItem>
                        {productCategories.map(category => <MenuItem key={category.id} value={category.id}>
                            {category.name}
                          </MenuItem>)}
                      </TextField>

                      <TextField label={t("Məhsul axtar")} value={productSearch} onChange={e => setProductSearch(e.target.value)} fullWidth />

                      <TextField select label={t("Məhsul seç")} value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} fullWidth>
                        <MenuItem value="">{t("Seçin")}</MenuItem>
                        {catalogProducts.map(product => <MenuItem key={product.id} value={product.id}>
                            {product.name}
                            {typeof product.stock?.quantity === "number" ? ` (stok: ${product.stock.quantity})` : ""}
                          </MenuItem>)}
                      </TextField>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => handleAddProductToEdit(false)} disabled={!selectedProductId}>{t("Normal məhsul əlavə et")}</Button>

                      <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => handleAddProductToEdit(true)} disabled={!selectedProductId}>{t("Hədiyyə məhsul əlavə et")}</Button>
                    </Stack>
                    <RecordPager pagination={catalogPagination} onChange={page => fetchProducts(productSearch, selectedCategoryId, page)} />
                  </Paper>

                  <Paper variant="outlined" sx={{
              p: 2
            }}>
                    <Stack direction={{
                xs: "column",
                sm: "row"
              }} spacing={1} mb={2}>
                      <Chip label={t("Normal məhsul sayı: {value0}", {
                  value0: getItemCount(editNormalItems)
                })} color="primary" variant="outlined" />
                      <Chip label={t("Hədiyyə məhsul sayı: {value0}", {
                  value0: getItemCount(editGiftItems)
                })} color="secondary" variant="outlined" />
                      <Chip label={t("Toplam satış: {value0}", {
                  value0: formatMoney(editTotal)
                })} color="success" variant="outlined" />
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Normal məhsullar")}</Typography>

                    <TableContainer component={Paper} variant="outlined" sx={{
                mb: 3
              }}>
                      <Table sx={{
                  border: "1px solid rgba(224, 224, 224, 1)",
                  "& th, & td": {
                    border: "1px solid rgba(224, 224, 224, 1)",
                    textAlign: "center",
                    verticalAlign: "middle",
                    padding: "10px"
                  },
                  "& th": {
                    fontWeight: 700,
                    backgroundColor: "#f5f5f5"
                  }
                }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{t("Məhsul")}</TableCell>
                            <TableCell>{t("Kateqoriya")}</TableCell>
                            <TableCell>{t("Stok")}</TableCell>
                            <TableCell>{t("Miqdar")}</TableCell>
                            <TableCell>{t("Qiymət")}</TableCell>
                            <TableCell>{t("Cəm")}</TableCell>
                            <TableCell>{t("Sil")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {editNormalItems.length === 0 ? <TableRow>
                              <TableCell colSpan={7}>{t("Normal məhsul yoxdur")}</TableCell>
                            </TableRow> : editNormalItems.map(item => <TableRow key={item.localKey}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell>
                                  {item.stockQuantity ?? "-"}
                                </TableCell>
                                <TableCell sx={{
                        minWidth: 120
                      }}>
                                  <TextField type="number" size="small" value={item.quantity} onChange={e => updateEditItem(item.localKey, {
                          quantity: Number(e.target.value)
                        })} fullWidth inputProps={{
                          min: 1
                        }} />
                                </TableCell>
                                <TableCell sx={{
                        minWidth: 140
                      }}>
                                  <TextField type="number" size="small" value={item.unitPrice} onChange={e => updateEditItem(item.localKey, {
                          unitPrice: Number(e.target.value)
                        })} fullWidth inputProps={{
                          min: 0,
                          step: "0.01"
                        }} />
                                </TableCell>
                                <TableCell>
                                  {formatMoney(Number(item.quantity || 0) * amountValue(item.unitPrice || 0))}
                                </TableCell>
                                <TableCell>
                                  <IconButton color="error" onClick={() => removeEditItem(item.localKey)}>
                                    <DeleteOutlineOutlinedIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>)}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Typography variant="subtitle1" fontWeight={700} mb={1}>{t("Hədiyyə məhsullar")}</Typography>

                    <TableContainer component={Paper} variant="outlined">
                      <Table sx={{
                  border: "1px solid rgba(224, 224, 224, 1)",
                  "& th, & td": {
                    border: "1px solid rgba(224, 224, 224, 1)",
                    textAlign: "center",
                    verticalAlign: "middle",
                    padding: "10px"
                  },
                  "& th": {
                    fontWeight: 700,
                    backgroundColor: "#f5f5f5"
                  }
                }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{t("Məhsul")}</TableCell>
                            <TableCell>{t("Kateqoriya")}</TableCell>
                            <TableCell>{t("Stok")}</TableCell>
                            <TableCell>{t("Miqdar")}</TableCell>
                            <TableCell>{t("Qiymət")}</TableCell>
                            <TableCell>{t("Sil")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {editGiftItems.length === 0 ? <TableRow>
                              <TableCell colSpan={6}>{t("Hədiyyə məhsul yoxdur")}</TableCell>
                            </TableRow> : editGiftItems.map(item => <TableRow key={item.localKey}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell>
                                  {item.stockQuantity ?? "-"}
                                </TableCell>
                                <TableCell sx={{
                        minWidth: 120
                      }}>
                                  <TextField type="number" size="small" value={item.quantity} onChange={e => updateEditItem(item.localKey, {
                          quantity: Number(e.target.value)
                        })} fullWidth inputProps={{
                          min: 1
                        }} />
                                </TableCell>
                                <TableCell>{formatMoney(0)}</TableCell>
                                <TableCell>
                                  <IconButton color="error" onClick={() => removeEditItem(item.localKey)}>
                                    <DeleteOutlineOutlinedIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>)}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Stack>
              </Box>}
          </DialogContent>
        </Dialog>}

      {printPreviewOpen && printOrder && <InvoiceDialog order={printOrder} onClose={() => {
      setPrintPreviewOpen(false);
      setPrintOrder(null);
    }} />}
      {collect && selectedOrder && <LedgerDialog customer={selectedOrder.customer} order={selectedOrder} onClose={() => setCollect(false)} onSaved={() => {
      fetchOrderDetail(selectedOrder.id);
      fetchOrders(pagination.page, appliedFilters);
    }} />}

    </Box>;
}
