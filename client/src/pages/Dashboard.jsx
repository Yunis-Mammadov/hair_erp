import { Box, Button, Typography } from "@mui/material";
import { useAuth } from "../features/auth/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Dashboard</Typography>
      <Typography sx={{ mt: 1 }}>
        User: {user?.fullName} — Role: {user?.role}
      </Typography>

      <Button sx={{ mt: 2 }} variant="outlined" onClick={logout}>
        Çıxış
      </Button>
    </Box>
  );
}