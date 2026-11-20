import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import HeadsetMicOutlined from "@mui/icons-material/HeadsetMicOutlined";
import { Link as RouterLink } from "react-router-dom";
import LanguagePicker from "../i18n/LanguagePicker";
import { useI18n } from "../i18n/useI18n";

const footerLinks = [
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/refunds", "Refund policy"],
  ["/support", "Support"],
];

const headerAction = {
  minHeight: 40,
  px: { xs: 1.5, sm: 1.8 },
  borderRadius: "11px",
  fontWeight: 700,
  lineHeight: 1.25,
};

export default function PublicLayout({ children }) {
  const { t } = useI18n();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f7f9fd", display: "flex", flexDirection: "column" }}>
      <Box component="header" sx={{ bgcolor: "white", borderBottom: "1px solid", borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: { xs: 0.9, sm: 1.8 },
            minHeight: { xs: 64, sm: 76 }, py: 1,
          }}>
            <Box
              component={RouterLink}
              to="/"
              aria-label="z-Index"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.85, mr: "auto", color: "#172138", textDecoration: "none", fontWeight: 780, fontSize: 24, letterSpacing: "-0.8px" }}
            >
              <Box component="img" src="/brand-icon.svg" alt="" width={30} height={30} />
              <span>Index<Box component="span" sx={{ color: "#3155e7" }}>.</Box></span>
            </Box>
            <LanguagePicker showLabel />
            <Stack component="nav" direction="row" useFlexGap sx={{
              alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 0.75,
              flexBasis: { xs: "100%", sm: "auto" },
            }}>
              <Button component={RouterLink} to="/support" startIcon={<HeadsetMicOutlined />}
                sx={{ ...headerAction, color: "#34436a", bgcolor: "#f0f4fd", "&:hover": { bgcolor: "#e3ebff" } }}>
                {t("Support")}
              </Button>
              <Button component={RouterLink} to="/login" variant="contained" endIcon={<ArrowForwardRounded />}
                sx={{ ...headerAction, bgcolor: "#1a2a52", "&:hover": { bgcolor: "#284280" } }}>
                {t("Sign in")}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, flex: 1 }}>{children}</Container>
      <Container component="footer" maxWidth="lg" sx={{ py: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Typography variant="caption" color="text.secondary">z-Index · {t("Stock, sales and customer balances.")}</Typography>
          <Stack direction="row" flexWrap="wrap">
            {footerLinks.map(([to, label]) => <Button key={to} size="small" component={RouterLink} to={to}>{t(label)}</Button>)}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
