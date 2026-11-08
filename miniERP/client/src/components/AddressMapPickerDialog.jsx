import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stack,
  Paper,
  CircularProgress,
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import SearchIcon from "@mui/icons-material/Search";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Leaflet marker icon fix
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [40.4093, 49.8671]; // Bakı

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onPick({ lat, lng });
    },
  });

  return null;
}

function MapController({ moveTo }) {
  const map = useMapEvents({});

  useEffect(() => {
    if (
      moveTo &&
      typeof moveTo.lat === "number" &&
      typeof moveTo.lng === "number"
    ) {
      map.setView([moveTo.lat, moveTo.lng], 16);
    }
  }, [moveTo, map]);

  return null;
}

export default function AddressMapPickerDialog({
  open,
  onClose,
  onSelect,
  initialPosition,
}) {
  const [selected, setSelected] = useState(
    initialPosition
      ? { lat: initialPosition.lat, lng: initialPosition.lng }
      : null,
  );

  const [selectedAddress, setSelectedAddress] = useState("");
  const [reverseLoading, setReverseLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [moveTo, setMoveTo] = useState(null);

  const searchAbortRef = useRef(null);
  const reverseAbortRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSelected(
        initialPosition
          ? { lat: initialPosition.lat, lng: initialPosition.lng }
          : null,
      );
      setSelectedAddress("");
      setResults([]);
      setSearch("");
      setMoveTo(
        initialPosition
          ? { lat: initialPosition.lat, lng: initialPosition.lng }
          : null,
      );
    }
  }, [open, initialPosition]);

  const center = useMemo(() => {
    if (initialPosition?.lat && initialPosition?.lng) {
      return [initialPosition.lat, initialPosition.lng];
    }
    return DEFAULT_CENTER;
  }, [initialPosition]);

  const reverseGeocode = async (lat, lng) => {
    try {
      setReverseLoading(true);

      if (reverseAbortRef.current) {
        reverseAbortRef.current.abort();
      }

      const controller = new AbortController();
      reverseAbortRef.current = controller;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await res.json();
      const address = data?.display_name || "";
      setSelectedAddress(address);
      return address;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Reverse geocode error:", error);
      }
      setSelectedAddress("");
      return "";
    } finally {
      setReverseLoading(false);
    }
  };

  const handleSearch = async () => {
    const q = search.trim();
    if (!q) return;

    try {
      setSearching(true);

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }

      const controller = new AbortController();
      searchAbortRef.current = controller;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
          q,
        )}`,
        {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Search error:", error);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Bu brauzerdə location dəstəyi yoxdur");
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setSelected({ lat, lng });
        setMoveTo({ lat, lng });

        await reverseGeocode(lat, lng);

        setGeoLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Location alınmadı");
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Xəritədən ünvan seç</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Ünvan axtar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Məs: Yasamal, Bakı"
            />

            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={searching || !search.trim()}
              startIcon={<SearchIcon />}
            >
              {searching ? "Axtarılır..." : "Axtar"}
            </Button>

            <Button
              variant="outlined"
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              startIcon={<MyLocationIcon />}
            >
              {geoLoading ? "Tapılır..." : "Mənim yerim"}
            </Button>
          </Stack>

          {results.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 180, overflow: "auto" }}>
              {results.map((r) => (
                <Box
                  key={r.place_id}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                  onClick={() => {
                    const lat = parseFloat(r.lat);
                    const lng = parseFloat(r.lon);

                    setSelected({ lat, lng });
                    setSelectedAddress(r.display_name || "");
                    setMoveTo({ lat, lng });
                    setSearch(r.display_name || "");
                    setResults([]);
                  }}
                >
                  <Typography variant="body2">{r.display_name}</Typography>
                </Box>
              ))}
            </Paper>
          )}

          <Box
            sx={{
              width: "100%",
              height: 420,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <MapContainer
              center={center}
              zoom={initialPosition ? 15 : 12}
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ClickHandler
                onPick={async ({ lat, lng }) => {
                  setSelected({ lat, lng });
                  await reverseGeocode(lat, lng);
                }}
              />
              <MapController moveTo={moveTo} />

              {selected && (
                <Marker position={[selected.lat, selected.lng]}>
                  <Popup>Seçilən nöqtə</Popup>
                </Marker>
              )}
            </MapContainer>
          </Box>

          <Box>
            <Typography variant="body2">
              Xəritədə klik et, axtarış et, ya da “Mənim yerim” seç.
            </Typography>

            {selected && (
              <Box mt={1}>
                <Typography variant="body2">
                  <b>Lat:</b> {selected.lat}
                </Typography>
                <Typography variant="body2">
                  <b>Lng:</b> {selected.lng}
                </Typography>

                {reverseLoading ? (
                  <Box mt={1} display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">Ünvan tapılır...</Typography>
                  </Box>
                ) : selectedAddress ? (
                  <Typography variant="body2" mt={1}>
                    <b>Ünvan:</b> {selectedAddress}
                  </Typography>
                ) : null}
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Bağla</Button>
        <Button
          variant="contained"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            onSelect({
              ...selected,
              address: selectedAddress,
            });
          }}
        >
          Seç
        </Button>
      </DialogActions>
    </Dialog>
  );
}
