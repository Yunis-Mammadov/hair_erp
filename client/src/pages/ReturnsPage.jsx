import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  MenuItem,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

function getCustomerLabel(customer) {
  if (!customer) return "";
  return `${customer.name || ""}${customer.phone ? ` - ${customer.phone}` : ""}${
    customer.salon ? ` - ${customer.salon}` : ""
  }`;
}

export default function ReturnsPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [pageLoading, setPageLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [customerDetail, setCustomerDetail] = useState(null);
  const [selectedMap, setSelectedMap] = useState({});

  const [toast, setToast] = useState({
    open: false,
    type: "success",
    msg: "",
  });

  const [warningModal, setWarningModal] = useState({
    open: false,
    message: "",
  });

  const RETURN_REASONS = [
    "Məhsulla bağlı problem",
    "Ödənişlərin gecikməsi",
    "Salon bağlanır",
    "Digər",
  ];

  const noteRequired =
    returnReason === "Məhsulla bağlı problem" || returnReason === "Digər";

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setPageLoading(true);
      const res = await api.get("/customers");
      setCustomers(res.data?.customers || []);
    } catch (error) {
      console.error("Fetch customers error:", error);
      setToast({
        open: true,
        type: "error",
        msg: error?.response?.data?.message || "Müştərilər yüklənmədi",
      });
    } finally {
      setPageLoading(false);
    }
  };

  const fetchCustomerHistory = async (id) => {
    if (!id) {
      setCustomerDetail(null);
      setSelectedMap({});
      return;
    }

    try {
      setCustomerLoading(true);
      const res = await api.get(`/customers/${id}`);
      setCustomerDetail(res.data?.customer || null);
      setSelectedMap({});
    } catch (error) {
      console.error("Fetch customer detail error:", error);
      setCustomerDetail(null);
      setSelectedMap({});
      setToast({
        open: true,
        type: "error",
        msg: error?.response?.data?.message || "Müştəri tarixçəsi yüklənmədi",
      });
    } finally {
      setCustomerLoading(false);
    }
  };

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === customerId) || null;
  }, [customers, customerId]);

  const aggregatedProducts = useMemo(() => {
    if (!customerDetail) return [];

    const orderedMap = {};
    const soldByPaymentMap = {};
    const returnedMap = {};

    const orders = customerDetail.orders || [];
    const payments = customerDetail.payments || [];
    const returns = customerDetail.returns || [];

    for (const order of orders) {
      for (const item of order.items || []) {
        const productId = item.productId;
        if (!productId || item.isGift) continue;

        if (!orderedMap[productId]) {
          orderedMap[productId] = {
            productId,
            productName: item.product?.name || "-",
            categoryName: item.product?.category?.name || "-",
            totalQty: 0,
            lastUnitPrice: Number(item.unitPrice || 0),
          };
        }

        orderedMap[productId].totalQty += Number(item.quantity || 0);

        if (Number(item.unitPrice || 0) > 0) {
          orderedMap[productId].lastUnitPrice = Number(item.unitPrice || 0);
        }
      }
    }

    for (const payment of payments) {
      for (const soldItem of payment.soldItems || []) {
        const productId = soldItem.productId;
        if (!productId) continue;

        soldByPaymentMap[productId] =
          (soldByPaymentMap[productId] || 0) + Number(soldItem.quantity || 0);
      }
    }

    for (const ret of returns) {
      for (const item of ret.items || []) {
        const productId = item.productId;
        if (!productId) continue;

        returnedMap[productId] =
          (returnedMap[productId] || 0) + Number(item.quantity || 0);
      }
    }

    const merged = Object.values(orderedMap)
      .map((product) => {
        const soldQty = soldByPaymentMap[product.productId] || 0;
        const returnedQty = returnedMap[product.productId] || 0;

        const returnableQty = Math.max(
          Number(product.totalQty || 0) -
            Number(soldQty || 0) -
            Number(returnedQty || 0),
          0,
        );

        const selectedQty = selectedMap[product.productId] || 0;

        return {
          ...product,
          soldQty,
          returnedQty,
          returnableQty,
          selectedQty: Math.min(selectedQty, returnableQty),
        };
      })
      .filter((item) => item.totalQty > 0);

    merged.sort((a, b) => a.productName.localeCompare(b.productName, "az"));
    return merged;
  }, [customerDetail, selectedMap]);

  const selectedItems = useMemo(() => {
    return aggregatedProducts
      .filter((item) => (selectedMap[item.productId] || 0) > 0)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(selectedMap[item.productId] || 0),
      }));
  }, [aggregatedProducts, selectedMap]);

  const totalSelectedQty = useMemo(() => {
    return selectedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
  }, [selectedItems]);

  const totalSelectedAmount = useMemo(() => {
    return aggregatedProducts.reduce((sum, item) => {
      const qty = Number(selectedMap[item.productId] || 0);
      return sum + qty * Number(item.lastUnitPrice || 0);
    }, 0);
  }, [aggregatedProducts, selectedMap]);

  const changeQty = (productId, nextQty, maxQty) => {
    const safeQty = Math.max(
      0,
      Math.min(Number(nextQty || 0), Number(maxQty || 0)),
    );

    setSelectedMap((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
  };

  const increaseQty = (productId, maxQty) => {
    const current = selectedMap[productId] || 0;
    changeQty(productId, current + 1, maxQty);
  };

  const decreaseQty = (productId, maxQty) => {
    const current = selectedMap[productId] || 0;
    changeQty(productId, current - 1, maxQty);
  };

  const setMaxQty = (productId, maxQty) => {
    changeQty(productId, maxQty, maxQty);
  };

  const resetForm = () => {
    setCustomerId("");
    setCustomerSearch("");
    setNote("");
    setReturnReason("");
    setCustomerDetail(null);
    setSelectedMap({});
  };

  const handleCustomerChange = async (value) => {
    setCustomerId(value);
    setReturnReason("");
    setNote("");
    await fetchCustomerHistory(value);
  };

  const handleSubmit = async () => {
    if (!customerId) {
      setToast({
        open: true,
        type: "error",
        msg: "Müştəri seçilməlidir",
      });
      return;
    }

    if (selectedItems.length === 0) {
      setToast({
        open: true,
        type: "error",
        msg: "Ən azı 1 məhsul üçün qaytarma miqdarı seçilməlidir",
      });
      return;
    }

    if (!returnReason) {
      setToast({
        open: true,
        type: "error",
        msg: "Qaytarma səbəbi seçilməlidir",
      });
      return;
    }

    if (noteRequired && !note.trim()) {
      setToast({
        open: true,
        type: "error",
        msg: "Qeyd hissəsini doldur",
      });
      return;
    }

    try {
      setSubmitLoading(true);

      const payload = {
        customerId,
        note: returnReason + (note?.trim() ? ` - ${note.trim()}` : ""),
        items: selectedItems,
      };

      const res = await api.post("/returns", payload);

      setToast({
        open: true,
        type: "success",
        msg: `Qaytarma yazıldı: ${res.data?.returnDoc?.id?.slice(0, 8) || "OK"}…`,
      });

      await fetchCustomerHistory(customerId);
      setSelectedMap({});
      setReturnReason("");
      setNote("");
    } catch (error) {
      console.error("Create return error:", error);

      const errorMessage =
        error?.response?.data?.message || "Qaytarma zamanı xəta baş verdi";

      setWarningModal({
        open: true,
        message: errorMessage,
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Geri qaytarma
        </Typography>

        <Button
          variant="outlined"
          onClick={() => navigate("/exp/returns-history")}
        >
          Qaytarma tarixçəsi
        </Button>
      </Stack>

      <Paper sx={{ p: 3 }}>
        {pageLoading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            <Autocomplete
              options={customers}
              value={selectedCustomer}
              inputValue={customerSearch}
              onInputChange={(_, newInputValue) => {
                setCustomerSearch(newInputValue);
              }}
              onChange={(_, newValue) => {
                handleCustomerChange(newValue?.id || "");
              }}
              getOptionLabel={(option) => getCustomerLabel(option)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase();

                if (!q) return options;

                return options.filter((customer) => {
                  const name = customer?.name?.toLowerCase() || "";
                  const phone = customer?.phone?.toLowerCase() || "";
                  const salon = customer?.salon?.toLowerCase() || "";

                  return (
                    name.includes(q) || phone.includes(q) || salon.includes(q)
                  );
                });
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Stack spacing={0.25}>
                    <Typography fontWeight={700}>
                      {option.name || "-"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[option.phone, option.salon].filter(Boolean).join(" • ")}
                    </Typography>
                  </Stack>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Müştəri axtar və seç"
                  placeholder="Ad, telefon və ya salon yaz..."
                  fullWidth
                />
              )}
              noOptionsText="Uyğun müştəri tapılmadı"
              fullWidth
            />

            {customerId && (
              <TextField
                select
                label="Qaytarma səbəbi"
                value={returnReason}
                onChange={(e) => {
                  const value = e.target.value;
                  setReturnReason(value);

                  const willRequireNote =
                    value === "Məhsulla bağlı problem" || value === "Digər";

                  if (!willRequireNote) {
                    setNote("");
                  }
                }}
                fullWidth
              >
                {RETURN_REASONS.map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {customerId && noteRequired && (
              <TextField
                label="Qeyd"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                required
                helperText="Bu səbəb üçün qeyd yazmaq məcburidir"
              />
            )}

            <Divider />

            {!customerId ? (
              <Typography color="text.secondary">
                Məhsulları görmək üçün əvvəlcə müştəri seç.
              </Typography>
            ) : customerLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : !customerDetail ? (
              <Typography color="error">
                Müştəri tarixçəsi yüklənmədi.
              </Typography>
            ) : aggregatedProducts.length === 0 ? (
              <Typography color="text.secondary">
                Bu müştərinin məhsulu tapılmadı.
              </Typography>
            ) : (
              <>
                <Box>
                  <Typography variant="h6" fontWeight={700} mb={1}>
                    Müştəri məhsulları
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Qaytara bilir = ümumi məhsul - mədaxildə satılan sayı -
                    əvvəl qaytarılan sayı.
                  </Typography>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Məhsul</TableCell>
                        <TableCell>Kateqoriya</TableCell>
                        <TableCell align="center">Təxmini qiymət</TableCell>
                        <TableCell align="center">Ümumi məhsul</TableCell>
                        <TableCell align="center">Satılan sayı</TableCell>
                        <TableCell align="center">Qaytarılıb</TableCell>
                        <TableCell align="center">Qaytara bilir</TableCell>
                        <TableCell align="center">Bu dəfə qaytar</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {aggregatedProducts.map((item) => {
                        const disabled = item.returnableQty <= 0;

                        return (
                          <TableRow key={item.productId} hover>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.categoryName}</TableCell>
                            <TableCell align="center">
                              {formatMoney(item.lastUnitPrice)}
                            </TableCell>
                            <TableCell align="center">
                              {item.totalQty}
                            </TableCell>
                            <TableCell align="center">{item.soldQty}</TableCell>
                            <TableCell align="center">
                              {item.returnedQty}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={item.returnableQty}
                                color={
                                  item.returnableQty > 0 ? "primary" : "default"
                                }
                                size="small"
                              />
                            </TableCell>

                            <TableCell align="center">
                              <Stack
                                direction="row"
                                spacing={1}
                                justifyContent="center"
                                alignItems="center"
                              >
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    decreaseQty(
                                      item.productId,
                                      item.returnableQty,
                                    )
                                  }
                                  disabled={disabled || item.selectedQty <= 0}
                                >
                                  <RemoveIcon fontSize="small" />
                                </IconButton>

                                <TextField
                                  type="number"
                                  size="small"
                                  value={item.selectedQty}
                                  onChange={(e) =>
                                    changeQty(
                                      item.productId,
                                      e.target.value,
                                      item.returnableQty,
                                    )
                                  }
                                  disabled={disabled}
                                  sx={{ width: 90 }}
                                  inputProps={{
                                    min: 0,
                                    max: item.returnableQty,
                                  }}
                                />

                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    increaseQty(
                                      item.productId,
                                      item.returnableQty,
                                    )
                                  }
                                  disabled={
                                    disabled ||
                                    item.selectedQty >= item.returnableQty
                                  }
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>

                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setMaxQty(
                                      item.productId,
                                      item.returnableQty,
                                    )
                                  }
                                  disabled={disabled}
                                >
                                  Max
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography fontWeight={700}>
                      Seçilən məhsul növü: {selectedItems.length}
                    </Typography>
                    <Typography color="text.secondary">
                      Ümumi qaytarılacaq say: {totalSelectedQty}
                    </Typography>
                    <Typography color="text.secondary">
                      Borcdan düşəcək təxmini məbləğ:{" "}
                      {formatMoney(totalSelectedAmount)}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      onClick={resetForm}
                      disabled={submitLoading}
                    >
                      Sıfırla
                    </Button>

                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={submitLoading || selectedItems.length === 0}
                    >
                      {submitLoading ? "Yazılır..." : "Qaytarmanı yaz"}
                    </Button>
                  </Stack>
                </Stack>
              </>
            )}

            {toast.open && (
              <Typography
                color={toast.type === "error" ? "error" : "success.main"}
                fontWeight={600}
              >
                {toast.msg}
              </Typography>
            )}
          </Stack>
        )}
      </Paper>

      <Dialog
        open={warningModal.open}
        onClose={() => setWarningModal({ open: false, message: "" })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: "warning.dark" }}>
          Diqqət
        </DialogTitle>

        <DialogContent>
          <Alert severity="warning" sx={{ fontSize: 16, fontWeight: 600 }}>
            {warningModal.message}
          </Alert>

          <Typography mt={2} color="text.secondary">
            Mədaxildə satılmış kimi qeyd olunan məhsullar geri qaytarıla bilməz.
            Yalnız borcda qalan məhsul miqdarı qaytarıla bilər.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            color="warning"
            onClick={() => setWarningModal({ open: false, message: "" })}
          >
            Başa düşdüm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
