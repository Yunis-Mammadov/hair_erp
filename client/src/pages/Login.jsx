import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { pinLogin } from "../features/auth/authApi";

export default function Login() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await pinLogin(pin);
      localStorage.setItem("token", data.token);
      navigate("/", { replace: true });
    } catch (err) {
      alert("PIN səhvdir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Hair ERP — Login
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            fullWidth
            inputProps={{ inputMode: "numeric" }}
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? "Yoxlanır..." : "Daxil ol"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
