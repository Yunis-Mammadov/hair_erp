import { useId, useState } from "react";
import { Button, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import TranslateIcon from "@mui/icons-material/Translate";
import { languages } from "./runtime";
import { useI18n } from "./useI18n";

export default function LanguagePicker({ showLabel = false }) {
  const { language, setLanguage, t } = useI18n();
  const [anchor, setAnchor] = useState(null);
  const buttonId = useId();
  const menuId = useId();
  const currentLanguage = languages.find(({ code }) => code === language);
  const open = Boolean(anchor);
  const trigger = {
    id: buttonId,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: (event) => setAnchor(event.currentTarget),
  };

  return (
    <>
      {showLabel ? (
        <Button
          {...trigger}
          aria-label={`${t("Language")}: ${currentLanguage.name}`}
          endIcon={<ExpandMoreRounded aria-hidden="true" />}
          sx={{
            minHeight: 40, px: 1.5, border: "1px solid #e1e8f4", borderRadius: "11px",
            bgcolor: "#f1f4fa", color: "#34436a", fontWeight: 700, lineHeight: 1.25,
            "&:hover": { bgcolor: "#e6edfd" },
            '&[aria-expanded="true"]': { bgcolor: "#e6edfd", borderColor: "#a9b9ec" },
            "& .MuiButton-endIcon": { ml: 0.6, mr: 0, color: "#536a9b" },
          }}
        >
          <span lang={currentLanguage.code}>{currentLanguage.name}</span>
        </Button>
      ) : (
        <Tooltip title={t("Language")}>
          <IconButton {...trigger} aria-label={t("Language")}>
            <TranslateIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          list: { id: menuId, "aria-labelledby": buttonId, sx: { p: 0.5 } },
          paper: {
            sx: {
              mt: 0.75, minWidth: 168, border: "1px solid #e1e8f4", borderRadius: "12px",
              boxShadow: "0 10px 28px #172b5826",
            },
          },
        }}
      >
        {languages.map(({ code, name }) => (
          <MenuItem
            key={code}
            lang={code}
            role="menuitemradio"
            aria-checked={language === code}
            selected={language === code}
            onClick={() => {
              setLanguage(code);
              setAnchor(null);
            }}
            sx={{
              minHeight: 40, gap: 1.5, borderRadius: "8px", justifyContent: "space-between",
              color: "#34436a", "&.Mui-selected": { color: "#243dac", fontWeight: 700 },
            }}
          >
            {name}
            {language === code && <CheckRounded fontSize="small" aria-hidden="true" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
