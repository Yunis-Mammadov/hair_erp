import { Box, Typography } from "@mui/material";

export default function Forbidden() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">403</Typography>
      <Typography>Bu səhifəyə giriş icazən yoxdur.</Typography>
    </Box>
  );
}
