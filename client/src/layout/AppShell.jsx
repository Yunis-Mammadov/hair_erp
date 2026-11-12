import LanguagePicker from "../i18n/LanguagePicker";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { AppBar, Avatar, Box, Chip, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Toolbar, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import PeopleOutlineRoundedIcon from "@mui/icons-material/PeopleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { canOpenPage } from "../features/plans/access";
import { useAuth } from "../features/auth/useAuth";
const drawerWidth = 248;
const headerHeight = 64;
const sidebarStorageKey = "hair-erp-sidebar-open";
const roles = {
  ADMIN: "Administrator",
  EXPEDITOR: "Ekspeditor",
  WAREHOUSE: "Anbar əməkdaşı",
  DRIVER: "Sürücü"
};
const groups = [{
  key: "main",
  label: ""
}, {
  key: "sales",
  label: "Satışlar"
}, {
  key: "customer",
  label: "Müştərilər"
}, {
  key: "warehouse",
  label: "Məhsullar və anbar"
}, {
  key: "delivery",
  label: "Çatdırılma"
}, {
  key: "finance",
  label: "Maliyyə"
}];
const navItems = [{label:"Team and PINs",to:"/workspace/team",icon:PeopleOutlineRoundedIcon,roles:["ADMIN"],group:"main"},{label:"Plan and renewal",to:"/workspace/plan",icon:AccountBalanceWalletOutlinedIcon,roles:["ADMIN"],group:"main"},{label:"Support",to:"/support",icon:SettingsOutlinedIcon,roles:["ADMIN","EXPEDITOR","WAREHOUSE","DRIVER"],group:"main"},{
  label: "Company settings",
  to: "/workspace/settings",
  icon: SettingsOutlinedIcon,
  roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"],
  group: "main"
}, {
  label: "Ana səhifə",
  to: "/",
  icon: HomeOutlinedIcon,
  roles: ["ADMIN"],
  group: "main"
}, {
  label: "Yeni satış",
  to: "/exp/sales",
  icon: ShoppingCartOutlinedIcon,
  roles: ["ADMIN", "EXPEDITOR"],
  group: "sales"
}, {
  label: "Satış tarixçəsi",
  to: "/exp/sales-history",
  icon: HistoryRoundedIcon,
  roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"],
  group: "sales"
}, {
  label: "Geri qaytarma",
  to: "/exp/returns",
  icon: AssignmentReturnOutlinedIcon,
  roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE"],
  group: "sales"
}, {
  label: "Qaytarma tarixçəsi",
  to: "/exp/returns-history",
  icon: HistoryRoundedIcon,
  roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE"],
  group: "sales"
}, {
  label: "Müştərilər",
  to: "/exp/customers",
  icon: PeopleOutlineRoundedIcon,
  roles: ["ADMIN", "EXPEDITOR"],
  group: "customer"
}, {
  label: "Yeni alış",
  to: "/warehouse/purchases",
  icon: Inventory2OutlinedIcon,
  roles: ["ADMIN", "WAREHOUSE"],
  group: "warehouse"
}, {
  label: "Alış tarixçəsi",
  to: "/warehouse/purchases-history",
  icon: ReceiptLongOutlinedIcon,
  roles: ["ADMIN", "WAREHOUSE"],
  group: "warehouse"
}, {
  label: "Anbar qalığı",
  to: "/warehouse/stock",
  icon: WarehouseOutlinedIcon,
  roles: ["ADMIN", "WAREHOUSE", "EXPEDITOR"],
  group: "warehouse"
}, {
  label: "Çatdırılma",
  to: "/driver/deliveries",
  icon: LocalShippingOutlinedIcon,
  roles: ["ADMIN", "DRIVER"],
  group: "delivery"
}, {
  label: "Canlı məkan",
  to: "/driver/live-location",
  icon: RouteOutlinedIcon,
  roles: ["ADMIN", "DRIVER"],
  group: "delivery"
}, {
  label: "Mədaxil",
  to: "/exp/receipts",
  icon: AccountBalanceWalletOutlinedIcon,
  roles: ["ADMIN", "EXPEDITOR"],
  group: "finance"
}];
function matchesRoute(pathname, to) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}
export default function AppShell({
  children
}) {
  const {
    language
  } = useI18n();
  const {
    pathname
  } = useLocation();
  const navigate = useNavigate();
  const {
    user,
    logout
  } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // The path is stored with the mobile state so a new page always starts closed.
  const [mobileState, setMobileState] = useState({
    pathname,
    open: false
  });
  const [desktopOpen, setDesktopOpen] = useState(() => {
    try {
      return localStorage.getItem(sidebarStorageKey) !== "false";
    } catch {
      return true;
    }
  });
  const mobileOpen = mobileState.pathname === pathname && mobileState.open;
  const menuOpen = isDesktop ? desktopOpen : mobileOpen;
  const sidebarOffset = isDesktop && desktopOpen ? drawerWidth : 0;
  const duration = reducedMotion ? 0 : 200;
  const transition = theme.transitions.create(["width", "margin-left"], {
    duration
  });
  const allowedItems = useMemo(() => navItems.filter(item => item.roles.includes(user?.role) && canOpenPage(user, item.to)), [user]);
  const activeItem = allowedItems.find(item => matchesRoute(pathname, item.to));
  const pageTitle = t(activeItem?.label || "İş paneli");
  const companyName = user?.company?.name || "z-Index";
  const initials = (user?.fullName || t("İstifadəçi")).trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toLocaleUpperCase("az-AZ");
  useEffect(() => {
    document.title = pageTitle + " · z-Index";
  }, [pageTitle, language]);
  useEffect(() => {
    try {
      localStorage.setItem(sidebarStorageKey, String(desktopOpen));
    } catch {
      /* The menu still works when browser storage is unavailable. */
    }
  }, [desktopOpen]);
  useEffect(() => {
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("resize")), duration);
    return () => window.clearTimeout(timer);
  }, [desktopOpen, isDesktop, duration]);
  function closeMenu() {
    if (isDesktop) setDesktopOpen(false);else setMobileState({
      pathname,
      open: false
    });
  }
  function toggleMenu() {
    if (isDesktop) setDesktopOpen(open => !open);else setMobileState({
      pathname,
      open: !mobileOpen
    });
  }
  function handleLogout() {
    logout();
    navigate("/login", {
      replace: true
    });
  }
  const navigation = <Box component="nav" id="app-sidebar-navigation" aria-label={t("Əsas menyu")} sx={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    bgcolor: "#151c2c",
    color: "#d5dbea"
  }}>
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{
      minHeight: headerHeight,
      px: 2.25,
      borderBottom: "1px solid #ffffff0d",
      flexShrink: 0
    }}>
        <Box aria-hidden="true" sx={{
        width: 30,
        height: 30,
        bgcolor: "#315be8",
        borderRadius: "8px",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontSize: 19,
        fontWeight: 600
      }}>
          z
        </Box>
        <Typography sx={{
        color: "#fff",
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: "-0.6px",
        flex: 1
      }}>
          z-Index
        </Typography>
        <Tooltip title={t("Menyunu gizlət")}>
          <IconButton onClick={closeMenu} size="small" aria-label={t("Menyunu bağla")} sx={{
          color: "#a1abc0"
        }}>
            <ChevronLeftRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      py: 1.75,
      px: 1.25,
      scrollbarWidth: "thin",
      scrollbarColor: "#3a4355 transparent"
    }}>
        {groups.map(group => {
        const items = allowedItems.filter(item => item.group === group.key);
        if (!items.length) return null;
        return <Box key={group.key} sx={{
          mb: 1.25
        }}>
              {group.label && <Typography sx={{
            px: 1.35,
            pt: 1,
            pb: 0.65,
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#919cb3"
          }}>
                  {t(group.label)}
                </Typography>}
              <List disablePadding>
                {items.map(item => {
              const active = matchesRoute(pathname, item.to);
              const Icon = item.icon;
              return <ListItemButton key={item.to} component={RouterLink} to={item.to} selected={active} aria-current={active ? "page" : undefined} onClick={() => setMobileState({
                pathname,
                open: false
              })} sx={{
                minHeight: 39,
                px: 1.35,
                py: 0.65,
                mb: 0.25,
                borderRadius: "7px",
                color: active ? "#fff" : "#bbc4d6",
                "&:hover": {
                  bgcolor: "#ffffff09",
                  color: "#fff"
                },
                "&.Mui-selected": {
                  bgcolor: "#315be8",
                  color: "#fff"
                },
                "&.Mui-selected:hover": {
                  bgcolor: "#2b51d4"
                },
                "&.Mui-focusVisible": {
                  outline: "2px solid #9bb5ff",
                  outlineOffset: -2
                }
              }}>
                      <ListItemIcon sx={{
                  minWidth: 33,
                  color: active ? "#fff" : "#939fb7"
                }}>
                        <Icon sx={{
                    fontSize: 19
                  }} />
                      </ListItemIcon>
                      <ListItemText primary={t(item.label)} primaryTypographyProps={{
                  fontSize: 12.5,
                  fontWeight: active ? 500 : 400
                }} />
                    </ListItemButton>;
            })}
              </List>
            </Box>;
      })}
      </Box>

      <Box sx={{
      flexShrink: 0,
      px: 1.5,
      pt: 1.5,
      pb: 1.25,
      borderTop: "1px solid #ffffff0d"
    }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{
        px: 1,
        mb: 1.15,
        gap: 1
      }}>
          <Typography variant="caption" title={companyName} noWrap sx={{
          color: "#b7c1d3",
          minWidth: 0
        }}>
            {companyName}
          </Typography>
          <Chip label={user?.company?.plan || "BASIC"} size="small" sx={{
          color: "#c2cfff",
          bgcolor: "#263451",
          height: 21,
          fontSize: 9.5,
          borderRadius: "5px"
        }} />
        </Stack>
        <ListItemButton onClick={handleLogout} sx={{
        borderRadius: "7px",
        py: 0.6,
        minHeight: 36,
        color: "#adb8cd",
        "&:hover": {
          bgcolor: "#ffffff09",
          color: "#fff"
        }
      }}>
          <ListItemIcon sx={{
          minWidth: 33,
          color: "inherit"
        }}>
            <LogoutRoundedIcon sx={{
            fontSize: 18
          }} />
          </ListItemIcon>
          <ListItemText primary={t("Hesabdan çıx")} primaryTypographyProps={{
          fontSize: 12.5
        }} />
        </ListItemButton>
      </Box>
    </Box>;
  return <Box sx={{
    display: "flex",
    minHeight: "100vh",
    bgcolor: "background.default"
  }}>
      <a className="app-skip-link" href="#app-main-content">{t("Məzmuna keç")}</a>
      <Drawer variant={isDesktop ? "persistent" : "temporary"} anchor="left" open={menuOpen} onClose={closeMenu} transitionDuration={duration} ModalProps={{
      keepMounted: true
    }} sx={{
      width: sidebarOffset,
      flexShrink: 0,
      transition,
      "& .MuiDrawer-paper": {
        width: drawerWidth,
        maxWidth: "calc(100vw - 32px)",
        border: 0,
        bgcolor: "#151c2c"
      }
    }}>
        {navigation}
      </Drawer>

      <AppBar position="fixed" elevation={0} color="inherit" sx={{
      ml: sidebarOffset + "px",
      width: "calc(100% - " + sidebarOffset + "px)",
      transition,
      bgcolor: "#fff",
      borderBottom: "1px solid",
      borderColor: "divider"
    }}>
        <Toolbar sx={{
        minHeight: headerHeight + "px !important",
        gap: {
          xs: 1,
          sm: 1.75
        },
        px: {
          xs: 2,
          md: 3.5
        }
      }}><LanguagePicker />
          <Tooltip title={menuOpen ? t("Menyunu gizlət") : t("Menyunu aç")}>
            <IconButton edge="start" onClick={toggleMenu} aria-label={menuOpen ? t("Menyunu gizlət") : t("Menyunu aç")} aria-expanded={menuOpen} aria-controls="app-sidebar-navigation" sx={{
            color: "text.secondary"
          }}>
              <MenuRoundedIcon sx={{
              fontSize: 21
            }} />
            </IconButton>
          </Tooltip>
          <Typography noWrap sx={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "text.secondary"
        }}>
            {pageTitle}
          </Typography>
          <Box sx={{
          textAlign: "right",
          display: {
            xs: "none",
            sm: "block"
          },
          minWidth: 0,
          maxWidth: 220
        }}>
            <Typography noWrap sx={{
            fontSize: 12.5,
            fontWeight: 500
          }}>
              {user?.fullName || t("İstifadəçi")}
            </Typography>
            <Typography noWrap variant="caption" color="text.secondary" sx={{
            fontSize: 10.5
          }}>
              {t(roles[user?.role] || user?.role)} · {companyName}
            </Typography>
          </Box>
          <Avatar title={user?.fullName} sx={{
          width: 32,
          height: 32,
          fontSize: 11,
          fontWeight: 600,
          bgcolor: "#edf2ff",
          color: "#315be8"
        }}>
            {initials}
          </Avatar>
        </Toolbar>
      </AppBar>

      <Box component="main" id="app-main-content" tabIndex={-1} sx={{
      flexGrow: 1,
      minWidth: 0,
      width: "calc(100% - " + sidebarOffset + "px)",
      pt: headerHeight + "px",
      outline: "none",
      transition
    }}>
        {children}
      </Box>
    </Box>;
}
