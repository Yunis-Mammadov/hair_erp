import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import PersonPinCircleRoundedIcon from "@mui/icons-material/PersonPinCircleRounded";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "../lib/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const customerIcon = new L.DivIcon({
  className: "custom-live-marker",
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #f59e0b;
      border: 3px solid #fff;
      box-shadow: 0 0 0 4px rgba(245,158,11,.18);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const driverIcon = new L.DivIcon({
  className: "custom-live-marker",
  html: `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: #22c55e;
      border: 3px solid #fff;
      box-shadow: 0 0 0 6px rgba(34,197,94,.18);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitBounds({ orders, sessions }) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    for (const order of orders || []) {
      const lat = Number(order?.customer?.lat);
      const lng = Number(order?.customer?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push([lat, lng]);
      }
    }

    for (const session of sessions || []) {
      const lat = Number(session?.lat);
      const lng = Number(session?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push([lat, lng]);
      }
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    if (points.length > 1) {
      map.fitBounds(points, { padding: [50, 50] });
    }
  }, [map, orders, sessions]);

  return null;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("az-AZ");
}

function getOrderAmount(order) {
  return (order.items || []).reduce((sum, item) => {
    if (item.isGift) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0);
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ₼`;
}

export default function LiveLocationPage() {
  const [orders, setOrders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "success",
    msg: "",
  });

  const watchIdRef = useRef(null);
  const currentUserRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        currentUserRef.current = JSON.parse(raw);
      }
    } catch (e) {
      currentUserRef.current = null;
    }
  }, []);

  const isDriver = currentUserRef.current?.role === "DRIVER";
  const isAdmin = currentUserRef.current?.role === "ADMIN";

  async function fetchAll() {
    try {
      const [ordersRes, activeRes] = await Promise.all([
        api.get("/live-location/orders"),
        api.get("/live-location/active"),
      ]);

      setOrders(ordersRes.data?.orders || []);
      setSessions(activeRes.data?.sessions || []);

      const myUserId = currentUserRef.current?.id;
      const mySession = (activeRes.data?.sessions || []).find(
        (s) => s.driver?.id === myUserId && s.isActive,
      );

      setIsSharing(!!mySession);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg:
          e?.response?.data?.message || "Canlı location məlumatları alınmadı",
      });
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        await fetchAll();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const interval = setInterval(() => {
      fetchAll();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function startLiveSharing() {
    if (!navigator.geolocation) {
      setToast({
        open: true,
        type: "error",
        msg: "Bu cihazda geolocation dəstəyi yoxdur",
      });
      return;
    }

    try {
      setBusy(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            await api.post("/live-location/start", { lat, lng });
            setIsSharing(true);

            setToast({
              open: true,
              type: "success",
              msg: "Canlı paylaşım başladı",
            });

            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
            }

            watchIdRef.current = navigator.geolocation.watchPosition(
              async (pos) => {
                const nextLat = pos.coords.latitude;
                const nextLng = pos.coords.longitude;

                try {
                  await api.patch("/live-location/update", {
                    lat: nextLat,
                    lng: nextLng,
                  });
                } catch (err) {
                  console.error("watchPosition update error:", err);
                }
              },
              (geoErr) => {
                console.error("watchPosition error:", geoErr);
              },
              {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000,
              },
            );

            await fetchAll();
          } catch (e) {
            console.error(e);
            setToast({
              open: true,
              type: "error",
              msg: e?.response?.data?.message || "Canlı paylaşım başlatılmadı",
            });
          } finally {
            setBusy(false);
          }
        },
        (error) => {
          console.error(error);
          setBusy(false);
          setToast({
            open: true,
            type: "error",
            msg: "Konum icazəsi verilmədi",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    } catch (e) {
      console.error(e);
      setBusy(false);
      setToast({
        open: true,
        type: "error",
        msg: "Canlı paylaşım başladılmadı",
      });
    }
  }

  async function stopLiveSharing() {
    try {
      setBusy(true);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      await api.post("/live-location/stop");
      setIsSharing(false);

      setToast({
        open: true,
        type: "success",
        msg: "Canlı paylaşım dayandırıldı",
      });

      await fetchAll();
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        msg: e?.response?.data?.message || "Canlı paylaşım dayandırılmadı",
      });
    } finally {
      setBusy(false);
    }
  }

  const totalAmount = useMemo(() => {
    return orders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  }, [orders]);

  const mapCenter = useMemo(() => {
    const firstOrder = orders.find(
      (o) =>
        Number.isFinite(Number(o?.customer?.lat)) &&
        Number.isFinite(Number(o?.customer?.lng)),
    );

    if (firstOrder) {
      return [Number(firstOrder.customer.lat), Number(firstOrder.customer.lng)];
    }

    const firstSession = sessions.find(
      (s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)),
    );

    if (firstSession) {
      return [Number(firstSession.lat), Number(firstSession.lng)];
    }

    return [40.4093, 49.8671];
  }, [orders, sessions]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1700, mx: "auto" }}>
      <Card
        sx={{
          borderRadius: 4,
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 14px 36px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 2,
            background:
              "linear-gradient(90deg, rgba(25,118,210,.12) 0%, rgba(34,197,94,.12) 100%)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationOnRoundedIcon />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: -0.6,
                    fontSize: { xs: 28, md: 34 },
                  }}
                >
                  Canlı Location
                </Typography>
              </Stack>

              <Typography sx={{ opacity: 0.82, mt: 0.7 }}>
                Bortda olan sifariş nöqtələri və sürücünün canlı konumu
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Button
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                onClick={fetchAll}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  fontWeight: 900,
                  minWidth: 130,
                }}
              >
                Yenilə
              </Button>

              {isDriver && !isSharing && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={startLiveSharing}
                  disabled={busy}
                  sx={{
                    borderRadius: 3,
                    textTransform: "none",
                    fontWeight: 900,
                    minWidth: 180,
                  }}
                >
                  Çatdırılmaya başla
                </Button>
              )}

              {isDriver && isSharing && (
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<StopRoundedIcon />}
                  onClick={stopLiveSharing}
                  disabled={busy}
                  sx={{
                    borderRadius: 3,
                    textTransform: "none",
                    fontWeight: 900,
                    minWidth: 190,
                  }}
                >
                  Canlı paylaşımı dayandır
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        <CardContent sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.2}
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 2 }}
          >
            <Chip
              icon={<RoomRoundedIcon />}
              label={`Bortda sifariş: ${orders.length}`}
              color="warning"
              sx={{ borderRadius: 999, fontWeight: 900 }}
            />
            <Chip
              icon={<PersonPinCircleRoundedIcon />}
              label={`Aktiv sürücü: ${sessions.length}`}
              color="success"
              sx={{ borderRadius: 999, fontWeight: 900 }}
            />
            <Chip
              icon={<LocalShippingRoundedIcon />}
              label={`Toplam məbləğ: ${formatMoney(totalAmount)}`}
              color="primary"
              variant="outlined"
              sx={{ borderRadius: 999, fontWeight: 900 }}
            />
            <Chip
              label={
                isSharing
                  ? "Canlı paylaşım aktivdir"
                  : "Canlı paylaşım passivdir"
              }
              color={isSharing ? "success" : "default"}
              variant={isSharing ? "filled" : "outlined"}
              sx={{ borderRadius: 999, fontWeight: 900 }}
            />
          </Stack>

          <Box
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              height: { xs: 430, md: 600 },
              mb: 2,
            }}
          >
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FitBounds orders={orders} sessions={sessions} />

              {orders.map((order) => {
                const lat = Number(order?.customer?.lat);
                const lng = Number(order?.customer?.lng);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                return (
                  <Marker
                    key={`order-${order.id}`}
                    position={[lat, lng]}
                    icon={customerIcon}
                  >
                    <Popup>
                      <strong>{order.customer?.name || "Müştəri"}</strong>
                      <br />
                      Salon: {order.customer?.salon || "—"}
                      <br />
                      Ərazi: {order.area?.name || "—"}
                      <br />
                      Məbləğ: {formatMoney(getOrderAmount(order))}
                    </Popup>
                  </Marker>
                );
              })}

              {sessions.map((session) => {
                const lat = Number(session?.lat);
                const lng = Number(session?.lng);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                return (
                  <Marker
                    key={`session-${session.id}`}
                    position={[lat, lng]}
                    icon={driverIcon}
                  >
                    <Popup>
                      <strong>{session.driver?.fullName || "Sürücü"}</strong>
                      <br />
                      Status: canlı paylaşım aktivdir
                      <br />
                      Son yenilənmə: {formatTime(session.updatedAt)}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
              Bortda olan sifariş nöqtələri
            </Typography>

            {orders.length === 0 ? (
              <Typography sx={{ opacity: 0.75 }}>
                Hazırda “Bortda” statusunda sifariş yoxdur.
              </Typography>
            ) : (
              <Stack spacing={1.2}>
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      borderColor: "divider",
                    }}
                  >
                    <CardContent sx={{ p: 1.6 }}>
                      <Stack
                        direction={{ xs: "column", lg: "row" }}
                        justifyContent="space-between"
                        spacing={1.2}
                      >
                        <Stack spacing={0.5}>
                          <Typography sx={{ fontWeight: 900 }}>
                            {order.customer?.name || "Müştəri"} —{" "}
                            {order.customer?.salon || "—"}
                          </Typography>
                          <Typography sx={{ opacity: 0.8 }}>
                            Ərazi: {order.area?.name || "—"}
                          </Typography>
                          <Typography sx={{ opacity: 0.8 }}>
                            Ünvan: {order.customer?.address || "—"}
                          </Typography>
                        </Stack>

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Chip
                            label={formatMoney(getOrderAmount(order))}
                            color="success"
                            variant="outlined"
                            sx={{ borderRadius: 999, fontWeight: 900 }}
                          />
                          <Chip
                            label={`${order.items?.length || 0} məhsul`}
                            color="primary"
                            variant="outlined"
                            sx={{ borderRadius: 999, fontWeight: 900 }}
                          />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>

          {isAdmin && sessions.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.2}>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
                  Aktiv sürücülər
                </Typography>

                {sessions.map((session) => (
                  <Card
                    key={session.id}
                    variant="outlined"
                    sx={{ borderRadius: 3 }}
                  >
                    <CardContent sx={{ p: 1.6 }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            {session.driver?.fullName || "Sürücü"}
                          </Typography>
                          <Typography sx={{ opacity: 0.8 }}>
                            Başlama vaxtı: {formatTime(session.startedAt)}
                          </Typography>
                          <Typography sx={{ opacity: 0.8 }}>
                            Son yenilənmə: {formatTime(session.updatedAt)}
                          </Typography>
                        </Box>

                        <Chip
                          label={`Lat: ${Number(session.lat).toFixed(5)} / Lng: ${Number(
                            session.lng,
                          ).toFixed(5)}`}
                          color="success"
                          variant="outlined"
                          sx={{ borderRadius: 999, fontWeight: 900 }}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
      >
        <Alert
          severity={toast.type}
          variant="filled"
          onClose={() => setToast((p) => ({ ...p, open: false }))}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
