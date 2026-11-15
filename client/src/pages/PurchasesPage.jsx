import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  PageLayout,
  PageHeader,
  PageCard,
} from "../components/WorkspaceUI";

import CatalogPicker from "../components/CatalogPicker";
import { api } from "../lib/api";
import { amountValue } from "../lib/money-input.mjs";

import {
  validQuantity,
  quantityStep,
  lineCents,
} from "../lib/quantities.mjs";

import { today } from "../i18n/runtime";
import { useAuth } from "../features/auth/useAuth";
import { useI18n } from "../i18n/useI18n";

const blank = {
  name: "",
  categoryId: "",
  categoryName: "",
  unit: "PIECE",
  sku: "",
  barcode: "",
  salePrice: "",
};

const words = {
  Supplier: [
    "Supplier",
    "Təchizatçı",
    "Tedarikçi",
    "Поставщик",
  ],
  "Purchase date": [
    "Purchase date",
    "Alış tarixi",
    "Alış tarihi",
    "Дата закупки",
  ],
  "New category": [
    "New category",
    "Yeni kateqoriya",
    "Yeni kategori",
    "Новая категория",
  ],
  "Category name": [
    "Category name",
    "Kateqoriya adı",
    "Kategori adı",
    "Название категории",
  ],
  "Add to purchase": [
    "Add to purchase",
    "Alışa əlavə et",
    "Alışa ekle",
    "Добавить в закупку",
  ],
};

const moneyValid = (value) =>
  /^\d+(?:[.,]\d{1,2})?$/.test(String(value));

export default function PurchasesPage() {
  const { user } = useAuth();
  const { t, money, language } = useI18n();

  const label = (key) =>
    words[key]?.[
      ["en", "az", "tr", "ru"].indexOf(language)
    ] || t(key);

  const admin = user?.role === "ADMIN";

  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState({ ...blank });

  const [categories, setCategories] = useState([]);
  const [reload, setReload] = useState(0);

  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] =
    useState(today);

  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    api.get("/catalog/categories")
      .then((r) => {
        if (active) {
          setCategories(r.data.categories);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            t("Kateqoriyalar yüklənmədi."),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [reload, t]);

  const total = useMemo(
    () =>
      lines.reduce((sum, row) => {
        const cost = amountValue(row.unitCost);

        return (
          sum +
          (moneyValid(row.unitCost) &&
          validQuantity(row.quantity, row.unit)
            ? lineCents(cost, row.quantity)
            : 0)
        );
      }, 0) / 100,
    [lines],
  );

  const valid =
    supplier.trim() &&
    purchaseDate &&
    purchaseDate <= today() &&
    lines.length &&
    lines.every(
      (row) =>
        validQuantity(row.quantity, row.unit) &&
        moneyValid(row.unitCost) &&
        moneyValid(row.salePrice),
    );

  const draftValid =
    draft.name.trim() &&
    moneyValid(draft.salePrice) &&
    draft.categoryId &&
    (draft.categoryId !== "NEW" ||
      draft.categoryName.trim());

  const editDraft = (key) => (event) => {
    setDraft((old) => ({
      ...old,
      [key]: event.target.value,
    }));
  };

  function change(key, field, value) {
    setLines((old) =>
      old.map((row) =>
        row.key === key
          ? { ...row, [field]: value }
          : row,
      ),
    );
  }

  function addExisting(product) {
    if (busy) return;

    setLines((old) =>
      old.some(
        (row) => row.productId === product.id,
      )
        ? old.map((row) =>
            row.productId === product.id
              ? {
                  ...row,
                  quantity:
                    Number(row.quantity) + 1,
                }
              : row,
          )
        : [
            ...old,
            {
              key: product.id,
              productId: product.id,
              name: product.name,
              unit: product.unit || "PIECE",
              quantity: 1,
              unitCost: "",
              salePrice: product.salePrice,
            },
          ],
    );

    setSuccess(false);
  }

  function addNew() {
    if (busy || !draftValid) return;

    const {
      categoryId,
      categoryName,
      ...product
    } = draft;

    setLines((old) => [
      ...old,
      {
        key: crypto.randomUUID(),
        name: draft.name,
        unit: draft.unit,
        quantity: 1,
        unitCost: "",
        salePrice: draft.salePrice,
        newProduct: {
          ...product,
          ...(categoryId === "NEW"
            ? { categoryName }
            : { categoryId }),
        },
      },
    ]);

    setDraft({ ...blank });
    setSuccess(false);
  }

  async function save(event) {
    event.preventDefault();

    if (busy || !valid) return;

    setBusy(true);
    setError("");
    setSuccess(false);

    try {
      await api.post("/purchases", {
        supplier,
        purchaseDate,
        invoiceNo: invoice,
        note,

        items: lines.map((row) => ({
          quantity: Number(row.quantity),
          unitCost: amountValue(row.unitCost),

          ...(row.newProduct
            ? {
                newProduct: {
                  ...row.newProduct,
                  salePrice: amountValue(
                    row.salePrice,
                  ),
                },
              }
            : {
                productId: row.productId,
                salePrice: amountValue(
                  row.salePrice,
                ),
              }),
        })),
      });

      setLines([]);
      setInvoice("");
      setNote("");
      setDraft({ ...blank });
      setSuccess(true);
      setReload((old) => old + 1);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          t("Could not save purchase."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title={t("New purchase")}
        description={t(
          "Receive stock and record purchase costs.",
        )}
        actions={
          <Button
            component={RouterLink}
            to="/warehouse/purchases-history"
          >
            {t("Purchase history")}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t(
            "Purchase recorded and stock updated.",
          )}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={save}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0,1fr) 390px",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          {admin && (
            <PageCard sx={{ p: 2.5 }}>
              <Stack
                spacing={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                }}
              >
                <Typography variant="h6">
                  {t("Yeni məhsul")}
                </Typography>

                <TextField
                  label={t("Məhsul adı")}
                  value={draft.name}
                  onChange={editDraft("name")}
                  disabled={busy}
                  inputProps={{ maxLength: 150 }}
                />

                <TextField
                  select
                  label={t("Kateqoriya")}
                  value={draft.categoryId}
                  onChange={editDraft("categoryId")}
                  disabled={busy}
                >
                  <MenuItem value="">—</MenuItem>

                  {categories.map((category) => (
                    <MenuItem
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </MenuItem>
                  ))}

                  <MenuItem value="NEW">
                    + {label("New category")}
                  </MenuItem>
                </TextField>

                {draft.categoryId === "NEW" && (
                  <TextField
                    label={label("Category name")}
                    value={draft.categoryName}
                    onChange={editDraft(
                      "categoryName",
                    )}
                    disabled={busy}
                    inputProps={{
                      maxLength: 150,
                    }}
                  />
                )}

                <TextField
                  select
                  label={t("Unit")}
                  value={draft.unit}
                  onChange={editDraft("unit")}
                  disabled={busy}
                >
                  {[
                    "PIECE",
                    "BOX",
                    "KG",
                    "LITER",
                  ].map((unit) => (
                    <MenuItem
                      key={unit}
                      value={unit}
                    >
                      {t(unit)}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack
                  direction="row"
                  spacing={1}
                >
                  <TextField
                    label="SKU"
                    value={draft.sku}
                    onChange={editDraft("sku")}
                    disabled={busy}
                    inputProps={{ maxLength: 80 }}
                    fullWidth
                  />

                  <TextField
                    label={t("Barkod")}
                    value={draft.barcode}
                    onChange={editDraft("barcode")}
                    disabled={busy}
                    inputProps={{ maxLength: 80 }}
                    fullWidth
                  />
                </Stack>

                <TextField
                  label={t("Selling price")}
                  value={draft.salePrice}
                  onChange={editDraft("salePrice")}
                  disabled={busy}
                  inputProps={{
                    inputMode: "decimal",
                  }}
                />

                <Button
                  type="button"
                  variant="outlined"
                  disabled={busy || !draftValid}
                  onClick={addNew}
                >
                  {label("Add to purchase")}
                </Button>
              </Stack>
            </PageCard>
          )}

          <PageCard sx={{ p: 2.5 }}>
            <Typography variant="h6" mb={2}>
              {t("Products")}
            </Typography>

            <CatalogPicker
              disabled={busy}
              requireStock={false}
              reload={reload}
              onAdd={addExisting}
            />
          </PageCard>
        </Stack>

        <PageCard sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h6">
              {t("Purchase summary")}
            </Typography>

            <TextField
              label={label("Supplier")}
              value={supplier}
              onChange={(e) =>
                setSupplier(e.target.value)
              }
              required
              disabled={busy}
              inputProps={{ maxLength: 200 }}
            />

            <TextField
              type="date"
              label={label("Purchase date")}
              value={purchaseDate}
              onChange={(e) =>
                setPurchaseDate(e.target.value)
              }
              required
              disabled={busy}
              slotProps={{
                inputLabel: { shrink: true },
              }}
              inputProps={{ max: today() }}
            />

            <TextField
              label={t(
                "Supplier invoice (optional)",
              )}
              value={invoice}
              onChange={(e) =>
                setInvoice(e.target.value)
              }
              disabled={busy}
              inputProps={{ maxLength: 100 }}
            />

            <Stack
              spacing={2}
              divider={<Divider />}
            >
              {lines.map((row) => (
                <Stack
                  key={row.key}
                  spacing={1}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography fontWeight={600}>
                      {row.name}
                    </Typography>

                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setLines((old) =>
                          old.filter(
                            (item) =>
                              item.key !== row.key,
                          ),
                        )
                      }
                    >
                      {t("Remove item")}
                    </Button>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                  >
                    <TextField
                      label={t("Quantity")}
                      type="number"
                      value={row.quantity}
                      onChange={(e) =>
                        change(
                          row.key,
                          "quantity",
                          e.target.value,
                        )
                      }
                      disabled={busy}
                      inputProps={{
                        min: quantityStep(row.unit),
                        max: 1000000,
                        step: quantityStep(row.unit),
                      }}
                      fullWidth
                    />

                    <TextField
                      label={t("Unit cost")}
                      value={row.unitCost}
                      onChange={(e) =>
                        change(
                          row.key,
                          "unitCost",
                          e.target.value,
                        )
                      }
                      disabled={busy}
                      required
                      inputProps={{
                        inputMode: "decimal",
                      }}
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label={t("Selling price")}
                    value={row.salePrice}
                    onChange={(e) =>
                      change(
                        row.key,
                        "salePrice",
                        e.target.value,
                      )
                    }
                    disabled={busy || !admin}
                    inputProps={{
                      inputMode: "decimal",
                    }}
                  />
                </Stack>
              ))}
            </Stack>

            <TextField
              label={t("Note (optional)")}
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              disabled={busy}
              multiline
              minRows={2}
              inputProps={{ maxLength: 1000 }}
            />

            <Divider />

            <Typography variant="h6">
              {t("Total cost")}: {money(total)}
            </Typography>

            <Button
              type="submit"
              variant="contained"
              disabled={busy || !valid}
            >
              {busy
                ? t("Saving...")
                : t("Confirm purchase")}
            </Button>

            <Button
              type="button"
              disabled={busy || !lines.length}
              onClick={() => setLines([])}
            >
              {t("Clear selection")}
            </Button>
          </Stack>
        </PageCard>
      </Box>
    </PageLayout>
  );
}