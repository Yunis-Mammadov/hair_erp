import { useEffect, useMemo, useState } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Button,
  Snackbar,
  Alert,
  Skeleton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchIcon from "@mui/icons-material/Search";
import InventoryIcon from "@mui/icons-material/Inventory";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { api } from "../lib/api";

function formatMoney(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)} ₼`;
}

export default function PurchasePage() {
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [productsByCat, setProductsByCat] = useState({});
  const [qty, setQty] = useState({});
  const [costs, setCosts] = useState({});
  const [salePrices, setSalePrices] = useState({});
  const [search, setSearch] = useState("");

  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [note, setNote] = useState("");

  const [errors, setErrors] = useState({
    supplier: "",
    invoiceNo: "",
  });

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "info", msg: "" });

  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openProductModal, setOpenProductModal] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState("");

  const [newProduct, setNewProduct] = useState({
    name: "",
    categoryId: "",
    salePrice: "",
  });

  const [newProductErrors, setNewProductErrors] = useState({
    name: "",
    categoryId: "",
    salePrice: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingCats(true);
        const list = await fetchCategories();
        if (!alive) return;

        const allClosed = {};
        for (const category of list) {
          allClosed[category.id] = false;
        }
        setExpanded(allClosed);
      } catch (e) {
        console.error(e);
        setToast({
          open: true,
          type: "error",
          msg: e?.response?.data?.message || "Kateqoriyalar yüklənmədi",
        });
      } finally {
        if (!alive) return;
        setLoadingCats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function fetchCategories() {
    const res = await api.get("/catalog/categories");
    const list = res.data?.categories ?? [];
    setCategories(list);
    return list;
  }

  async function ensureProductsLoaded(categoryId) {
    const existing = productsByCat[categoryId];
    if (existing?.loading || Array.isArray(existing?.items)) return;

    setProductsByCat((prev) => ({
      ...prev,
      [categoryId]: { loading: true, items: [] },
    }));

    try {
      const res = await api.get("/catalog/products", {
        params: { categoryId },
      });

      const items = res.data?.products ?? [];

      setProductsByCat((prev) => ({
        ...prev,
        [categoryId]: { loading: false, items },
      }));
    } catch (e) {
      console.error(e);
      setProductsByCat((prev) => ({
        ...prev,
        [categoryId]: { loading: false, items: [] },
      }));
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Məhsullar yüklənmədi",
      });
    }
  }

  async function refreshOpenCategoriesStock() {
    const openCatIds = Object.keys(expanded).filter((k) => expanded[k]);

    for (const catId of openCatIds) {
      setProductsByCat((prev) => ({
        ...prev,
        [catId]: { loading: true, items: prev[catId]?.items || [] },
      }));

      const pr = await api.get("/catalog/products", {
        params: { categoryId: catId },
      });

      setProductsByCat((prev) => ({
        ...prev,
        [catId]: { loading: false, items: pr.data?.products ?? [] },
      }));
    }
  }

  function toggleCategory(catId) {
    const currentlyOpen = !!expanded[catId];

    setExpanded((prev) => ({
      ...prev,
      [catId]: !currentlyOpen,
    }));

    if (!currentlyOpen) {
      ensureProductsLoaded(catId);
    }
  }

  function getDbStock(product) {
    return Number(product?.stockQty ?? product?.stock?.quantity ?? 0);
  }

  function getSelected(product) {
    return Number(qty[product.id] || 0);
  }

  function ensureDefaultSalePrice(product) {
    setSalePrices((prev) => {
      if (prev[product.id] !== undefined && prev[product.id] !== "") return prev;
      return { ...prev, [product.id]: String(Number(product?.salePrice || 0)) };
    });
  }

  function inc(product) {
    const cur = getSelected(product);
    setQty((prev) => ({ ...prev, [product.id]: cur + 1 }));
    ensureDefaultSalePrice(product);
  }

  function dec(product) {
    const cur = getSelected(product);
    const nextQty = Math.max(cur - 1, 0);

    setQty((prev) => ({ ...prev, [product.id]: nextQty }));

    if (nextQty === 0) {
      setCosts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });

      setSalePrices((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }
  }

  function handleCostChange(productId, value) {
    if (value === "") {
      setCosts((prev) => ({ ...prev, [productId]: "" }));
      return;
    }

    const normalized = value.replace(",", ".");
    const numberValue = Number(normalized);

    if (!Number.isFinite(numberValue) || numberValue < 0) return;

    setCosts((prev) => ({ ...prev, [productId]: normalized }));
  }

  function handleSalePriceChange(productId, value) {
    if (value === "") {
      setSalePrices((prev) => ({ ...prev, [productId]: "" }));
      return;
    }

    const normalized = value.replace(",", ".");
    const numberValue = Number(normalized);

    if (!Number.isFinite(numberValue) || numberValue < 0) return;

    setSalePrices((prev) => ({ ...prev, [productId]: normalized }));
  }

  function resetAll() {
    setQty({});
    setCosts({});
    setSalePrices({});
    setSupplier("");
    setInvoiceNo("");
    setNote("");
    setSearch("");
    setErrors({
      supplier: "",
      invoiceNo: "",
    });
    setToast({ open: true, type: "info", msg: "Bütün seçimlər sıfırlandı" });
  }

  const selectedItems = useMemo(() => {
    const all = new Map();

    for (const v of Object.values(productsByCat)) {
      for (const p of v?.items || []) {
        all.set(p.id, p);
      }
    }

    const items = [];
    let totalQty = 0;
    let totalAmount = 0;

    for (const [productId, q] of Object.entries(qty)) {
      const quantity = Number(q || 0);
      if (quantity <= 0) continue;

      const p = all.get(productId);
      const unitCost = Number(costs[productId] || 0);
      const salePrice = Number(salePrices[productId] || 0);
      const lineTotal = quantity * unitCost;

      items.push({
        productId,
        quantity,
        unitCost,
        salePrice,
        lineTotal,
        name: p?.name || `${productId.slice(0, 6)}…`,
        category: p?.category?.name || "—",
        currentSalePrice: Number(p?.salePrice || 0),
        stockQty: getDbStock(p),
      });

      totalQty += quantity;
      totalAmount += lineTotal;
    }

    items.sort(
      (a, b) =>
        (a.category || "").localeCompare(b.category || "") ||
        (a.name || "").localeCompare(b.name || ""),
    );

    return { items, totalQty, totalAmount };
  }, [qty, costs, salePrices, productsByCat]);

  const hasInvalidCost = useMemo(() => {
    if (selectedItems.items.length === 0) return false;
    return selectedItems.items.some(
      (item) => !Number.isFinite(item.unitCost) || item.unitCost <= 0,
    );
  }, [selectedItems]);

  const hasInvalidSalePrice = useMemo(() => {
    if (selectedItems.items.length === 0) return false;
    return selectedItems.items.some(
      (item) => !Number.isFinite(item.salePrice) || item.salePrice <= 0,
    );
  }, [selectedItems]);

  function validatePurchaseMeta() {
    const nextErrors = {
      supplier: "",
      invoiceNo: "",
    };

    if (!supplier.trim()) {
      nextErrors.supplier = "Supplier mütləqdir";
    }

    if (!invoiceNo.trim()) {
      nextErrors.invoiceNo = "Qaimə / Invoice No mütləqdir";
    }

    setErrors(nextErrors);
    return Object.values(nextErrors).every((x) => !x);
  }

  async function confirmPurchase() {
    if (selectedItems.totalQty <= 0) {
      setToast({ open: true, type: "info", msg: "Heç bir məhsul seçilməyib" });
      return;
    }

    const metaValid = validatePurchaseMeta();
    if (!metaValid) {
      setToast({
        open: true,
        type: "warning",
        msg: "Supplier və qaimə nömrəsi mütləqdir",
      });
      return;
    }

    if (hasInvalidCost) {
      setToast({
        open: true,
        type: "warning",
        msg: "Bütün seçilən məhsullara düzgün alış qiyməti yaz",
      });
      return;
    }

    if (hasInvalidSalePrice) {
      setToast({
        open: true,
        type: "warning",
        msg: "Bütün seçilən məhsullara düzgün satış qiyməti yaz",
      });
      return;
    }

    setBusy(true);

    try {
      const payload = {
        supplier: supplier.trim(),
        invoiceNo: invoiceNo.trim(),
        note: note.trim() || undefined,
        items: selectedItems.items.map((x) => ({
          productId: x.productId,
          quantity: x.quantity,
          unitCost: x.unitCost,
          salePrice: x.salePrice,
        })),
      };

      const res = await api.post("/purchases", payload);

      setToast({
        open: true,
        type: "success",
        msg: `Alış yazıldı: ${res.data?.purchase?.id?.slice(0, 8) || "OK"}…`,
      });

      await refreshOpenCategoriesStock();

      setQty({});
      setCosts({});
      setSalePrices({});
      setSupplier("");
      setInvoiceNo("");
      setNote("");
      setErrors({
        supplier: "",
        invoiceNo: "",
      });
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || e.message || "Alış yazılmadı",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      setNewCategoryError("Category adı mütləqdir");
      return;
    }

    try {
      await api.post("/catalog/admin/categories", { name });

      const list = await fetchCategories();
      const allClosed = {};
      for (const category of list) {
        allClosed[category.id] = expanded[category.id] || false;
      }
      setExpanded(allClosed);

      setNewCategoryName("");
      setNewCategoryError("");
      setOpenCategoryModal(false);

      setToast({
        open: true,
        type: "success",
        msg: "Yeni category yaradıldı",
      });
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Category yaradılmadı",
      });
    }
  }

  function validateNewProduct() {
    const nextErrors = {
      name: "",
      categoryId: "",
      salePrice: "",
    };

    if (!newProduct.name.trim()) {
      nextErrors.name = "Məhsul adı mütləqdir";
    }

    if (!newProduct.categoryId) {
      nextErrors.categoryId = "Category seçilməlidir";
    }

    const parsedSalePrice = Number(newProduct.salePrice || 0);
    if (!Number.isFinite(parsedSalePrice) || parsedSalePrice < 0) {
      nextErrors.salePrice = "Satış qiyməti düzgün olmalıdır";
    }

    setNewProductErrors(nextErrors);
    return Object.values(nextErrors).every((x) => !x);
  }

  async function handleCreateProduct() {
    const valid = validateNewProduct();
    if (!valid) return;

    try {
      const salePrice = Number(newProduct.salePrice || 0);

      await api.post("/catalog/admin/products", {
        name: newProduct.name.trim(),
        categoryId: newProduct.categoryId,
        salePrice,
      });

      setExpanded((prev) => ({
        ...prev,
        [newProduct.categoryId]: true,
      }));

      setProductsByCat((prev) => {
        const next = { ...prev };
        delete next[newProduct.categoryId];
        return next;
      });

      await ensureProductsLoaded(newProduct.categoryId);
      await refreshOpenCategoriesStock();

      setNewProduct({
        name: "",
        categoryId: "",
        salePrice: "",
      });

      setNewProductErrors({
        name: "",
        categoryId: "",
        salePrice: "",
      });

      setOpenProductModal(false);

      setToast({
        open: true,
        type: "success",
        msg: "Yeni məhsul yaradıldı",
      });
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Məhsul yaradılmadı",
      });
    }
  }

  const totalCategories = categories.length;
  const totalSelectedProducts = selectedItems.items.length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: "auto", bgcolor: "#f8fafc", minHeight: "100vh" }}>
      <Card
        sx={{
          borderRadius: 5,
          mb: 2.5,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 12px 35px rgba(15,23,42,0.06)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 60%, rgba(241,245,249,1) 100%)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={2.5}
            justifyContent="space-between"
            alignItems={{ xl: "center" }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AutoAwesomeIcon />
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.8 }}>
                  Alış
                </Typography>
              </Stack>

              <Typography sx={{ opacity: 0.78, maxWidth: 760 }}>
                Məhsulları rahat seç, alış qiyməti və satış qiymətini yaz, sonra bir kliklə alış sənədini yarat.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<CategoryOutlinedIcon />}
                label={`Kateqoriya: ${totalCategories}`}
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
              <Chip
                icon={<ShoppingBagOutlinedIcon />}
                label={`Seçilən məhsul: ${totalSelectedProducts}`}
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
              <Chip
                icon={<InventoryIcon />}
                label={`${selectedItems.totalQty} ədəd`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 800, borderRadius: 999 }}
              />
              <Chip
                icon={<PaidOutlinedIcon />}
                label={formatMoney(selectedItems.totalAmount)}
                color="success"
                sx={{ fontWeight: 900, borderRadius: 999 }}
              />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2.2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 1.5,
            }}
          >
            <TextField
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                if (errors.supplier) {
                  setErrors((prev) => ({ ...prev, supplier: "" }));
                }
              }}
              label="Supplier"
              error={!!errors.supplier}
              helperText={errors.supplier}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocalShippingOutlinedIcon sx={{ opacity: 0.7 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              value={invoiceNo}
              onChange={(e) => {
                setInvoiceNo(e.target.value);
                if (errors.invoiceNo) {
                  setErrors((prev) => ({ ...prev, invoiceNo: "" }));
                }
              }}
              label="Qaimə / Invoice No"
              error={!!errors.invoiceNo}
              helperText={errors.invoiceNo}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ReceiptLongOutlinedIcon sx={{ opacity: 0.7 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              value={note}
              onChange={(e) => setNote(e.target.value)}
              label="Qeyd"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NotesOutlinedIcon sx={{ opacity: 0.7 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            sx={{ mt: 2 }}
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant="outlined"
              startIcon={<CategoryOutlinedIcon />}
              onClick={() => setOpenCategoryModal(true)}
              sx={{ borderRadius: 3, textTransform: "none", fontWeight: 800 }}
            >
              Yeni category
            </Button>

            <Button
              variant="outlined"
              startIcon={<Inventory2OutlinedIcon />}
              onClick={() => setOpenProductModal(true)}
              sx={{ borderRadius: 3, textTransform: "none", fontWeight: 800 }}
            >
              Yeni məhsul
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestartAltIcon />}
              onClick={resetAll}
              sx={{ borderRadius: 3, textTransform: "none", fontWeight: 800 }}
            >
              Sıfırla
            </Button>

            <Box sx={{ flex: 1 }} />

            <Button
              variant="contained"
              startIcon={<DoneAllIcon />}
              disabled={
                busy ||
                selectedItems.totalQty <= 0 ||
                hasInvalidCost ||
                hasInvalidSalePrice ||
                !supplier.trim() ||
                !invoiceNo.trim()
              }
              onClick={confirmPurchase}
              sx={{
                borderRadius: 3,
                textTransform: "none",
                fontWeight: 900,
                px: 3,
              }}
            >
              {busy ? "Yazılır..." : "Alışı təsdiqlə"}
            </Button>
          </Stack>

          <Typography sx={{ mt: 1.2, fontSize: 12, opacity: 0.72 }}>
            * Supplier, qaimə nömrəsi, məhsul sayı, alış qiyməti və satış qiyməti mütləqdir.
          </Typography>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "520px 1fr" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Card
          sx={{
            borderRadius: 5,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
            position: { xl: "sticky" },
            top: { xl: 24 },
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Kateqoriyalar və məhsullar
              </Typography>

              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Məhsul və ya category axtar..."
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ opacity: 0.7 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {loadingCats ? (
                <Stack spacing={1}>
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                </Stack>
              ) : categories.length === 0 ? (
                <Alert severity="info">Kateqoriya yoxdur.</Alert>
              ) : (
                <Stack spacing={1}>
                  {categories
                    .filter((category) => {
                      const categoryName = category.name?.toLowerCase() || "";
                      const q = search.trim().toLowerCase();

                      if (!q) return true;
                      if (categoryName.includes(q)) return true;

                      const items = productsByCat[category.id]?.items || [];
                      return items.some((p) =>
                        (p.name || "").toLowerCase().includes(q),
                      );
                    })
                    .map((category) => {
                      const open = !!expanded[category.id];
                      const block = productsByCat[category.id];
                      const loading = !!block?.loading;
                      const items = block?.items || [];

                      const visibleItems = items.filter((p) => {
                        const q = search.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (p.name || "").toLowerCase().includes(q) ||
                          (p.category?.name || category.name || "")
                            .toLowerCase()
                            .includes(q)
                        );
                      });

                      return (
                        <Accordion
                          key={category.id}
                          expanded={open}
                          onChange={() => toggleCategory(category.id)}
                          disableGutters
                          sx={{
                            border: "1px solid",
                            borderColor: open ? "primary.main" : "divider",
                            borderRadius: "20px !important",
                            overflow: "hidden",
                            backgroundColor: open ? "rgba(25,118,210,0.03)" : "#fff",
                            boxShadow: open
                              ? "0 10px 25px rgba(25,118,210,0.08)"
                              : "none",
                            "&:before": { display: "none" },
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ width: "100%" }}
                            >
                              <Typography sx={{ fontWeight: 900 }}>
                                {category.name}
                              </Typography>
                              <Box sx={{ flex: 1 }} />
                              <Chip
                                size="small"
                                label={loading ? "..." : visibleItems.length}
                                sx={{ fontWeight: 900, borderRadius: 999 }}
                                color={open ? "primary" : "default"}
                                variant={open ? "filled" : "outlined"}
                              />
                            </Stack>
                          </AccordionSummary>

                          <AccordionDetails sx={{ pt: 0.5 }}>
                            {loading ? (
                              <Stack spacing={1}>
                                <Skeleton height={52} />
                                <Skeleton height={52} />
                                <Skeleton height={52} />
                              </Stack>
                            ) : visibleItems.length === 0 ? (
                              <Typography sx={{ opacity: 0.75, py: 1 }}>
                                Bu kateqoriyada uyğun məhsul tapılmadı.
                              </Typography>
                            ) : (
                              <List dense disablePadding>
                                {visibleItems.map((product) => {
                                  const dbStock = getDbStock(product);
                                  const cur = getSelected(product);

                                  return (
                                    <Paper
                                      key={product.id}
                                      variant="outlined"
                                      sx={{
                                        mb: 1,
                                        borderRadius: 3,
                                        overflow: "hidden",
                                        borderColor:
                                          cur > 0 ? "primary.main" : "divider",
                                        backgroundColor:
                                          cur > 0 ? "rgba(25,118,210,0.04)" : "#fff",
                                      }}
                                    >
                                      <ListItem
                                        sx={{ px: 1.25, py: 1 }}
                                        secondaryAction={
                                          <Stack
                                            direction="row"
                                            spacing={0.5}
                                            alignItems="center"
                                          >
                                            <Tooltip title="Azalt">
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  onClick={() => dec(product)}
                                                  disabled={cur <= 0}
                                                >
                                                  <RemoveIcon fontSize="small" />
                                                </IconButton>
                                              </span>
                                            </Tooltip>

                                            <TextField
                                              size="small"
                                              value={cur}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => {
                                                const onlyDigits = String(
                                                  e.target.value || "",
                                                ).replace(/\D/g, "");

                                                if (onlyDigits === "") {
                                                  setQty((prev) => ({
                                                    ...prev,
                                                    [product.id]: 0,
                                                  }));
                                                  return;
                                                }

                                                const parsed = Number(onlyDigits);
                                                if (
                                                  !Number.isInteger(parsed) ||
                                                  parsed < 0
                                                )
                                                  return;

                                                setQty((prev) => ({
                                                  ...prev,
                                                  [product.id]: parsed,
                                                }));

                                                if (parsed > 0) {
                                                  ensureDefaultSalePrice(product);
                                                }
                                              }}
                                              inputProps={{
                                                inputMode: "numeric",
                                                pattern: "[0-9]*",
                                                min: 0,
                                                style: {
                                                  textAlign: "center",
                                                  padding: "8px 6px",
                                                  width: 44,
                                                  fontWeight: 900,
                                                },
                                              }}
                                              sx={{
                                                width: 60,
                                                "& .MuiOutlinedInput-root": {
                                                  borderRadius: 999,
                                                  height: 36,
                                                },
                                              }}
                                            />

                                            <Tooltip title="Artır">
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  onClick={() => inc(product)}
                                                >
                                                  <AddIcon fontSize="small" />
                                                </IconButton>
                                              </span>
                                            </Tooltip>
                                          </Stack>
                                        }
                                      >
                                        <ListItemText
                                          primary={
                                            <Stack
                                              direction="row"
                                              spacing={1}
                                              alignItems="center"
                                              flexWrap="wrap"
                                              useFlexGap
                                            >
                                              <Typography sx={{ fontWeight: 900 }}>
                                                {product.name}
                                              </Typography>

                                              <Chip
                                                size="small"
                                                label={`Stok: ${dbStock}`}
                                                sx={{
                                                  fontWeight: 800,
                                                  borderRadius: 999,
                                                }}
                                                variant="outlined"
                                              />

                                              <Chip
                                                size="small"
                                                label={`Cari satış: ${formatMoney(
                                                  product?.salePrice || 0,
                                                )}`}
                                                color="success"
                                                variant="outlined"
                                                sx={{
                                                  fontWeight: 800,
                                                  borderRadius: 999,
                                                }}
                                              />
                                            </Stack>
                                          }
                                          secondary={
                                            <Typography
                                              sx={{ fontSize: 12, opacity: 0.75, mt: 0.35 }}
                                            >
                                              {product.category?.name || category.name}
                                            </Typography>
                                          }
                                        />
                                      </ListItem>
                                    </Paper>
                                  );
                                })}
                              </List>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 5,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Seçilən alış səbəti
              </Typography>

              <Stack direction="row" spacing={1}>
                <Chip
                  label={`${selectedItems.totalQty} ədəd`}
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                />
                <Chip
                  label={formatMoney(selectedItems.totalAmount)}
                  color="success"
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                />
              </Stack>
            </Stack>

            <Divider sx={{ my: 1.6 }} />

            {selectedItems.items.length === 0 ? (
              <Alert severity="info">
                Hələ məhsul seçilməyib. Soldakı kateqoriyalardan məhsul əlavə et.
              </Alert>
            ) : (
              <Stack spacing={1.2}>
                {selectedItems.items.map((it) => (
                  <Paper
                    key={it.productId}
                    variant="outlined"
                    sx={{
                      borderRadius: 4,
                      p: 1.5,
                      borderColor: "divider",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.2}
                        alignItems={{ xs: "stretch", md: "center" }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 900 }} noWrap>
                            {it.name}
                          </Typography>
                          <Typography sx={{ fontSize: 12, opacity: 0.7 }} noWrap>
                            {it.category}
                          </Typography>
                        </Box>

                        <Chip
                          label={`x${it.quantity}`}
                          color="primary"
                          sx={{ fontWeight: 900, borderRadius: 999 }}
                        />

                        <Chip
                          label={`Stok: ${it.stockQty}`}
                          variant="outlined"
                          sx={{ fontWeight: 800, borderRadius: 999 }}
                        />

                        <Chip
                          label={`Cari satış: ${formatMoney(it.currentSalePrice)}`}
                          variant="outlined"
                          color="success"
                          sx={{ fontWeight: 800, borderRadius: 999 }}
                        />
                      </Stack>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "160px 160px 1fr auto" },
                          gap: 1.2,
                          alignItems: "center",
                        }}
                      >
                        <TextField
                          size="small"
                          type="number"
                          label="Alış qiyməti"
                          value={costs[it.productId] ?? ""}
                          onChange={(e) =>
                            handleCostChange(it.productId, e.target.value)
                          }
                          inputProps={{ min: 0, step: "0.01" }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">₼</InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          size="small"
                          type="number"
                          label="Satış qiyməti"
                          value={salePrices[it.productId] ?? ""}
                          onChange={(e) =>
                            handleSalePriceChange(it.productId, e.target.value)
                          }
                          inputProps={{ min: 0, step: "0.01" }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SellOutlinedIcon sx={{ opacity: 0.7 }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">₼</InputAdornment>
                            ),
                          }}
                        />

                        <Box />

                        <Chip
                          label={formatMoney(it.lineTotal)}
                          color="success"
                          variant="filled"
                          sx={{ fontWeight: 900, borderRadius: 999 }}
                        />
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1.8 }} />

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 4,
                bgcolor: "#f8fafc",
                borderStyle: "dashed",
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Seçilən məhsul sayı</Typography>
                  <Typography fontWeight={800}>{totalSelectedProducts}</Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Ümumi miqdar</Typography>
                  <Typography fontWeight={800}>{selectedItems.totalQty} ədəd</Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Toplam alış məbləği</Typography>
                  <Typography fontWeight={900} color="success.main">
                    {formatMoney(selectedItems.totalAmount)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            <Button
              fullWidth
              variant="contained"
              startIcon={<DoneAllIcon />}
              disabled={
                busy ||
                selectedItems.totalQty <= 0 ||
                hasInvalidCost ||
                hasInvalidSalePrice ||
                !supplier.trim() ||
                !invoiceNo.trim()
              }
              onClick={confirmPurchase}
              sx={{
                borderRadius: 3,
                textTransform: "none",
                fontWeight: 900,
                py: 1.35,
                mt: 1.8,
              }}
            >
              {busy ? "Yazılır..." : "Alışı təsdiqlə"}
            </Button>

            <Typography sx={{ fontSize: 12, opacity: 0.72, mt: 1 }}>
              Confirm edəndə stok artır və məhsulun satış qiyməti yenilənir.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={openCategoryModal}
        onClose={() => {
          setOpenCategoryModal(false);
          setNewCategoryError("");
          setNewCategoryName("");
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Yeni Category</DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            label="Category adı"
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value);
              if (newCategoryError) setNewCategoryError("");
            }}
            error={!!newCategoryError}
            helperText={newCategoryError}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setOpenCategoryModal(false);
              setNewCategoryError("");
              setNewCategoryName("");
            }}
          >
            Cancel
          </Button>

          <Button variant="contained" onClick={handleCreateCategory}>
            Yarat
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openProductModal}
        onClose={() => {
          setOpenProductModal(false);
          setNewProduct({
            name: "",
            categoryId: "",
            salePrice: "",
          });
          setNewProductErrors({
            name: "",
            categoryId: "",
            salePrice: "",
          });
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Yeni Məhsul</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Məhsul adı"
              value={newProduct.name}
              onChange={(e) => {
                setNewProduct((p) => ({ ...p, name: e.target.value }));
                if (newProductErrors.name) {
                  setNewProductErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
              error={!!newProductErrors.name}
              helperText={newProductErrors.name}
            />

            <FormControl fullWidth error={!!newProductErrors.categoryId}>
              <InputLabel>Category</InputLabel>
              <Select
                value={newProduct.categoryId}
                label="Category"
                onChange={(e) => {
                  setNewProduct((p) => ({ ...p, categoryId: e.target.value }));
                  if (newProductErrors.categoryId) {
                    setNewProductErrors((prev) => ({
                      ...prev,
                      categoryId: "",
                    }));
                  }
                }}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!!newProductErrors.categoryId && (
              <Typography sx={{ color: "error.main", fontSize: 12, mt: -1 }}>
                {newProductErrors.categoryId}
              </Typography>
            )}

            {/* <TextField
              label="Satış qiyməti"
              type="number"
              value={newProduct.salePrice}
              onChange={(e) => {
                setNewProduct((p) => ({ ...p, salePrice: e.target.value }));
                if (newProductErrors.salePrice) {
                  setNewProductErrors((prev) => ({
                    ...prev,
                    salePrice: "",
                  }));
                }
              }}
              error={!!newProductErrors.salePrice}
              helperText={newProductErrors.salePrice}
              inputProps={{
                min: 0,
                step: "0.01",
              }}
            /> */}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setOpenProductModal(false);
              setNewProduct({
                name: "",
                categoryId: "",
                salePrice: "",
              });
              setNewProductErrors({
                name: "",
                categoryId: "",
                salePrice: "",
              });
            }}
          >
            Cancel
          </Button>

          <Button variant="contained" onClick={handleCreateProduct}>
            Yarat
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={2600}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      >
        <Alert severity={toast.type} variant="filled" sx={{ fontWeight: 900 }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}