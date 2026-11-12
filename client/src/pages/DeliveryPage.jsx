import { amountValue } from "../lib/money-input.mjs";
import { useI18n } from "../i18n/useI18n";
import { formatMoney as localeMoney, formatDate as localeDate, t } from "../i18n/runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, MenuItem, Select, Snackbar, Stack, Typography, Paper, TextField, Grid } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import { api } from "../lib/api";
const STATUS_OPTIONS = [{
  value: "IN_WAREHOUSE",
  label: "Anbardadır"
}, {
  value: "ON_BOARD",
  label: "Bortda"
}, {
  value: "DELIVERED",
  label: "Çatdırıldı"
}];
function getStatusMeta(status) {
  switch (status) {
    case "IN_WAREHOUSE":
      return {
        label: t("Anbardadır"),
        color: "error",
        icon: <WarehouseRoundedIcon sx={{
          fontSize: 16
        }} />
      };
    case "ON_BOARD":
      return {
        label: "Bortda",
        color: "warning",
        icon: <LocalShippingRoundedIcon sx={{
          fontSize: 16
        }} />
      };
    case "DELIVERED":
      return {
        label: t("Çatdırıldı"),
        color: "success",
        icon: <TaskAltRoundedIcon sx={{
          fontSize: 16
        }} />
      };
    default:
      return {
        label: t("Naməlum"),
        color: "default",
        icon: null
      };
  }
}
function getStatusSelectSx(status) {
  switch (status) {
    case "IN_WAREHOUSE":
      return {
        color: "#fff",
        bgcolor: "error.main",
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "error.main"
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "error.main"
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "error.main"
        },
        "& .MuiSelect-icon": {
          color: "#fff"
        }
      };
    case "ON_BOARD":
      return {
        color: "#111",
        bgcolor: "warning.main",
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "warning.main"
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "warning.main"
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "warning.main"
        },
        "& .MuiSelect-icon": {
          color: "#111"
        }
      };
    case "DELIVERED":
      return {
        color: "#fff",
        bgcolor: "success.main",
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "success.main"
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "success.main"
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "success.main"
        },
        "& .MuiSelect-icon": {
          color: "#fff"
        }
      };
    default:
      return {
        color: "text.primary",
        bgcolor: "background.paper"
      };
  }
}
function formatMoney(value, currency) {
  return localeMoney(value, currency);
}
function formatDate(value) {
  return localeDate(value, true);
}
function formatDateOnly(value) {
  return localeDate(value, false);
}
function calcOrderTotal(order) {
  return (order.items || []).reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + Number(item.quantity || 0) * amountValue(item.unitPrice || 0);
  }, 0);
}
function getProductsText(order) {
  return (order.items || []).map(item => {
    const prefix = item.isGift ? "🎁 " : "";
    return `${prefix}${item.product?.name || t("Məhsul")} x${item.quantity}`;
  }).join(", ");
}
function countOrdersInsideDateGroups(dateGroups = []) {
  return dateGroups.reduce((sum, dateGroup) => {
    return sum + (dateGroup.zones || []).reduce((zoneSum, zone) => {
      return zoneSum + (zone.days || []).reduce((daySum, day) => {
        return daySum + (day.areas || []).reduce((areaSum, area) => areaSum + Number(area.count || 0), 0);
      }, 0);
    }, 0);
  }, 0);
}
function DateGroupBlock({
  title,
  groups,
  savingId,
  onStatusChange,
  showDeliveredAt = false
}) {
  useI18n();
  if (!groups?.length) {
    return <Alert severity="info">{title}{t("üçün göstəriləcək sifariş yoxdur.")}</Alert>;
  }
  return <Stack spacing={2.5}>
      {groups.map(dateGroup => <Card key={dateGroup.dateKey} sx={{
      borderRadius: 4,
      border: "1px solid",
      borderColor: "divider",
      boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
      overflow: "hidden"
    }}>
          <Box sx={{
        px: 2,
        py: 1.5,
        bgcolor: "rgba(15,23,42,0.04)",
        borderBottom: "1px solid",
        borderColor: "divider"
      }}>
            <Stack direction={{
          xs: "column",
          sm: "row"
        }} justifyContent="space-between" alignItems={{
          xs: "flex-start",
          sm: "center"
        }} spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarMonthRoundedIcon />
                <Typography sx={{
              fontWeight: 900,
              fontSize: 20
            }}>
                  {formatDateOnly(dateGroup.dateValue || dateGroup.dateKey)}
                </Typography>
              </Stack>

              <Chip label={t("{value0} sifariş", {
            value0: countOrdersInsideDateGroups([dateGroup])
          })} color="primary" variant="outlined" sx={{
            fontWeight: 900,
            borderRadius: 999
          }} />
            </Stack>
          </Box>

          <Box sx={{
        p: 2
      }}>
            <Stack spacing={2.2}>
              {(dateGroup.zones || []).map(zone => <Paper key={`${dateGroup.dateKey}-${zone.zoneKey}`} variant="outlined" sx={{
            borderRadius: 4,
            overflow: "hidden",
            borderColor: zone.zoneKey === "SAHE_1" ? "primary.light" : zone.zoneKey === "SAHE_2" ? "secondary.light" : "divider"
          }}>
                  <Box sx={{
              px: 2,
              py: 1.2,
              bgcolor: zone.zoneKey === "SAHE_1" ? "rgba(25,118,210,0.08)" : zone.zoneKey === "SAHE_2" ? "rgba(156,39,176,0.08)" : "rgba(255,255,255,0.03)",
              borderBottom: "1px solid",
              borderColor: "divider"
            }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PlaceRoundedIcon sx={{
                    fontSize: 20
                  }} />
                        <Typography sx={{
                    fontWeight: 900,
                    fontSize: 18
                  }}>
                          {zone.zoneLabel}
                        </Typography>
                      </Stack>

                      <Chip size="small" label={t("{value0} sifariş", {
                  value0: countOrdersInsideDateGroups([{
                    zones: [zone]
                  }])
                })} sx={{
                  fontWeight: 900,
                  borderRadius: 999
                }} variant="outlined" />
                    </Stack>
                  </Box>

                  <Box sx={{
              p: 1.5
            }}>
                    <Stack spacing={1.8}>
                      {(zone.days || []).map(dayGroup => <Paper key={`${zone.zoneKey}-${dayGroup.routeDay}`} variant="outlined" sx={{
                  borderRadius: 3.5,
                  p: 1.5,
                  bgcolor: "#fafafa"
                }}>
                          <Stack spacing={1.5}>
                            <Stack direction={{
                      xs: "column",
                      sm: "row"
                    }} justifyContent="space-between" alignItems={{
                      xs: "flex-start",
                      sm: "center"
                    }} spacing={1}>
                              <Chip size="small" label={t("{value0} sifariş", {
                        value0: (dayGroup.areas || []).reduce((sum, area) => sum + Number(area.count || 0), 0)
                      })} color="primary" variant="outlined" sx={{
                        fontWeight: 800,
                        borderRadius: 999
                      }} />
                            </Stack>

                            {(dayGroup.areas || []).map(area => <Paper key={`${zone.zoneKey}-${dayGroup.routeDay}-${area.areaName}`} variant="outlined" sx={{
                      borderRadius: 3,
                      p: 1.25
                    }}>
                                <Stack spacing={1.25}>
                                  <Stack direction={{
                          xs: "column",
                          sm: "row"
                        }} justifyContent="space-between" alignItems={{
                          xs: "flex-start",
                          sm: "center"
                        }} spacing={1}>
                                    <Typography sx={{
                            fontWeight: 900
                          }}>
                                      {area.areaName}
                                    </Typography>

                                    <Chip size="small" label={t("{value0} sifariş", {
                            value0: area.count
                          })} color="primary" sx={{
                            fontWeight: 900,
                            borderRadius: 999
                          }} />
                                  </Stack>

                                  <Stack spacing={1}>
                                    {(area.orders || []).map(order => {
                            const statusMeta = getStatusMeta(order.deliveryStatus);
                            return <Paper key={order.id} variant="outlined" sx={{
                              borderRadius: 3,
                              p: 1.25,
                              bgcolor: order.deliveryStatus === "DELIVERED" ? "rgba(76,175,80,0.05)" : "#fff"
                            }}>
                                          <Stack spacing={1.25}>
                                            <Stack direction={{
                                  xs: "column",
                                  md: "row"
                                }} justifyContent="space-between" spacing={1.25}>
                                              <Box sx={{
                                    flex: 1
                                  }}>
                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{
                                      mb: 0.6
                                    }}>
                                                  <Chip size="small" icon={statusMeta.icon} label={t(statusMeta.label)} color={statusMeta.color} sx={{
                                        fontWeight: 900,
                                        borderRadius: 999
                                      }} />

                                                  <Chip size="small" label={t("Qaimə № {value0}", {
                                        value0: order.orderNumber ? String(order.orderNumber).padStart(5, "0") : "-"
                                      })} variant="outlined" sx={{
                                        fontWeight: 800,
                                        borderRadius: 999
                                      }} />

                                                  <Chip size="small" label={formatMoney(calcOrderTotal(order))} color="success" variant="outlined" sx={{
                                        fontWeight: 800,
                                        borderRadius: 999
                                      }} />
                                                </Stack>

                                                <Stack spacing={0.4}>
                                                  <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <PersonRoundedIcon sx={{
                                          fontSize: 16
                                        }} />
                                                    <Typography sx={{
                                          fontWeight: 800,
                                          fontSize: 14
                                        }}>
                                                      {order.customer?.name || t("Müştəri")}
                                                    </Typography>
                                                  </Stack>

                                                  <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <StoreRoundedIcon sx={{
                                          fontSize: 16
                                        }} />
                                                    <Typography sx={{
                                          fontSize: 13.5
                                        }}>
                                                      {order.customer?.salon || "—"}
                                                    </Typography>
                                                  </Stack>

                                                  <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <PhoneRoundedIcon sx={{
                                          fontSize: 16
                                        }} />
                                                    <Typography sx={{
                                          fontSize: 13.5
                                        }}>
                                                      {order.customer?.phone || "—"}
                                                    </Typography>
                                                  </Stack>

                                                  <Typography sx={{
                                        fontSize: 12.5,
                                        opacity: 0.78,
                                        mt: 0.4
                                      }}>
                                                    {getProductsText(order) || t("Məhsul yoxdur")}
                                                  </Typography>

                                                  {showDeliveredAt ? <Typography sx={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "success.main",
                                        mt: 0.25
                                      }}>{t("Çatdırılma saatı:")}{" "}
                                                      {formatDate(order.deliveredAt)}
                                                      <Stack direction="row" spacing={1} alignItems="center">
                                                        <RouteRoundedIcon sx={{
                                            fontSize: 18
                                          }} />
                                                        <Typography
                                          // sx={{ fontSize: 14, fontWeight: 700 }}
                                          >{t("Rut üzrə")}</Typography>
                                                        <Typography sx={{
                                            fontWeight: 900
                                          }}>
                                                          {dayGroup.routeDayLabel}
                                                        </Typography>
                                                      </Stack>
                                                    </Typography> : <Typography sx={{
                                        fontSize: 12.5,
                                        opacity: 0.72,
                                        mt: 0.25
                                      }}>{t("Yazılma vaxtı:")}{" "}
                                                      {formatDate(order.createdAt)}
                                                    </Typography>}
                                                </Stack>
                                              </Box>

                                              <Box sx={{
                                    minWidth: {
                                      xs: "100%",
                                      md: 180
                                    }
                                  }}>
                                                <FormControl fullWidth size="small">
                                                  <Select value={order.deliveryStatus || "IN_WAREHOUSE"} disabled={savingId === order.id} onChange={e => onStatusChange(order.id, e.target.value)} renderValue={selected => {
                                        const meta = getStatusMeta(selected);
                                        return <Stack direction="row" spacing={1} alignItems="center">
                                                          {meta.icon}
                                                          <span>
                                                            {t(meta.label)}
                                                          </span>
                                                        </Stack>;
                                      }} sx={{
                                        borderRadius: 2.5,
                                        fontWeight: 900,
                                        minWidth: 170,
                                        "&.Mui-disabled": {
                                          opacity: 0.85,
                                          WebkitTextFillColor: "inherit"
                                        },
                                        ...getStatusSelectSx(order.deliveryStatus || "IN_WAREHOUSE")
                                      }}>
                                                    {STATUS_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>
                                                          {t(option.label)}
                                                        </MenuItem>)}
                                                  </Select>
                                                </FormControl>
                                              </Box>
                                            </Stack>
                                          </Stack>
                                        </Paper>;
                          })}
                                  </Stack>
                                </Stack>
                              </Paper>)}
                          </Stack>
                        </Paper>)}
                    </Stack>
                  </Box>
                </Paper>)}
            </Stack>
          </Box>
        </Card>)}
    </Stack>;
}
export default function DeliveryPage() {
  useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [toast, setToast] = useState({
    open: false,
    type: "success",
    msg: ""
  });
  const [filters, setFilters] = useState({
    deliveredStartDate: "",
    deliveredEndDate: "",
    startTime: "",
    endTime: ""
  });
  const fetchDelivery=useCallback(async (customFilters) => {
    try {
      setLoading(true);
      const params = {};
      if (customFilters.deliveredStartDate) {
        params.deliveredStartDate = customFilters.deliveredStartDate;
      }
      if (customFilters.deliveredEndDate) {
        params.deliveredEndDate = customFilters.deliveredEndDate;
      }
      if (customFilters.startTime) {
        params.startTime = customFilters.startTime;
      }
      if (customFilters.endTime) {
        params.endTime = customFilters.endTime;
      }
      const res = await api.get("/delivery", {
        params
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || t("Çatdırılma məlumatları alınmadı")
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchDelivery({});
  }, [fetchDelivery]);
  async function handleStatusChange(orderId, deliveryStatus) {
    try {
      setSavingId(orderId);
      await api.patch(`/delivery/${orderId}/status`, {
        deliveryStatus
      });
      setToast({
        open: true,
        type: "success",
        msg: t("Status yeniləndi")
      });
      await fetchDelivery(filters);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || t("Status dəyişdirilmədi")
      });
    } finally {
      setSavingId("");
    }
  }
  function applyDeliveredFilters() {
    fetchDelivery(filters);
  }
  function resetDeliveredFilters() {
    const next = {
      deliveredStartDate: "",
      deliveredEndDate: "",
      startTime: "",
      endTime: ""
    };
    setFilters(next);
    fetchDelivery(next);
  }
  const summary = data?.summary || {
    totalOrders: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    inWarehouse: 0,
    onBoard: 0
  };
  const activeGroupedByDate = data?.activeGroupedByDate || [];
  const deliveredGroupedByDate = data?.deliveredGroupedByDate || [];
  const deliveredAreaSummary = useMemo(()=>data?.deliveredAreaSummary || [],[data?.deliveredAreaSummary]);
  const deliveredAreaTotal = useMemo(() => {
    return deliveredAreaSummary.reduce((sum, item) => sum + Number(item.count || 0), 0);
  }, [deliveredAreaSummary]);
  if (loading) {
    return <Box sx={{
      p: 4,
      display: "flex",
      justifyContent: "center"
    }}>
        <CircularProgress />
      </Box>;
  }
  return <Box sx={{
    p: {
      xs: 1.5,
      sm: 2,
      md: 3
    },
    maxWidth: 1800,
    mx: "auto",
    bgcolor: "#f8fafc",
    minHeight: "100vh"
  }}>
      <Card sx={{
      borderRadius: 5,
      mb: 2.5,
      border: "1px solid",
      borderColor: "divider",
      boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
      background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 60%, rgba(241,245,249,1) 100%)"
    }}>
        <CardContent sx={{
        p: {
          xs: 2,
          md: 2.8
        }
      }}>
          <Stack direction={{
          xs: "column",
          lg: "row"
        }} justifyContent="space-between" alignItems={{
          xs: "flex-start",
          lg: "center"
        }} spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <RouteRoundedIcon />
                <Typography variant="h4" sx={{
                fontWeight: 900,
                letterSpacing: -0.8,
                fontSize: {
                  xs: 28,
                  md: 34
                }
              }}>{t("Çatdırılma")}</Typography>
              </Stack>

              <Typography sx={{
              opacity: 0.78,
              mt: 0.7
            }}>{t("Günlük, sahə, rut və ərazi üzrə logistika paneli")}</Typography>
            </Box>

            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => fetchDelivery(filters)} sx={{
            borderRadius: 3,
            textTransform: "none",
            fontWeight: 900,
            minWidth: 140
          }}>{t("Yenilə")}</Button>
          </Stack>

          <Divider sx={{
          my: 2
        }} />

          <Grid container spacing={1.4}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper variant="outlined" sx={{
              p: 1.6,
              borderRadius: 4,
              height: "100%"
            }}>
                <Typography color="text.secondary" variant="body2">{t("Toplam sifariş")}</Typography>
                <Typography sx={{
                fontWeight: 900,
                fontSize: 28
              }}>
                  {summary.totalOrders}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Paper variant="outlined" sx={{
              p: 1.6,
              borderRadius: 4,
              height: "100%"
            }}>
                <Typography color="text.secondary" variant="body2">{t("Aktiv sifariş")}</Typography>
                <Typography sx={{
                fontWeight: 900,
                fontSize: 28
              }}>
                  {summary.activeOrders}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Paper variant="outlined" sx={{
              p: 1.6,
              borderRadius: 4,
              height: "100%"
            }}>
                <Typography color="text.secondary" variant="body2">{t("Anbardadır")}</Typography>
                <Typography sx={{
                fontWeight: 900,
                fontSize: 28,
                color: "error.main"
              }}>
                  {summary.inWarehouse}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Paper variant="outlined" sx={{
              p: 1.6,
              borderRadius: 4,
              height: "100%"
            }}>
                <Typography color="text.secondary" variant="body2">{t("Bortda")}</Typography>
                <Typography sx={{
                fontWeight: 900,
                fontSize: 28,
                color: "warning.main"
              }}>
                  {summary.onBoard}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Paper variant="outlined" sx={{
              p: 1.6,
              borderRadius: 4,
              height: "100%"
            }}>
                <Typography color="text.secondary" variant="body2">{t("Çatdırılıb")}</Typography>
                <Typography sx={{
                fontWeight: 900,
                fontSize: 28,
                color: "success.main"
              }}>
                  {summary.deliveredOrders}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Stack spacing={2.8}>
        <Card sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)"
      }}>
          <CardContent sx={{
          p: {
            xs: 2,
            md: 2.4
          }
        }}>
            <Stack direction={{
            xs: "column",
            md: "row"
          }} justifyContent="space-between" alignItems={{
            xs: "flex-start",
            md: "center"
          }} spacing={1.25} sx={{
            mb: 1.5
          }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalShippingRoundedIcon />
                <Typography sx={{
                fontWeight: 900,
                fontSize: 22
              }}>{t("Aktiv çatdırılmalar")}</Typography>
              </Stack>

              <Chip label={t("{value0} aktiv sifariş", {
              value0: summary.activeOrders
            })} color="primary" sx={{
              fontWeight: 900,
              borderRadius: 999
            }} />
            </Stack>

            <Divider sx={{
            mb: 2
          }} />

            <DateGroupBlock title={t("Aktiv çatdırılmalar")} groups={activeGroupedByDate} savingId={savingId} onStatusChange={handleStatusChange} showDeliveredAt={false} />
          </CardContent>
        </Card>

        <Card sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)"
      }}>
          <CardContent sx={{
          p: {
            xs: 2,
            md: 2.4
          }
        }}>
            <Stack spacing={2}>
              <Stack direction={{
              xs: "column",
              md: "row"
            }} justifyContent="space-between" alignItems={{
              xs: "flex-start",
              md: "center"
            }} spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography sx={{
                  fontWeight: 900,
                  fontSize: 22
                }}>{t("Çatdırılmışlar")}</Typography>
                </Stack>

                <Chip label={t("{value0} çatdırılmış sifariş", {
                value0: summary.deliveredOrders
              })} color="success" sx={{
                fontWeight: 900,
                borderRadius: 999
              }} />
              </Stack>

              <Paper variant="outlined" sx={{
              p: 2,
              borderRadius: 4,
              bgcolor: "#f8fafc"
            }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FilterAltRoundedIcon />
                    <Typography sx={{
                    fontWeight: 900
                  }}>{t("Delivered filter")}</Typography>
                  </Stack>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={3}>
                      <TextField fullWidth type="date" label={t("İlk tarix")} value={filters.deliveredStartDate} onChange={e => setFilters(prev => ({
                      ...prev,
                      deliveredStartDate: e.target.value
                    }))} InputLabelProps={{
                      shrink: true
                    }} />
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <TextField fullWidth type="date" label={t("Son tarix")} value={filters.deliveredEndDate} onChange={e => setFilters(prev => ({
                      ...prev,
                      deliveredEndDate: e.target.value
                    }))} InputLabelProps={{
                      shrink: true
                    }} />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <TextField fullWidth type="time" label={t("Start time")} value={filters.startTime} onChange={e => setFilters(prev => ({
                      ...prev,
                      startTime: e.target.value
                    }))} InputLabelProps={{
                      shrink: true
                    }} />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <TextField fullWidth type="time" label={t("End time")} value={filters.endTime} onChange={e => setFilters(prev => ({
                      ...prev,
                      endTime: e.target.value
                    }))} InputLabelProps={{
                      shrink: true
                    }} />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <Stack direction="row" spacing={1}>
                        <Button fullWidth variant="contained" onClick={applyDeliveredFilters}>{t("Axtar")}</Button>

                        <Button variant="outlined" onClick={resetDeliveredFilters}>{t("Sıfırla")}</Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{
              p: 2,
              borderRadius: 4
            }}>
                <Stack spacing={1.4}>
                  <Stack direction={{
                  xs: "column",
                  md: "row"
                }} justifyContent="space-between" alignItems={{
                  xs: "flex-start",
                  md: "center"
                }} spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PlaceRoundedIcon />
                      <Typography sx={{
                      fontWeight: 900
                    }}>{t("Ərazi üzrə ümumi say")}</Typography>
                    </Stack>

                    <Chip label={t("Toplam: {value0}", {
                    value0: deliveredAreaTotal
                  })} color="success" variant="outlined" sx={{
                    fontWeight: 900,
                    borderRadius: 999
                  }} />
                  </Stack>

                  {deliveredAreaSummary.length === 0 ? <Alert severity="info">{t("Seçilmiş filter üzrə çatdırılmış sifariş tapılmadı")}</Alert> : <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {deliveredAreaSummary.map(item => <Chip key={item.areaName} label={`${item.areaName}: ${item.count}`} color="success" sx={{
                    fontWeight: 900,
                    borderRadius: 999
                  }} />)}
                    </Stack>}
                </Stack>
              </Paper>

              <Divider />

              <DateGroupBlock title={t("Çatdırılmışlar")} groups={deliveredGroupedByDate} savingId={savingId} onStatusChange={handleStatusChange} showDeliveredAt={true} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Snackbar open={toast.open} autoHideDuration={2500} onClose={() => setToast(prev => ({
      ...prev,
      open: false
    }))}>
        <Alert severity={toast.type} variant="filled" onClose={() => setToast(prev => ({
        ...prev,
        open: false
      }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>;
}
