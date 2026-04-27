import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Stack,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { pinLogin } from "../features/auth/authApi";
import { useAuth } from "../features/auth/useAuth";

function getDefaultRouteByRole(role) {
  switch (role) {
    case "ADMIN":
      return "/";
    case "EXPEDITOR":
      return "/exp/sales";
    case "WAREHOUSE":
      return "/warehouse/stock";
    case "DRIVER":
      return "/driver/deliveries";
    default:
      return "/";
  }
}

export default function Login() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!pin.trim()) {
      alert("PIN daxil edin");
      return;
    }

    setLoading(true);

    try {
      const data = await pinLogin(pin);

      if (!data?.token) {
        alert("Token gəlmədi");
        return;
      }

      if (!data?.user) {
        alert("User məlumatı gəlmədi");
        return;
      }

      login(data.token, data.user);

      const nextRoute = getDefaultRouteByRole(data.user.role);
      navigate(nextRoute, { replace: true });
    } catch (err) {
      console.error("LOGIN_ERROR:", err);
      alert(err?.response?.data?.message || "PIN səhvdir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, md: 4 },
        background:
          "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.16) 0, transparent 28%), radial-gradient(circle at 90% 10%, rgba(185,28,28,0.34) 0, transparent 30%), linear-gradient(135deg, #030303 0%, #0f0f10 42%, #1a0505 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.15))",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          bgcolor: "rgba(220,38,38,0.18)",
          filter: "blur(70px)",
          right: -120,
          bottom: -120,
        }}
      />

      <Box
        sx={{
          width: "100%",
          maxWidth: 1100,
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
          gap: { xs: 3, md: 4 },
          alignItems: "center",
        }}
      >
        <Box sx={{ color: "white", display: { xs: "none", md: "block" } }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Nanoplastica.az"
            sx={{
              width: 280,
              mb: 4,
              filter: "drop-shadow(0 14px 32px rgba(0,0,0,0.55))",
            }}
          />

          <Typography
            sx={{
              fontSize: 15,
              color: "rgba(255,255,255,0.62)",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              mb: 1.2,
            }}
          >
            Internal Management System
          </Typography>

          <Typography
            sx={{
              fontSize: { md: 54, lg: 64 },
              lineHeight: 0.95,
              letterSpacing: -2.4,
              fontWeight: 950,
              maxWidth: 620,
            }}
          >
            Satış, anbar və çatdırılma bir paneldə.
          </Typography>

          <Typography
            sx={{
              mt: 2.2,
              maxWidth: 520,
              color: "rgba(255,255,255,0.68)",
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            Nanoplastica.az komandası üçün hazırlanmış sürətli PIN girişli ERP
            sistemi.
          </Typography>

          <Stack direction="row" spacing={1.2} sx={{ mt: 4 }}>
            <FeatureChip icon={<VerifiedUserOutlinedIcon />} text="PIN giriş" />
            <FeatureChip icon={<Inventory2OutlinedIcon />} text="Anbar" />
            <FeatureChip icon={<LocalShippingOutlinedIcon />} text="Rutlar" />
          </Stack>
        </Box>

        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 460,
            mx: "auto",
            p: { xs: 3, sm: 4 },
            borderRadius: 6,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(22px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 30px 90px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <Stack alignItems="center" sx={{ mb: 3 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="Nanoplastica.az"
              sx={{
                display: { xs: "block", md: "none" },
                width: 230,
                mb: 3,
                bgcolor: "#050505",
                borderRadius: 3,
                p: 1.5,
              }}
            />

            <Box
              sx={{
                width: 62,
                height: 62,
                borderRadius: "22px",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #111827 0%, #7f1d1d 100%)",
                color: "white",
                boxShadow: "0 18px 40px rgba(127,29,29,0.35)",
                mb: 2,
              }}
            >
              <LockRoundedIcon />
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 950,
                letterSpacing: -1,
                color: "#111827",
                textAlign: "center",
              }}
            >
              Sistemə giriş
            </Typography>

            <Typography
              sx={{
                mt: 0.8,
                color: "text.secondary",
                textAlign: "center",
                fontSize: 14,
              }}
            >
              Davam etmək üçün şəxsi PIN kodunuzu daxil edin.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="PIN kod"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              fullWidth
              autoFocus
              type="password"
              inputProps={{
                inputMode: "numeric",
                maxLength: 8,
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 4,
                  bgcolor: "#F8FAFC",
                  fontWeight: 800,
                  letterSpacing: 2,
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              endIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <ArrowForwardRoundedIcon />
                )
              }
              sx={{
                py: 1.35,
                borderRadius: 4,
                textTransform: "none",
                fontWeight: 950,
                fontSize: 16,
                background: "linear-gradient(135deg, #111827 0%, #7f1d1d 100%)",
                boxShadow: "0 18px 36px rgba(127,29,29,0.28)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #030712 0%, #991b1b 100%)",
                },
              }}
            >
              {loading ? "Yoxlanır..." : "Daxil ol"}
            </Button>
          </Box>

          <Typography
            sx={{
              mt: 3,
              textAlign: "center",
              fontSize: 12.5,
              color: "text.secondary",
            }}
          >
            Nanoplastica.az · Revive Hair Professional
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

function FeatureChip({ icon, text }) {
  return (
    <Stack
      direction="row"
      spacing={0.8}
      alignItems="center"
      sx={{
        px: 1.4,
        py: 1,
        borderRadius: 999,
        color: "white",
        border: "1px solid rgba(255,255,255,0.18)",
        bgcolor: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
        fontWeight: 800,
        fontSize: 13,
      }}
    >
      {icon}
      <Box component="span">{text}</Box>
    </Stack>
  );
}
