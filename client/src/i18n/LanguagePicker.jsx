import { useState } from "react";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import { languages } from "./runtime";
import { useI18n } from "./useI18n";
export default function LanguagePicker() {
  const { language, setLanguage, t } = useI18n();
  const [anchor, setAnchor] = useState(null);
  return <><Tooltip title={t("Language")}><IconButton aria-label={t("Language")} aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={e=>setAnchor(e.currentTarget)}><TranslateIcon fontSize="small" /></IconButton></Tooltip><Menu anchorEl={anchor} open={Boolean(anchor)} onClose={()=>setAnchor(null)}>{languages.map(l=><MenuItem key={l.code} selected={language===l.code} lang={l.code} onClick={()=>{setLanguage(l.code);setAnchor(null);}}>{l.name}</MenuItem>)}</Menu></>;
}
