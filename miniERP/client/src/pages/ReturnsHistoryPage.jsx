import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
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
} from "@mui/material";
import { api } from "../lib/api";

export default function ReturnsHistoryPage() {
  const [returnsList, setReturnsList] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
  });

  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const fetchReturns = async (page = 1, customFilters = appliedFilters) => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: pagination.limit,
      };

      if (customFilters.search) params.search = customFilters.search;
      if (customFilters.startDate) params.startDate = customFilters.startDate;
      if (customFilters.endDate) params.endDate = customFilters.endDate;

      const { data } = await api.get("/returns", { params });

      setReturnsList(data.returns || []);
      setPagination((prev) => ({
        ...prev,
        page: data.pagination?.page || 1,
        limit: data.pagination?.limit || 10,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
      }));
    } catch (error) {
      console.error("Fetch returns error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnDetail = async (id) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);

      const { data } = await api.get(`/returns/${id}`);
      setSelectedReturn(data.return || null);
    } catch (error) {
      console.error("Fetch return detail error:", error);
      setSelectedReturn(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns(1, appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setAppliedFilters(filters);
    fetchReturns(1, filters);
  };

  const handleReset = () => {
    const reset = {
      search: "",
      startDate: "",
      endDate: "",
    };

    setFilters(reset);
    setAppliedFilters(reset);
    fetchReturns(1, reset);
  };

  const handlePageChange = (_, value) => {
    fetchReturns(value, appliedFilters);
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("az-AZ");
  };

  const getItemCount = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Geri qaytarma tarixçəsi
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
          <Box display="flex" justifyContent="center" alignItems="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Qaytarma ID</TableCell>
                    <TableCell>Tarix</TableCell>
                    <TableCell>Müştəri</TableCell>
                    <TableCell>Telefon</TableCell>
                    <TableCell>Salon</TableCell>
                    <TableCell>Məhsul sayı</TableCell>
                    <TableCell>Qeyd</TableCell>
                    <TableCell>Yazan şəxs</TableCell>
                    <TableCell>Ətraflı</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {returnsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        Məlumat tapılmadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    returnsList.map((ret) => (
                      <TableRow key={ret.id} hover>
                        <TableCell>{ret.id?.slice(0, 8)}</TableCell>
                        <TableCell>{formatDate(ret.createdAt)}</TableCell>
                        <TableCell>{ret.customer?.name || "-"}</TableCell>
                        <TableCell>{ret.customer?.phone || "-"}</TableCell>
                        <TableCell>{ret.customer?.salon || "-"}</TableCell>
                        <TableCell>{getItemCount(ret.items)}</TableCell>
                        <TableCell>{ret.note || "-"}</TableCell>
                        <TableCell>
                          {ret.createdBy?.fullName || ret.createdBy?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => fetchReturnDetail(ret.id)}
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
              <Typography variant="body2">
                Ümumi: {pagination.total}
              </Typography>

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
          setSelectedReturn(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Qaytarma detalları</DialogTitle>

        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : !selectedReturn ? (
            <Typography>Məlumat tapılmadı</Typography>
          ) : (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Əsas məlumatlar
              </Typography>

              <Typography><b>ID:</b> {selectedReturn.id}</Typography>
              <Typography><b>Tarix:</b> {formatDate(selectedReturn.createdAt)}</Typography>
              <Typography><b>Qeyd:</b> {selectedReturn.note || "-"}</Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Müştəri
              </Typography>

              <Typography><b>Ad:</b> {selectedReturn.customer?.name || "-"}</Typography>
              <Typography><b>Telefon:</b> {selectedReturn.customer?.phone || "-"}</Typography>
              <Typography><b>Salon:</b> {selectedReturn.customer?.salon || "-"}</Typography>
              <Typography><b>Ünvan:</b> {selectedReturn.customer?.address || "-"}</Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Qaytarmanı yazan
              </Typography>

              <Typography>
                <b>Ad:</b>{" "}
                {selectedReturn.createdBy?.fullName ||
                  selectedReturn.createdBy?.email ||
                  "-"}
              </Typography>
              <Typography><b>Rol:</b> {selectedReturn.createdBy?.role || "-"}</Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Məhsullar
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Məhsul</TableCell>
                      <TableCell>Kateqoriya</TableCell>
                      <TableCell>Miqdar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReturn.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || "-"}</TableCell>
                        <TableCell>{item.product?.category?.name || "-"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}