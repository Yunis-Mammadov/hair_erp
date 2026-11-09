import { useEffect, useMemo, useState } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import MyLocationOutlinedIcon from "@mui/icons-material/MyLocationOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";

import AddressMapPickerDialog from "../components/AddressMapPickerDialog";
import { api } from "../lib/api";

const PAYMENT_TYPES = [
  { v: "REALİZASİYA", l: "Realizasiya" },
  { v: "NAĞD", l: "Nağd" },
  { v: "HİSSƏLİ", l: "Hissəli" },
  { v: "DİGƏR", l: "Digər" },
];

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatAzerbaijanPhone(value) {
  const digits = onlyDigits(value).slice(0, 9);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 7);
  const p4 = digits.slice(7, 9);

  let out = p1;
  if (p2) out += `-${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function normalizePhoneForBackend(value) {
  return `+994${onlyDigits(value).slice(0, 9)}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

export default function SalesPage() {
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [productsByCat, setProductsByCat] = useState({});

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const isAdmin = currentUser?.role === "ADMIN";

  const [customerMode, setCustomerMode] = useState("");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedExistingCustomer, setSelectedExistingCustomer] =
    useState(null);

  const [qty, setQty] = useState({});
  const [giftQty, setGiftQty] = useState({});
  const [prices, setPrices] = useState({});
  const [manualPriceEnabled, setManualPriceEnabled] = useState({});

  const [mapOpen, setMapOpen] = useState(false);
  const [locationData, setLocationData] = useState({
    lat: null,
    lng: null,
  });

  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    salon: "",
    address: "",
  });

  const [paymentType, setPaymentType] = useState("REALİZASİYA");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "info", msg: "" });

  const [errors, setErrors] = useState({
    customerMode: "",
    existingCustomer: "",
    name: "",
    phone: "",
    salon: "",
    address: "",
    location: "",
    area: "",
  });

  async function fetchAreas() {
    try {
      setAreasLoading(true);
      const res = await api.get("/areas");
      setAreas(res.data || []);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Ərazilər yüklənmədi",
      });
    } finally {
      setAreasLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingCats(true);

        await fetchAreas();

        const res = await api.get("/catalog/categories");
        if (!alive) return;

        const list = res.data?.categories ?? [];
        setCategories(list);

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
          msg: e?.response?.data?.message || "Kateqoriyalar yüklənmədi",
        });
      } finally {
        if (alive) setLoadingCats(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        msg: e?.response?.data?.message || "Məhsullar yüklənmədi",
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

  async function searchCustomers(keyword) {
    const q = String(keyword || "").trim();
    if (q.length < 2) {
      setCustomerOptions([]);
      return;
    }

    try {
      setCustomerSearchLoading(true);
      const res = await api.get("/customers", {
        params: { search: q, limit: 20 },
      });

      const customers = res.data?.customers ?? [];
      setCustomerOptions(customers);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Müştəri axtarışı alınmadı",
      });
    } finally {
      setCustomerSearchLoading(false);
    }
  }

  function fillCustomerFormFromExisting(c) {
    setCustomer({
      name: c?.name || "",
      phone: String(c?.phone || "").replace(/^\+994/, ""),
      salon: c?.salon || "",
      address: c?.address || "",
    });

    setLocationData({
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
    });

    if (c?.areaId && areas.length) {
      const foundArea = areas.find((a) => a.id === c.areaId) || null;
      setSelectedArea(foundArea);
    } else if (c?.area?.id && areas.length) {
      const foundArea = areas.find((a) => a.id === c.area.id) || null;
      setSelectedArea(foundArea);
    } else {
      setSelectedArea(null);
    }
  }

  useEffect(() => {
    if (!selectedExistingCustomer || !areas.length) return;

    const customerAreaId =
      selectedExistingCustomer?.areaId || selectedExistingCustomer?.area?.id;

    if (!customerAreaId) {
      setSelectedArea(null);
      return;
    }

    const foundArea = areas.find((a) => a.id === customerAreaId) || null;
    setSelectedArea(foundArea);
  }, [selectedExistingCustomer, areas]);

  function handleQtyInput(product, rawValue) {
    const value = String(rawValue).replace(/\D/g, "");

    if (value === "") {
      setQty((prev) => ({ ...prev, [product.id]: 0 }));
      return;
    }

    const parsed = Number(value);
    const dbStock = getDbStock(product);
    const giftCount = getGiftSelected(product);

    if (!Number.isInteger(parsed) || parsed < 0) return;

    const maxAllowed = Math.max(dbStock - giftCount, 0);
    const finalQty = Math.min(parsed, maxAllowed);

    setQty((prev) => ({ ...prev, [product.id]: finalQty }));

    if (finalQty > 0) {
      ensureDefaultPriceForProduct(product);
    }

    if (finalQty === 0 && giftCount === 0) {
      setPrices((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });

      setManualPriceEnabled((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }
  }

  function handleGiftQtyInput(product, rawValue) {
    const value = String(rawValue).replace(/\D/g, "");

    if (value === "") {
      setGiftQty((prev) => ({ ...prev, [product.id]: 0 }));
      return;
    }

    const parsed = Number(value);
    const dbStock = getDbStock(product);
    const saleCount = getSelected(product);

    if (!Number.isInteger(parsed) || parsed < 0) return;

    const maxAllowed = Math.max(dbStock - saleCount, 0);
    const finalQty = Math.min(parsed, maxAllowed);

    setGiftQty((prev) => ({ ...prev, [product.id]: finalQty }));

    if (finalQty === 0 && saleCount === 0) {
      setPrices((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });

      setManualPriceEnabled((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }
  }

  function handleSelectExistingCustomer(value) {
    setSelectedExistingCustomer(value);

    if (errors.existingCustomer) {
      setErrors((prev) => ({ ...prev, existingCustomer: "" }));
    }

    if (value) {
      fillCustomerFormFromExisting(value);
      setCustomer((prev) => ({
        ...prev,
        phone: formatAzerbaijanPhone(prev.phone),
      }));
    } else {
      setCustomer({
        name: "",
        phone: "",
        salon: "",
        address: "",
      });
      setLocationData({ lat: null, lng: null });
    }
  }

  function getDbStock(p) {
    return Number(p?.stockQty ?? p?.stock?.quantity ?? 0);
  }

  function getSelected(p) {
    return Number(qty[p.id] || 0);
  }

  function getGiftSelected(p) {
    return Number(giftQty[p.id] || 0);
  }

  function getTotalSelected(p) {
    return getSelected(p) + getGiftSelected(p);
  }

  function getDefaultSalePrice(p) {
    return Number(p?.salePrice ?? 0);
  }

  function remainingStock(p) {
    return Math.max(getDbStock(p) - getTotalSelected(p), 0);
  }

  function ensureDefaultPriceForProduct(p) {
    setPrices((prev) => {
      if (prev[p.id] !== undefined && prev[p.id] !== "") return prev;
      return { ...prev, [p.id]: String(getDefaultSalePrice(p)) };
    });
  }

  function inc(p) {
    const dbStock = getDbStock(p);
    const totalSelected = getTotalSelected(p);

    if (dbStock <= 0) {
      setToast({ open: true, type: "warning", msg: "Stock yoxdur" });
      return;
    }

    if (totalSelected + 1 > dbStock) {
      setToast({ open: true, type: "warning", msg: "Stock limiti" });
      return;
    }

    setQty((prev) => ({ ...prev, [p.id]: getSelected(p) + 1 }));
    ensureDefaultPriceForProduct(p);
  }

  function dec(p) {
    const nextQty = Math.max(getSelected(p) - 1, 0);
    setQty((prev) => ({ ...prev, [p.id]: nextQty }));

    if (nextQty === 0 && getGiftSelected(p) === 0) {
      setPrices((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });

      setManualPriceEnabled((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    }
  }

  function incGift(p) {
    const dbStock = getDbStock(p);
    const totalSelected = getTotalSelected(p);

    if (dbStock <= 0) {
      setToast({ open: true, type: "warning", msg: "Stock yoxdur" });
      return;
    }

    if (totalSelected + 1 > dbStock) {
      setToast({ open: true, type: "warning", msg: "Stock limiti" });
      return;
    }

    setGiftQty((prev) => ({ ...prev, [p.id]: getGiftSelected(p) + 1 }));
  }

  function decGift(p) {
    const nextQty = Math.max(getGiftSelected(p) - 1, 0);
    setGiftQty((prev) => ({ ...prev, [p.id]: nextQty }));

    if (nextQty === 0 && getSelected(p) === 0) {
      setPrices((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });

      setManualPriceEnabled((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    }
  }

  function enableManualPrice(productId) {
    if (!isAdmin) return;
    setManualPriceEnabled((prev) => ({ ...prev, [productId]: true }));
  }

  function resetPriceToDefault(product) {
    setPrices((prev) => ({
      ...prev,
      [product.id]: String(getDefaultSalePrice(product)),
    }));
    setManualPriceEnabled((prev) => ({
      ...prev,
      [product.id]: false,
    }));
  }

  function handlePriceChange(productId, value) {
    if (!isAdmin) return;

    if (value === "") {
      setPrices((prev) => ({ ...prev, [productId]: "" }));
      return;
    }

    const normalized = String(value).replace(",", ".");
    const numberValue = Number(normalized);

    if (!Number.isFinite(numberValue) || numberValue < 0) return;

    setPrices((prev) => ({ ...prev, [productId]: normalized }));
  }

  function clearSelection() {
    setQty({});
    setGiftQty({});
    setPrices({});
    setManualPriceEnabled({});
  }

  const allProductsMap = useMemo(() => {
    const all = new Map();
    for (const v of Object.values(productsByCat)) {
      for (const p of v?.items || []) {
        all.set(p.id, p);
      }
    }
    return all;
  }, [productsByCat]);

  const selectedItems = useMemo(() => {
    const items = [];
    let totalQty = 0;
    let totalAmount = 0;

    for (const [productId, q] of Object.entries(qty)) {
      const quantity = Number(q || 0);
      if (quantity <= 0) continue;

      const p = allProductsMap.get(productId);
      const unitPrice = Number(prices[productId] || 0);
      const lineTotal = quantity * unitPrice;

      items.push({
        productId,
        quantity,
        unitPrice,
        lineTotal,
        name: p?.name || "Məhsul",
        category: p?.category?.name || "—",
        defaultPrice: getDefaultSalePrice(p),
        product: p,
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
  }, [qty, prices, allProductsMap]);

  const selectedGiftItems = useMemo(() => {
    const items = [];
    let totalQty = 0;

    for (const [productId, q] of Object.entries(giftQty)) {
      const quantity = Number(q || 0);
      if (quantity <= 0) continue;

      const p = allProductsMap.get(productId);

      items.push({
        productId,
        quantity,
        unitPrice: 0,
        lineTotal: 0,
        name: p?.name || "Məhsul",
        category: p?.category?.name || "—",
        product: p,
      });

      totalQty += quantity;
    }

    items.sort(
      (a, b) =>
        (a.category || "").localeCompare(b.category || "") ||
        (a.name || "").localeCompare(b.name || ""),
    );

    return { items, totalQty };
  }, [giftQty, allProductsMap]);

  const trimmedCustomer = useMemo(
    () => ({
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      salon: customer.salon.trim(),
      address: customer.address.trim(),
    }),
    [customer],
  );

  const phoneDigits = useMemo(
    () => onlyDigits(customer.phone).slice(0, 9),
    [customer.phone],
  );

  const hasInvalidPrice = useMemo(() => {
    if (selectedItems.items.length === 0) return false;
    return selectedItems.items.some(
      (item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0,
    );
  }, [selectedItems]);

  const hasAnySelected =
    selectedItems.totalQty > 0 || selectedGiftItems.totalQty > 0;

  const isExistingCustomerMode = customerMode === "existing";
  const isNewCustomerMode = customerMode === "new";

  function validateBeforeSubmit() {
    const nextErrors = {
      customerMode: "",
      existingCustomer: "",
      name: "",
      phone: "",
      salon: "",
      address: "",
      location: "",
      area: "",
    };

    if (!customerMode) {
      nextErrors.customerMode = "Müştəri statusu seçilməlidir";
    }

    if (isExistingCustomerMode && !selectedExistingCustomer) {
      nextErrors.existingCustomer = "Köhnə müştəri seçilməlidir";
    }

    if (!trimmedCustomer.name || trimmedCustomer.name.length < 2) {
      nextErrors.name = "Müştəri adı ən azı 2 hərf olmalıdır";
    }

    if (phoneDigits.length !== 9) {
      nextErrors.phone = "Telefon tam olmalıdır";
    }

    if (!trimmedCustomer.salon) {
      nextErrors.salon = "Salon adı mütləqdir";
    }

    if (!selectedArea?.id) {
      nextErrors.area = "Ərazi seçilməlidir";
    }

    if (!locationData.lat || !locationData.lng) {
      nextErrors.location = "Xəritədən koordinat seçilməlidir";
    }

    setErrors(nextErrors);
    return Object.values(nextErrors).every((x) => !x);
  }

  async function confirmOrder() {
    if (!hasAnySelected) {
      setToast({ open: true, type: "info", msg: "Heç nə seçilməyib" });
      return;
    }

    if (selectedItems.totalQty > 0 && hasInvalidPrice) {
      setToast({
        open: true,
        type: "warning",
        msg: "Satılan məhsulların hamısında qiymət olmalıdır",
      });
      return;
    }

    const isValid = validateBeforeSubmit();
    if (!isValid) {
      setToast({
        open: true,
        type: "warning",
        msg: "Məlumatları tam doldur",
      });
      return;
    }

    setBusy(true);

    try {
      let customerId = null;

      if (isExistingCustomerMode && selectedExistingCustomer?.id) {
        customerId = selectedExistingCustomer.id;
      } else {
        const custRes = await api.post("/customers", {
          name: trimmedCustomer.name,
          phone: normalizePhoneForBackend(customer.phone),
          salon: trimmedCustomer.salon,
          address: selectedArea?.name || "",
          lat: locationData.lat,
          lng: locationData.lng,
          areaId: selectedArea.id,
        });

        customerId = custRes.data?.customer?.id || null;
      }

      const payload = {
        customerId,
        paymentType,
        note: note.trim() || undefined,
        items: [
          ...selectedItems.items.map((x) => ({
            productId: x.productId,
            quantity: x.quantity,
            unitPrice: x.unitPrice,
            isGift: false,
          })),
          ...selectedGiftItems.items.map((x) => ({
            productId: x.productId,
            quantity: x.quantity,
            unitPrice: 0,
            isGift: true,
          })),
        ],
      };

      const res = await api.post("/orders", payload);

      setToast({
        open: true,
        type: "success",
        msg: `Satış yazıldı: ${res.data?.order?.id?.slice(0, 8) || "OK"}…`,
      });

      await refreshOpenCategoriesStock();

      setQty({});
      setGiftQty({});
      setPrices({});
      setManualPriceEnabled({});
      setNote("");
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || e.message || "Order error",
      });
    } finally {
      setBusy(false);
    }
  }

  const canShowForm = !!customerMode;
  const canShowProducts =
    (isExistingCustomerMode && !!selectedExistingCustomer) || isNewCustomerMode;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1550, mx: "auto" }}>
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  letterSpacing: -0.6,
                  fontSize: { xs: 28, md: 34 },
                }}
              >
                Satış
              </Typography>
              <Typography sx={{ opacity: 0.8, mt: 0.5 }}>
                Əvvəl müştəri statusunu seç, sonra sifarişi yaz
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography sx={{ fontWeight: 900, mb: 1.2 }}>
                Müştəri statusu
              </Typography>

              <RadioGroup
                row
                value={customerMode}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomerMode(value);
                  setSelectedExistingCustomer(null);
                  setCustomerOptions([]);
                  setSelectedArea(null);

                  setCustomer({
                    name: "",
                    phone: "",
                    salon: "",
                    address: "",
                  });

                  setLocationData({
                    lat: null,
                    lng: null,
                  });

                  if (errors.customerMode) {
                    setErrors((prev) => ({ ...prev, customerMode: "" }));
                  }
                }}
                sx={{
                  gap: 1,
                  flexDirection: { xs: "column", sm: "row" },
                }}
              >
                <Card
                  variant={
                    customerMode === "existing" ? "elevation" : "outlined"
                  }
                  sx={{
                    borderRadius: 3,
                    borderColor:
                      customerMode === "existing" ? "primary.main" : "divider",
                  }}
                >
                  <CardContent sx={{ py: "12px !important", px: 2 }}>
                    <FormControlLabel
                      value="existing"
                      control={<Radio />}
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <HistoryOutlinedIcon fontSize="small" />
                          <Typography sx={{ fontWeight: 800 }}>
                            Köhnə müştəri
                          </Typography>
                        </Stack>
                      }
                    />
                  </CardContent>
                </Card>

                <Card
                  variant={customerMode === "new" ? "elevation" : "outlined"}
                  sx={{
                    borderRadius: 3,
                    borderColor:
                      customerMode === "new" ? "primary.main" : "divider",
                  }}
                >
                  <CardContent sx={{ py: "12px !important", px: 2 }}>
                    <FormControlLabel
                      value="new"
                      control={<Radio />}
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PersonAddAltOutlinedIcon fontSize="small" />
                          <Typography sx={{ fontWeight: 800 }}>
                            Yeni müştəri
                          </Typography>
                        </Stack>
                      }
                    />
                  </CardContent>
                </Card>
              </RadioGroup>

              {!!errors.customerMode && (
                <Typography sx={{ color: "error.main", fontSize: 12, mt: 1 }}>
                  {errors.customerMode}
                </Typography>
              )}
            </Box>

            {isExistingCustomerMode && (
              <Autocomplete
                options={customerOptions}
                loading={customerSearchLoading}
                value={selectedExistingCustomer}
                onChange={(_, value) => handleSelectExistingCustomer(value)}
                onInputChange={(_, value) => searchCustomers(value)}
                getOptionLabel={(option) =>
                  `${option?.name || ""} ${option?.salon ? `— ${option.salon}` : ""}`
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="Müştəri tapılmadı"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Köhnə müştərini axtar"
                    placeholder="Ad, telefon və ya salon yaz"
                    error={!!errors.existingCustomer}
                    helperText={
                      errors.existingCustomer ||
                      "Minimum 2 hərf yazıb müştərini seç"
                    }
                  />
                )}
              />
            )}

            {canShowForm && (
              <>
                <Divider />

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "1fr 1fr",
                      xl: "1fr 1fr 1fr 1fr 1fr",
                    },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    value={customer.name}
                    onChange={(e) => {
                      setCustomer((p) => ({ ...p, name: e.target.value }));
                      if (errors.name) {
                        setErrors((prev) => ({ ...prev, name: "" }));
                      }
                    }}
                    label="Müştəri adı"
                    error={!!errors.name}
                    helperText={errors.name}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={{ opacity: 0.7 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    value={customer.phone}
                    onChange={(e) => {
                      const formatted = formatAzerbaijanPhone(e.target.value);
                      setCustomer((p) => ({ ...p, phone: formatted }));
                      if (errors.phone) {
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    label="Telefon"
                    error={!!errors.phone}
                    helperText={errors.phone}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocalPhoneOutlinedIcon
                            sx={{ mr: 1, opacity: 0.7 }}
                          />
                          +994
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    value={customer.salon}
                    onChange={(e) => {
                      setCustomer((p) => ({ ...p, salon: e.target.value }));
                      if (errors.salon) {
                        setErrors((prev) => ({ ...prev, salon: "" }));
                      }
                    }}
                    label="Salon"
                    error={!!errors.salon}
                    helperText={errors.salon}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <StorefrontOutlinedIcon
                            sx={{ mr: 1, opacity: 0.7 }}
                          />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControl size="medium" fullWidth>
                    <InputLabel>Ödəniş növü</InputLabel>
                    <Select
                      value={paymentType}
                      label="Ödəniş növü"
                      onChange={(e) => setPaymentType(e.target.value)}
                    >
                      {PAYMENT_TYPES.map((x) => (
                        <MenuItem key={x.v} value={x.v}>
                          {x.l}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
                    gap: 1.5,
                    alignItems: "start",
                  }}
                >
                  <Autocomplete
                    fullWidth
                    options={areas}
                    loading={areasLoading}
                    value={selectedArea}
                    onChange={(_, value) => {
                      setSelectedArea(value);
                      if (errors.area) {
                        setErrors((prev) => ({ ...prev, area: "" }));
                      }
                    }}
                    getOptionLabel={(option) => option?.name || ""}
                    isOptionEqualToValue={(option, value) =>
                      option.id === value.id
                    }
                    noOptionsText="Ərazi tapılmadı"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Ərazi"
                        placeholder="Ərazi axtar və seç"
                        error={!!errors.area || !!errors.location}
                        helperText={
                          errors.area ||
                          errors.location ||
                          (locationData.lat && locationData.lng
                            ? `Koordinat seçildi: ${locationData.lat.toFixed(5)}, ${locationData.lng.toFixed(5)}`
                            : "Ərazini seç və xəritədən koordinatı qeyd et")
                        }
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <PlaceOutlinedIcon
                                  sx={{ mr: 1, opacity: 0.7 }}
                                />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  <Button
                    variant={
                      locationData.lat && locationData.lng
                        ? "contained"
                        : "outlined"
                    }
                    onClick={() => setMapOpen(true)}
                    startIcon={<MyLocationOutlinedIcon />}
                    sx={{
                      minWidth: { xs: "100%", md: 190 },
                      height: 56,
                      borderRadius: 3,
                    }}
                  >
                    {locationData.lat && locationData.lng
                      ? "Koordinat seçildi"
                      : "Xəritədən seç"}
                  </Button>
                </Box>

                <TextField
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  label="Qeyd"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <NotesOutlinedIcon sx={{ mr: 1, opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {canShowProducts && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: "minmax(0, 1fr) 320px",
              xl: "minmax(0, 1fr) 336px",
            },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Card
            component="section"
            aria-labelledby="products-heading"
            sx={orderCardSx}
          >
            <Box
              sx={{
                px: 2,
                py: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
              >
                <Typography
                  component="h2"
                  id="products-heading"
                  sx={{ fontSize: 15, fontWeight: 600 }}
                >
                  Məhsullar
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                  {categories.length} kateqoriya
                </Typography>
              </Stack>
              <Typography
                sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}
              >
                Kateqoriyanı aç, satış və hədiyyə miqdarını yaz.
              </Typography>
            </Box>

            {loadingCats ? (
              <Stack spacing={1} sx={{ p: 2 }}>
                <Skeleton height={48} />
                <Skeleton height={48} />
                <Skeleton height={48} />
              </Stack>
            ) : categories.length === 0 ? (
              <Typography sx={{ p: 3, fontSize: 13, color: "text.secondary" }}>
                Hələ kateqoriya yoxdur.
              </Typography>
            ) : (
              categories.map((category) => {
                const block = productsByCat[category.id];
                const loading = Boolean(block?.loading);
                const items = block?.items || [];
                return (
                  <Accordion
                    key={category.id}
                    expanded={Boolean(expanded[category.id])}
                    onChange={() => toggleCategory(category.id)}
                    disableGutters
                    elevation={0}
                    sx={{
                      m: 0,
                      borderRadius: "0 !important",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { borderBottom: 0 },
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary
                      id={"category-" + category.id}
                      aria-controls={"category-products-" + category.id}
                      expandIcon={
                        <ExpandMoreIcon
                          sx={{ fontSize: 19, color: "text.secondary" }}
                        />
                      }
                      sx={{
                        px: 2,
                        minHeight: "48px !important",
                        bgcolor: "#fafbfc",
                        "& .MuiAccordionSummary-content": {
                          my: "12px !important",
                          gap: 1,
                          alignItems: "center",
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 500,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {category.name}
                      </Typography>
                      {loading ? (
                        <Typography
                          sx={{ fontSize: 11, color: "text.secondary" }}
                        >
                          Yüklənir…
                        </Typography>
                      ) : (
                        block && (
                          <Typography
                            sx={{
                              fontSize: 11,
                              color: "text.secondary",
                              pr: 0.75,
                            }}
                          >
                            {items.length} məhsul
                          </Typography>
                        )
                      )}
                    </AccordionSummary>
                    <AccordionDetails
                      id={"category-products-" + category.id}
                      sx={{ p: 0 }}
                    >
                      {loading ? (
                        <Stack sx={{ p: 2 }}>
                          <Skeleton height={48} />
                          <Skeleton height={48} />
                        </Stack>
                      ) : items.length === 0 ? (
                        <Typography
                          sx={{
                            px: 2,
                            py: 3,
                            fontSize: 12,
                            color: "text.secondary",
                          }}
                        >
                          Bu kateqoriyada məhsul yoxdur.
                        </Typography>
                      ) : (
                        <>
                          <Box
                            aria-hidden="true"
                            sx={{
                              display: { xs: "none", sm: "grid" },
                              gridTemplateColumns: productColumns,
                              columnGap: 1,
                              px: 2,
                              py: 1.1,
                              color: "text.secondary",
                              borderBottom: "1px solid",
                              borderColor: "divider",
                              "& > *": { fontSize: 10.5 },
                            }}
                          >
                            <Typography>Məhsul</Typography>
                            <Typography align="right">Qalıq</Typography>
                            <Typography align="right">Qiymət</Typography>
                            <Typography align="center">Satış</Typography>
                            <Typography align="center">Hədiyyə</Typography>
                          </Box>
                          <Box
                            component="ul"
                            sx={{ listStyle: "none", p: 0, m: 0 }}
                          >
                            {items.map((product) => {
                              const stock = getDbStock(product);
                              const saleQuantity = getSelected(product);
                              const giftQuantity = getGiftSelected(product);
                              const remaining = remainingStock(product);
                              const canAdd =
                                !busy && getTotalSelected(product) < stock;
                              const selected = saleQuantity + giftQuantity > 0;
                              return (
                                <Box
                                  component="li"
                                  key={product.id}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                      xs: "repeat(2, minmax(0, 1fr))",
                                      sm: productColumns,
                                    },
                                    alignItems: "center",
                                    gap: { xs: 1.5, sm: 1 },
                                    px: 2,
                                    py: { xs: 1.75, sm: 1.4 },
                                    borderBottom: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: selected ? "#f7f9ff" : "#fff",
                                    "&:last-child": { borderBottom: 0 },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      minWidth: 0,
                                      gridColumn: { xs: "1 / -1", sm: "auto" },
                                    }}
                                  >
                                    <Typography
                                      sx={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      {product.name}
                                    </Typography>
                                    {stock <= 0 && (
                                      <Typography
                                        sx={{
                                          mt: 0.3,
                                          fontSize: 10.5,
                                          color: "text.secondary",
                                        }}
                                      >
                                        Stok bitib
                                      </Typography>
                                    )}
                                    <Typography
                                      sx={{
                                        display: { xs: "block", sm: "none" },
                                        fontSize: 11.5,
                                        color: "text.secondary",
                                        mt: 0.5,
                                      }}
                                    >
                                      Qalıq: {remaining} ·{" "}
                                      {formatMoney(
                                        getDefaultSalePrice(product),
                                      )}
                                    </Typography>
                                  </Box>
                                  <Typography
                                    sx={{
                                      display: { xs: "none", sm: "block" },
                                      textAlign: "right",
                                      fontSize: 12,
                                      color:
                                        remaining <= 3
                                          ? "warning.main"
                                          : "text.secondary",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {remaining}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      display: { xs: "none", sm: "block" },
                                      textAlign: "right",
                                      fontSize: 12,
                                      whiteSpace: "nowrap",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {formatMoney(getDefaultSalePrice(product))}
                                  </Typography>
                                  <QuantityControl
                                    label="Satış"
                                    productName={product.name}
                                    value={saleQuantity}
                                    disabled={busy || stock <= 0}
                                    canAdd={canAdd}
                                    onDecrease={() => dec(product)}
                                    onIncrease={() => inc(product)}
                                    onChange={(value) =>
                                      handleQtyInput(product, value)
                                    }
                                  />
                                  <QuantityControl
                                    label="Hədiyyə"
                                    productName={product.name}
                                    value={giftQuantity}
                                    disabled={busy || stock <= 0}
                                    canAdd={canAdd}
                                    onDecrease={() => decGift(product)}
                                    onIncrease={() => incGift(product)}
                                    onChange={(value) =>
                                      handleGiftQtyInput(product, value)
                                    }
                                  />
                                </Box>
                              );
                            })}
                          </Box>
                        </>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })
            )}
          </Card>

          <Card
            component="aside"
            aria-labelledby="order-summary-heading"
            sx={{
              ...orderCardSx,
              width: "100%",
              maxWidth: { xs: "none", sm: 440, lg: "none" },
              justifySelf: { sm: "end", lg: "stretch" },
              position: { xs: "static", lg: "sticky" },
              top: { lg: 84 },
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              sx={{ px: 2, py: 1.75 }}
            >
              <Typography
                component="h2"
                id="order-summary-heading"
                sx={{ fontSize: 15, fontWeight: 600 }}
              >
                Sifariş xülasəsi
              </Typography>
              <Tooltip title="Məhsul seçimini təmizlə">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Məhsul seçimini təmizlə"
                    disabled={busy || !hasAnySelected}
                    onClick={clearSelection}
                    sx={{ color: "text.secondary" }}
                  >
                    <RestartAltIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Divider />

            {!hasAnySelected ? (
              <Box sx={{ px: 2.5, py: 3.5, textAlign: "center" }}>
                <ShoppingCartOutlinedIcon
                  sx={{ fontSize: 27, color: "#9aa5b5", mb: 0.75 }}
                />
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                  Məhsul seçilməyib
                </Typography>
                <Typography
                  sx={{ mt: 0.5, fontSize: 11.5, color: "text.secondary" }}
                >
                  Siyahıdan məhsul əlavə et.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  px: 2,
                  maxHeight: { xs: "none", lg: "min(420px, 45dvh)" },
                  overflowY: { xs: "visible", lg: "auto" },
                  scrollbarWidth: "thin",
                }}
              >
                {selectedItems.items.map((item) => (
                  <Box
                    key={item.productId}
                    sx={{
                      py: 1.75,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="flex-start"
                    >
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          flex: 1,
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {item.name}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={"Satışdan sil: " + item.name}
                        disabled={busy}
                        onClick={() => handleQtyInput(item.product, "0")}
                        sx={{ p: 0.3, color: "text.secondary" }}
                      >
                        <CloseRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ mt: 0.65 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <Typography
                          sx={{ fontSize: 11.5, color: "text.secondary" }}
                        >
                          {item.quantity} × {formatMoney(item.unitPrice)}
                        </Typography>
                        {isAdmin && !manualPriceEnabled[item.productId] && (
                          <Tooltip title="Qiyməti dəyiş">
                            <IconButton
                              size="small"
                              aria-label={"Qiyməti dəyiş: " + item.name}
                              disabled={busy}
                              onClick={() => enableManualPrice(item.productId)}
                              sx={{ p: 0.4, color: "text.secondary" }}
                            >
                              <EditOutlinedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(item.lineTotal)}
                      </Typography>
                    </Stack>
                    {isAdmin && manualPriceEnabled[item.productId] && (
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.75}
                        sx={{ mt: 1.75 }}
                      >
                        <TextField
                          size="small"
                          type="number"
                          label="Vahid qiyməti"
                          value={prices[item.productId] ?? ""}
                          disabled={busy}
                          onChange={(event) =>
                            handlePriceChange(
                              item.productId,
                              event.target.value,
                            )
                          }
                          inputProps={{
                            min: 0.01,
                            step: "0.01",
                            "aria-label": "Vahid qiyməti: " + item.name,
                          }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">₼</InputAdornment>
                            ),
                          }}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            "& input": { fontSize: 12, py: 1 },
                            "& .MuiOutlinedInput-root": { borderRadius: "6px" },
                            "& .MuiInputLabel-root": { fontSize: 12 },
                          }}
                        />
                        <Tooltip title="Standart qiymətə qaytar">
                          <IconButton
                            size="small"
                            aria-label={"Standart qiymətə qaytar: " + item.name}
                            disabled={busy}
                            onClick={() => resetPriceToDefault(item.product)}
                          >
                            <LockResetOutlinedIcon sx={{ fontSize: 19 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Box>
                ))}
                {selectedGiftItems.items.map((item) => (
                  <Box
                    key={"gift-" + item.productId}
                    sx={{
                      py: 1.75,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      spacing={0.5}
                    >
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          flex: 1,
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {item.name}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={"Hədiyyədən sil: " + item.name}
                        disabled={busy}
                        onClick={() => handleGiftQtyInput(item.product, "0")}
                        sx={{ p: 0.3, color: "text.secondary" }}
                      >
                        <CloseRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mt: 0.65 }}
                    >
                      <Typography
                        sx={{ fontSize: 11.5, color: "text.secondary" }}
                      >
                        {item.quantity} ədəd · Hədiyyə
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12, color: "text.secondary" }}
                      >
                        {formatMoney(0)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ p: 2 }}>
              {hasAnySelected && (
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1.5 }}
                >
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    Satış: {selectedItems.totalQty} ədəd
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    Hədiyyə: {selectedGiftItems.totalQty} ədəd
                  </Typography>
                </Stack>
              )}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={1}
                aria-live="polite"
                sx={{ mb: 2 }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                  Yekun məbləğ
                </Typography>
                <Typography
                  sx={{
                    fontSize: 21,
                    fontWeight: 600,
                    letterSpacing: "-0.5px",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatMoney(selectedItems.totalAmount)}
                </Typography>
              </Stack>
              {hasInvalidPrice && (
                <Alert severity="warning" sx={{ mb: 1.5, fontSize: 11.5 }}>
                  Satış qiymətləri sıfırdan böyük olmalıdır.
                </Alert>
              )}
              <Button
                fullWidth
                variant="contained"
                startIcon={<DoneAllIcon sx={{ fontSize: 18 }} />}
                disabled={
                  busy ||
                  !hasAnySelected ||
                  (selectedItems.totalQty > 0 && hasInvalidPrice)
                }
                onClick={confirmOrder}
                sx={{
                  minHeight: 42,
                  borderRadius: "8px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textTransform: "none",
                }}
              >
                {busy ? "Sifariş yazılır…" : "Satışı təsdiqlə"}
              </Button>
            </Box>
          </Card>
        </Box>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={2600}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      >
        <Alert severity={toast.type} variant="filled" sx={{ fontWeight: 900 }}>
          {toast.msg}
        </Alert>
      </Snackbar>

      <AddressMapPickerDialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        initialPosition={
          locationData.lat && locationData.lng
            ? { lat: locationData.lat, lng: locationData.lng }
            : null
        }
        onSelect={(result) => {
          setLocationData({
            lat: result.lat,
            lng: result.lng,
          });

          if (errors.location) {
            setErrors((prev) => ({ ...prev, location: "" }));
          }

          setMapOpen(false);
        }}
      />
    </Box>
  );
}

const productColumns = "minmax(100px, 1fr) 48px 76px 104px 104px";
const orderCardSx = {
  minWidth: 0,
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "none",
};

function QuantityControl({
  label,
  productName,
  value,
  disabled,
  canAdd,
  onDecrease,
  onIncrease,
  onChange,
}) {
  return (
    <Box>
      <Typography
        sx={{
          display: { xs: "block", sm: "none" },
          fontSize: 11,
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "7px",
          bgcolor: "#fff",
          px: 0.25,
          height: { xs: 38, sm: 34 },
        }}
      >
        <IconButton
          size="small"
          aria-label={label + " miqdarını azalt: " + productName}
          onClick={onDecrease}
          disabled={disabled || value <= 0}
          sx={{ p: 0.4 }}
        >
          <RemoveIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <TextField
          variant="standard"
          size="small"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]*",
            "aria-label": label + " miqdarı: " + productName,
            style: {
              textAlign: "center",
              fontSize: 12,
              padding: "6px 0",
              fontVariantNumeric: "tabular-nums",
            },
          }}
          InputProps={{ disableUnderline: true }}
          sx={{
            minWidth: 0,
            width: 42,
            "& .MuiInputBase-root": { bgcolor: "transparent" },
          }}
        />
        <IconButton
          size="small"
          aria-label={label + " miqdarını artır: " + productName}
          onClick={onIncrease}
          disabled={disabled || !canAdd}
          sx={{ p: 0.4 }}
        >
          <AddIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}