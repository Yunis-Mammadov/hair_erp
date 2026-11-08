import { createTheme } from "@mui/material/styles";

const fontFamily = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: "#315be8", dark: "#2446bb", light: "#edf2ff" },
    background: { default: "#f5f6fa", paper: "#ffffff" },
    text: { primary: "#1c2536", secondary: "#667085" },
    divider: "#e9ecf2",
    success: { main: "#16805d" },
    error: { main: "#c93636" },
    warning: { main: "#a96916" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily,
    fontSize: 14,
    h1: { fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.04em" },
    h2: { fontSize: "1.625rem", fontWeight: 600, letterSpacing: "-0.035em" },
    h3: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.025em" },
    h4: { fontSize: "1.125rem", fontWeight: 600 },
    h5: { fontSize: "1rem", fontWeight: 600 },
    h6: { fontSize: "0.9375rem", fontWeight: 600 },
    body1: { fontSize: "0.875rem", lineHeight: 1.65 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily, WebkitFontSmoothing: "antialiased" },
        "::selection": { backgroundColor: "#dce6ff" },
        "*:focus-visible": { outline: "2px solid #315be8", outlineOffset: 3 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 38, paddingInline: 14 },
        outlined: { borderColor: "#dce1eb" },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: "#fff", borderRadius: 8 },
        notchedOutline: { borderColor: "#d8dee8" },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #e9ecf2", borderRadius: 12 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#edf0f5", padding: "13px 18px" },
        head: {
          backgroundColor: "#fafbfc",
          fontSize: 12,
          fontWeight: 500,
          color: "#667085",
        },
        body: { fontSize: 13 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
        sizeSmall: { fontSize: 11, height: 24 },
      },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
  },
});

export default theme;