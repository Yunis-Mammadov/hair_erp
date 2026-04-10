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

        if (list.length) {
          const first = list[0].id;
          setExpanded((p) => ({ ...p, [first]: true }));
          await ensureProductsLoaded(first);
        }
      } catch (e) {
        console.error(e);
        setToast({
          open: true,
          type: "error",
          msg: e?.response?.data?.message || "Categories error",
        });
      } finally {
        if (!alive) return;
        setLoadingCats(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    setProductsByCat((p) => ({
      ...p,
      [categoryId]: { loading: true, items: [] },
    }));

    try {
      const res = await api.get("/catalog/products", {
        params: { categoryId },
      });

      const items = res.data?.products ?? [];

      setProductsByCat((p) => ({
        ...p,
        [categoryId]: { loading: false, items },
      }));
    } catch (e) {
      console.error(e);
      setProductsByCat((p) => ({
        ...p,
        [categoryId]: { loading: false, items: [] },
      }));
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Products error",
      });
    }
  }

  async function refreshOpenCategoriesStock() {
    const openCatIds = Object.keys(expanded).filter((k) => expanded[k]);

    for (const catId of openCatIds) {
      setProductsByCat((p) => ({
        ...p,
        [catId]: { loading: true, items: p[catId]?.items || [] },
      }));

      const pr = await api.get("/catalog/products", {
        params: { categoryId: catId },
      });

      setProductsByCat((p) => ({
        ...p,
        [catId]: { loading: false, items: pr.data?.products ?? [] },
      }));
    }
  }

  function toggleCategory(catId) {
    setExpanded((prev) => {
      const next = !prev[catId];
      return { ...prev, [catId]: next };
    });

    if (!expanded[catId]) {
      ensureProductsLoaded(catId);
    }
  }

  function getDbStock(p) {
    return Number(p?.stockQty ?? 0);
  }

  function getSelected(p) {
    return Number(qty[p.id] || 0);
  }

  function ensureDefaultSalePrice(p) {
    setSalePrices((prev) => {
      if (prev[p.id] !== undefined && prev[p.id] !== "") return prev;
      return { ...prev, [p.id]: String(Number(p?.salePrice || 0)) };
    });
  }

  function inc(p) {
    const cur = getSelected(p);
    setQty((prev) => ({ ...prev, [p.id]: cur + 1 }));
    ensureDefaultSalePrice(p);
  }

  function dec(p) {
    const cur = getSelected(p);
    const nextQty = Math.max(cur - 1, 0);

    setQty((prev) => ({ ...prev, [p.id]: nextQty }));

    if (nextQty === 0) {
      setCosts((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });

      setSalePrices((prev) => {
        const next = { ...prev };
        delete next[p.id];
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
    setErrors({
      supplier: "",
      invoiceNo: "",
    });
    setToast({ open: true, type: "info", msg: "Sıfırlandı" });
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
      setToast({ open: true, type: "info", msg: "Heç nə seçilməyib" });
      return;
    }

    const metaValid = validatePurchaseMeta();
    if (!metaValid) {
      setToast({
        open: true,
        type: "warning",
        msg: "Supplier və qaimə nömrəsi yazılmalıdır",
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
        msg: e?.response?.data?.message || e.message || "Purchase error",
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
      await api.post("/catalog/admin/categories", {
        name,
      });

      await fetchCategories();

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
        msg: e?.response?.data?.message || "Category create error",
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
        msg: e?.response?.data?.message || "Product create error",
      });
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1500, mx: "auto" }}>
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            alignItems={{ lg: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 900, letterSpacing: -0.6 }}
              >
                Alış
              </Typography>
              <Typography sx={{ opacity: 0.8, mt: 0.5 }}>
                Məhsul seç → Miqdar yaz → Alış qiyməti + Satış qiyməti yaz →
                Confirm
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Chip
                label={`${selectedItems.totalQty} ədəd`}
                sx={{ fontWeight: 900, borderRadius: 999 }}
              />
              <Chip
                label={formatMoney(selectedItems.totalAmount)}
                color="success"
                sx={{ fontWeight: 900, borderRadius: 999 }}
              />

              <Button
                variant="outlined"
                startIcon={<CategoryOutlinedIcon />}
                onClick={() => setOpenCategoryModal(true)}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                Yeni category
              </Button>

              <Button
                variant="outlined"
                startIcon={<Inventory2OutlinedIcon />}
                onClick={() => setOpenProductModal(true)}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                Yeni məhsul
              </Button>

              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={resetAll}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                Sıfırla
              </Button>

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
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 900 }}
              >
                {busy ? "Yazılır..." : "Confirm"}
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

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

          <Typography sx={{ mt: 1, fontSize: 12, opacity: 0.7 }}>
            * Alışı yazmaq üçün supplier, qaimə nömrəsi, ən azı bir məhsul, alış
            qiyməti və satış qiyməti mütləqdir.
          </Typography>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "480px 1fr" },
          gap: 2,
        }}
      >
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>
              Kateqoriyalar
            </Typography>

            {loadingCats ? (
              <Stack spacing={1}>
                <Skeleton height={54} />
                <Skeleton height={54} />
                <Skeleton height={54} />
              </Stack>
            ) : categories.length === 0 ? (
              <Typography sx={{ opacity: 0.75 }}>Kateqoriya yoxdur.</Typography>
            ) : (
              <Stack spacing={1}>
                {categories.map((c) => {
                  const open = !!expanded[c.id];
                  const block = productsByCat[c.id];
                  const loading = !!block?.loading;
                  const items = block?.items || [];

                  return (
                    <Accordion
                      key={c.id}
                      expanded={open}
                      onChange={() => toggleCategory(c.id)}
                      disableGutters
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                        overflow: "hidden",
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
                            {c.name}
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          <Chip
                            size="small"
                            label={loading ? "..." : items.length}
                            sx={{ fontWeight: 900, borderRadius: 999 }}
                          />
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails sx={{ pt: 0.5 }}>
                        {loading ? (
                          <Stack spacing={1}>
                            <Skeleton height={44} />
                            <Skeleton height={44} />
                            <Skeleton height={44} />
                          </Stack>
                        ) : items.length === 0 ? (
                          <Typography sx={{ opacity: 0.75, py: 1 }}>
                            Məhsul yoxdur.
                          </Typography>
                        ) : (
                          <List dense disablePadding>
                            {items.map((p) => {
                              const dbStock = getDbStock(p);
                              const cur = getSelected(p);

                              return (
                                <ListItem
                                  key={p.id}
                                  divider
                                  sx={{
                                    px: 0.5,
                                    py: 0.6,
                                  }}
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
                                            onClick={() => dec(p)}
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
                                              [p.id]: 0,
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
                                            [p.id]: parsed,
                                          }));

                                          if (parsed > 0) {
                                            ensureDefaultSalePrice(p);
                                          }
                                        }}
                                        inputProps={{
                                          inputMode: "numeric",
                                          pattern: "[0-9]*",
                                          min: 0,
                                          style: {
                                            textAlign: "center",
                                            padding: "8px 6px",
                                            width: 42,
                                            fontWeight: 900,
                                          },
                                        }}
                                        sx={{
                                          width: 58,
                                          "& .MuiOutlinedInput-root": {
                                            borderRadius: 999,
                                            height: 34,
                                          },
                                        }}
                                      />

                                      <Tooltip title="Artır">
                                        <span>
                                          <IconButton
                                            size="small"
                                            onClick={() => inc(p)}
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
                                      >
                                        <Typography
                                          sx={{ fontWeight: 900 }}
                                          noWrap
                                        >
                                          {p.name}
                                        </Typography>

                                        <Chip
                                          size="small"
                                          label={`Stok: ${dbStock}`}
                                          sx={{
                                            fontWeight: 900,
                                            borderRadius: 999,
                                            opacity: 0.7,
                                          }}
                                          variant="outlined"
                                        />

                                        <Chip
                                          size="small"
                                          label={`Cari satış: ${formatMoney(
                                            p?.salePrice || 0,
                                          )}`}
                                          sx={{
                                            fontWeight: 900,
                                            borderRadius: 999,
                                          }}
                                          color="success"
                                          variant="outlined"
                                        />
                                      </Stack>
                                    }
                                    secondary={
                                      <Typography
                                        sx={{ fontSize: 12, opacity: 0.75 }}
                                      >
                                        {p.category?.name || c.name}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
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
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
            >
              <Typography sx={{ fontWeight: 900 }}>Seçilənlər</Typography>

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

            <Divider sx={{ my: 1.3 }} />

            {selectedItems.items.length === 0 ? (
              <Typography sx={{ opacity: 0.75 }}>
                Hələ heç nə seçilməyib. Sol paneldən + ilə miqdar yaz.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {selectedItems.items.map((it) => (
                  <Box
                    key={it.productId}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 3,
                      p: 1.2,
                    }}
                  >
                    <Stack spacing={1.2}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "stretch", md: "center" }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 900 }} noWrap>
                            {it.name}
                          </Typography>
                          <Typography
                            sx={{ fontSize: 12, opacity: 0.75 }}
                            noWrap
                          >
                            {it.category}
                          </Typography>
                        </Box>

                        <Chip
                          label={`x${it.quantity}`}
                          sx={{ fontWeight: 900, borderRadius: 999 }}
                          color="primary"
                        />

                        <Chip
                          label={`Cari satış: ${formatMoney(it.currentSalePrice)}`}
                          variant="outlined"
                          color="success"
                          sx={{ fontWeight: 900, borderRadius: 999 }}
                        />
                      </Stack>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.2}
                        alignItems={{ xs: "stretch", md: "center" }}
                      >
                        <TextField
                          size="small"
                          type="number"
                          label="Alış qiyməti"
                          value={costs[it.productId] ?? ""}
                          onChange={(e) =>
                            handleCostChange(it.productId, e.target.value)
                          }
                          sx={{ width: { xs: "100%", md: 150 } }}
                          inputProps={{
                            min: 0,
                            step: "0.01",
                          }}
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
                          sx={{ width: { xs: "100%", md: 150 } }}
                          inputProps={{
                            min: 0,
                            step: "0.01",
                          }}
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

                        <Box sx={{ flex: 1 }} />

                        <Chip
                          label={formatMoney(it.lineTotal)}
                          color="success"
                          variant="outlined"
                          sx={{ fontWeight: 900, borderRadius: 999 }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1.6 }} />

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
                py: 1.2,
              }}
            >
              {busy ? "Yazılır..." : "Confirm purchase"}
            </Button>

            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 1 }}>
              Confirm edəndə stok artır və satış qiyməti məhsulun default
              qiyməti kimi yenilənir.
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

            <TextField
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
              helperText={newProductErrors.salePrice || "0 da yaza bilərsən"}
              inputProps={{
                min: 0,
                step: "0.01",
              }}
            />
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
