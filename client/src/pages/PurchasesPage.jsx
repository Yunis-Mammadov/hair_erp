import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { PageLayout, PageHeader, PageCard } from "../components/WorkspaceUI";
import { ImportButton } from "../components/RecordsTools";
import { useAuth } from "../features/auth/useAuth";
import { today } from "../i18n/runtime";
import { useI18n } from "../i18n/useI18n";
import { api } from "../lib/api";
import { amountValue } from "../lib/money-input.mjs";
import { validQuantity, quantityStep, lineCents } from "../lib/quantities.mjs";

const newProductDetails = {
  categoryId: "",
  categoryName: "",
  unit: "PIECE",
  sku: "",
  barcode: "",
};

const units = ["PIECE", "BOX", "KG", "LITER"];
const maxPurchaseLines = 100;
const maxAmountCents = 9999999999;
const fieldGrid = { display: "grid", gap: 1.5, alignItems: "start" };
const twoColumns = "repeat(2, minmax(0, 1fr))";

function emptyLine() {
  return {
    key: crypto.randomUUID(),
    product: null,
    name: "",
    ...newProductDetails,
    quantity: "1",
    unitCost: "",
    salePrice: "",
  };
}

function validPrice(value) {
  return /^\d+(?:[.,]\d{1,2})?$/.test(String(value)) &&
    Math.round(amountValue(value) * 100) <= maxAmountCents;
}

function validLine(row, admin) {
  const productValid = row.product || (admin && row.name.trim() &&
    row.categoryId && (row.categoryId !== "NEW" || row.categoryName.trim()));
  return productValid && validQuantity(row.quantity, row.unit) &&
    validPrice(row.unitCost) && validPrice(row.salePrice);
}

function ProductNameField({ row, admin, busy, reload, selectedIds, onChange, autoFocus }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const search = row.product ? "" : row.name.trim();
  const current = snapshot?.search === search && snapshot.reload === reload;

  useEffect(() => {
    if (!open || busy) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/catalog/products", {
          params: { search, limit: 15 },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSnapshot({ search, reload, products: data.products, error: "" });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSnapshot({ search, reload, products: [], error: error.response?.data?.message || t("Could not load products.") });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, busy, search, reload, t]);

  const products = current ? snapshot.products : [];
  const options = row.product && !products.some((item) => item.id === row.product.id)
    ? [row.product, ...products]
    : products;
  const error = current && snapshot.error;

  return (
    <Autocomplete
      sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
      value={row.product}
      inputValue={row.name}
      options={options}
      freeSolo={admin}
      forcePopupIcon
      clearOnBlur={false}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={busy}
      loading={open && !current}
      loadingText={t("Loading...")}
      noOptionsText={t("No products found.")}
      filterOptions={(items) => items}
      getOptionLabel={(option) => typeof option === "string" ? option : option.name}
      getOptionKey={(product) => product.id}
      isOptionEqualToValue={(product, value) => product.id === value.id}
      getOptionDisabled={(product) => product.id !== row.product?.id && selectedIds.has(product.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onInputChange={(_, name, reason) => {
        if (reason === "clear") {
          onChange({ ...newProductDetails, name: "", product: null, salePrice: "" });
        }
        if (reason === "input") {
          onChange(row.product ? { name, product: null, unit: "PIECE", salePrice: "" } : { name });
        }
      }}
      onChange={(_, product) => {
        if (product && typeof product !== "string") {
          onChange({
            ...newProductDetails,
            name: product.name,
            product,
            unit: product.unit || "PIECE",
            salePrice: String(product.salePrice),
          });
        }
      }}
      renderOption={(props, product) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{product.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[product.category?.name, t(product.unit || "PIECE"), product.sku, product.barcode].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("Məhsul adı")}
          placeholder={t("Name, SKU or barcode")}
          required
          autoFocus={autoFocus}
          error={Boolean(error)}
          helperText={error || (admin && !row.product ? t("Select a product or type a new product name.") : undefined)}
          inputProps={{ ...params.inputProps, maxLength: 150 }}
        />
      )}
    />
  );
}

function PurchaseProductRow({ row, admin, busy, categories, reload, selectedIds, onChange, onRemove, autoFocus }) {
  const { t } = useI18n();
  const changeField = (field) => (event) => onChange({ [field]: event.target.value });
  const newProduct = admin && !row.product;

  return (
    <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 }, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
      {onRemove && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Tooltip title={t("Remove item")}>
            <IconButton aria-label={t("Remove item")} disabled={busy} onClick={onRemove} size="small">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Box sx={{
        ...fieldGrid,
        gridTemplateColumns: {
          xs: twoColumns,
          md: "minmax(0, 2fr) minmax(0, 0.8fr) repeat(2, minmax(0, 1fr))",
        },
      }}>
        <ProductNameField {...{ row, admin, busy, reload, selectedIds, onChange, autoFocus }} />
        <TextField
          type="number"
          label={t("Quantity")}
          value={row.quantity}
          onChange={changeField("quantity")}
          disabled={busy}
          required
          helperText={row.product ? t(row.unit) : undefined}
          slotProps={{ htmlInput: { min: quantityStep(row.unit), max: 1000000, step: quantityStep(row.unit) } }}
        />
        <TextField
          label={t("Alış qiyməti")}
          value={row.unitCost}
          onChange={changeField("unitCost")}
          disabled={busy}
          required
          slotProps={{ htmlInput: { inputMode: "decimal" } }}
        />
        <TextField
          label={t("Selling price")}
          sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
          value={row.salePrice}
          onChange={changeField("salePrice")}
          disabled={busy}
          required={admin}
          slotProps={{ input: { readOnly: !admin }, htmlInput: { inputMode: "decimal" } }}
        />
      </Box>
      {newProduct && (
        <Box sx={{ ...fieldGrid, gridTemplateColumns: { xs: twoColumns, md: "repeat(4, minmax(0, 1fr))" } }}>
          <TextField select label={t("Kateqoriya")} value={row.categoryId} onChange={changeField("categoryId")} disabled={busy} required>
            <MenuItem value="" disabled>—</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
            ))}
            <MenuItem value="NEW">+ {t("New category")}</MenuItem>
          </TextField>
          {row.categoryId === "NEW" && (
            <TextField
              label={t("Category name")}
              value={row.categoryName}
              onChange={changeField("categoryName")}
              slotProps={{ htmlInput: { maxLength: 150 } }}
              required
              disabled={busy}
            />
          )}
          <TextField select label={t("Unit")} value={row.unit} onChange={changeField("unit")} disabled={busy}>
            {units.map((unit) => <MenuItem key={unit} value={unit}>{t(unit)}</MenuItem>)}
          </TextField>
          <TextField label="SKU" value={row.sku} onChange={changeField("sku")} disabled={busy} slotProps={{ htmlInput: { maxLength: 80 } }} />
          <TextField label={t("Barkod")} value={row.barcode} onChange={changeField("barcode")} disabled={busy} slotProps={{ htmlInput: { maxLength: 80 } }} />
        </Box>
      )}
    </Stack>
  );
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const { t, money } = useI18n();
  const admin = user?.role === "ADMIN";
  const pending = useRef(false);
  const [lines, setLines] = useState(() => [emptyLine()]);
  const [categories, setCategories] = useState([]);
  const [reload, setReload] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    api.get("/catalog/categories", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setCategories(data.categories);
        setCategoriesError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategoriesError(t("Kateqoriyalar yüklənmədi."));
      });
    return () => controller.abort();
  }, [admin, reload, t]);

  const total = lines.reduce((sum, row) => {
    if (!validPrice(row.unitCost) || !validQuantity(row.quantity, row.unit)) return sum;
    return sum + lineCents(amountValue(row.unitCost), row.quantity);
  }, 0);
  const pickedIds = lines.flatMap((row) => row.product ? [row.product.id] : []);
  const selectedIds = new Set(pickedIds);
  const valid = supplier.trim() && purchaseDate && purchaseDate <= today() &&
    total <= maxAmountCents && pickedIds.length === selectedIds.size &&
    lines.every((row) => validLine(row, admin));

  function changeLine(key, values) {
    setLines((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
    setSuccess(false);
  }

  function addLine() {
    const row = emptyLine();
    setLines((current) => current.length < maxPurchaseLines ? [...current, row] : current);
    setSuccess(false);
  }

  async function save(event) {
    event.preventDefault();
    if (pending.current || !valid) return;

    pending.current = true;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await api.post("/purchases", {
        supplier,
        purchaseDate,
        invoiceNo: invoice,
        note,
        items: lines.map((row) => {
          const quantity = Number(row.quantity);
          const unitCost = amountValue(row.unitCost);
          const salePrice = amountValue(row.salePrice);
          if (row.product) return { productId: row.product.id, quantity, unitCost, salePrice };

          const { name, categoryId, categoryName, unit, sku, barcode } = row;
          return {
            quantity,
            unitCost,
            newProduct: {
              name,
              unit,
              sku,
              barcode,
              salePrice,
              ...(categoryId === "NEW" ? { categoryName } : { categoryId }),
            },
          };
        }),
      });
      setLines([emptyLine()]);
      setInvoice("");
      setNote("");
      setSuccess(true);
      setReload((count) => count + 1);
    } catch (error) {
      setError(error.response?.data?.message || t("Could not save purchase."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title={t("New purchase")}
        description={t("Receive stock and record purchase costs.")}
        actions={
          <>
            {admin && <ImportButton kind="products" onDone={() => setReload((count) => count + 1)} />}
            <Button component={RouterLink} to="/warehouse/purchases-history">{t("Purchase history")}</Button>
          </>
        }
      />
      <PageCard component="form" onSubmit={save} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          <Box sx={{
            ...fieldGrid,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: twoColumns,
              md: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.2fr)",
            },
          }}>
            <TextField label={t("Supplier")} value={supplier} onChange={(e) => setSupplier(e.target.value)} required disabled={busy} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField
              type="date"
              label={t("Purchase date")}
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
            />
            <TextField label={t("Supplier invoice (optional)")} value={invoice} onChange={(e) => setInvoice(e.target.value)} disabled={busy} slotProps={{ htmlInput: { maxLength: 100 } }} />
          </Box>
          <Divider />
          <Stack spacing={1.5}>
            <Typography component="h2" variant="h6">{t("Məhsullar")}</Typography>
            {categoriesError && !categories.length && <Alert severity="warning">{categoriesError}</Alert>}
            {lines.map((row, index) => (
              <PurchaseProductRow
                key={row.key}
                {...{ row, admin, busy, categories, reload, selectedIds }}
                autoFocus={index > 0 && index === lines.length - 1}
                onChange={(values) => changeLine(row.key, values)}
                onRemove={lines.length > 1 ? () => setLines((current) => current.filter((item) => item.key !== row.key)) : undefined}
              />
            ))}
            <Button type="button" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={addLine} disabled={busy || lines.length >= maxPurchaseLines}>
              {t("Məhsul əlavə et")}
            </Button>
          </Stack>
          <TextField
            label={t("Note (optional)")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          {success && <Alert severity="success">{t("Purchase recorded and stock updated.")}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {total > maxAmountCents && <Alert severity="error">{t("Məbləğ icazə verilən həddi aşır.")}</Alert>}
          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography variant="body2" color="text.secondary">{t("Total cost")}</Typography>
              <Typography variant="h6" component="output" sx={{ fontVariantNumeric: "tabular-nums" }}>{money(total / 100)}</Typography>
            </Box>
            <Button type="submit" variant="contained" size="large" disabled={busy || !valid}>{t(busy ? "Saving..." : "Confirm purchase")}</Button>
          </Stack>
        </Stack>
      </PageCard>
    </PageLayout>
  );
}
