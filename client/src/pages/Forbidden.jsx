import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { Box, Typography } from "@mui/material";
export default function Forbidden() {
  useI18n();
  return <Box sx={{
    p: 3
  }}>
      <Typography variant="h4">403</Typography>
      <Typography>{t("Bu səhifəyə giriş icazən yoxdur.")}</Typography>
    </Box>;
}
