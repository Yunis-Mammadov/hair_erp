import { useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { enUS, azAZ, trTR, ruRU } from "@mui/material/locale";
import { CssBaseline } from "@mui/material";
import base from "../theme";
import { useI18n } from "./useI18n";
export default function LocalizedTheme({ children }) {
  const { language } = useI18n();
  const theme = useMemo(()=>createTheme(base, {en:enUS,az:azAZ,tr:trTR,ru:ruRU}[language]),[language]);
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
