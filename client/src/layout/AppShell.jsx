import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  CssBaseline,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import AssignmentReturnRoundedIcon from "@mui/icons-material/AssignmentReturnRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";

import { useAuth } from "../features/auth/useAuth";

const drawerWidth = 292;

const groups = [
  { key: "main", label: "" },
  { key: "sales", label: "Satış" },
  { key: "customer", label: "Müştəri" },
  { key: "warehouse", label: "Məhsullar / Anbar" },
  { key: "delivery", label: "Çatdırılma" },
  { key: "finance", label: "Finans" },
];

export default function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role;

  const allNavItems = useMemo(
    () => [
      {
        label: "Ana Səhifə",
        to: "/",
        icon: <HomeRoundedIcon />,
        roles: ["ADMIN"],
        group: "main",
      },
      {
        label: "Satış",
        to: "/exp/sales",
        icon: <ShoppingCartRoundedIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
        group: "sales",
      },
      {
        label: "Satış Tarixçəsi",
        to: "/exp/sales-history",
        icon: <HistoryRoundedIcon />,
        roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"],
        group: "sales",
      },
      {
        label: "Geri Qaytarma",
        to: "/exp/returns",
        icon: <AssignmentReturnRoundedIcon />,
        roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE"],
        group: "sales",
      },
      {
        label: "Müştərilər",
        to: "/exp/customers",
        icon: <PeopleAltRoundedIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
        group: "customer",
      },
      {
        label: "Alış",
        to: "/warehouse/purchases",
        icon: <Inventory2RoundedIcon />,
        roles: ["ADMIN", "WAREHOUSE"],
        group: "warehouse",
      },
      {
        label: "Alış Tarixçəsi",
        to: "/warehouse/purchases-history",
        icon: <ReceiptLongRoundedIcon />,
        roles: ["ADMIN", "WAREHOUSE"],
        group: "warehouse",
      },
      {
        label: "Anbar qalığı",
        to: "/warehouse/stock",
        icon: <WarehouseRoundedIcon />,
        roles: ["ADMIN", "WAREHOUSE", "EXPEDITOR"],
        group: "warehouse",
      },
      {
        label: "Çatdırılma",
        to: "/driver/deliveries",
        icon: <LocalShippingRoundedIcon />,
        roles: ["ADMIN", "DRIVER"],
        group: "delivery",
      },
      {
        label: "Canlı Location",
        to: "/driver/live-location",
        icon: <RouteRoundedIcon />,
        roles: ["ADMIN", "DRIVER"],
        group: "delivery",
        badge: "Yeni",
      },
      {
        label: "Mədaxil",
        to: "/exp/receipts",
        icon: <AttachMoneyRoundedIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
        group: "finance",
      },
    ],
    [],
  );

  const navItems = useMemo(() => {
    if (!role) return [];
    return allNavItems.filter((item) => item.roles.includes(role));
  }, [allNavItems, role]);

  useEffect(() => {
    if (!isDesktop) setMobileOpen(false);
  }, [location.pathname, isDesktop]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        color: "white",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 55% 0%, rgba(185,28,28,0.24), transparent 31%), linear-gradient(180deg, #070a12 0%, #090d18 50%, #070910 100%)",
      }}
    >
      <Box sx={{ px: 2.5, pt: 2.4, pb: 2.2 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Nanoplastica.az"
          sx={{
            width: 205,
            height: 58,
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 12px 26px rgba(0,0,0,0.4))",
          }}
        />
      </Box>

      <Box
        sx={{
          px: 1.4,
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.18)",
            borderRadius: 999,
          },
        }}
      >
        {groups.map((group) => {
          const items = navItems.filter((item) => item.group === group.key);
          if (!items.length) return null;

          return (
            <Box key={group.key} sx={{ mb: 1.9 }}>
              {group.label && (
                <Typography
                  sx={{
                    px: 1.4,
                    mb: 0.8,
                    color: "rgba(255,255,255,0.43)",
                    fontSize: 11.5,
                    fontWeight: 950,
                    letterSpacing: 0.9,
                    textTransform: "uppercase",
                  }}
                >
                  {group.label}
                </Typography>
              )}

              <List disablePadding>
                {items.map((item) => {
                  const active =
                    item.to === "/"
                      ? location.pathname === "/"
                      : location.pathname === item.to ||
                        location.pathname.startsWith(`${item.to}/`);

                  return (
                    <ListItemButton
                      key={item.to}
                      component={RouterLink}
                      to={item.to}
                      selected={active}
                      sx={{
                        mx: 0.7,
                        my: 0.45,
                        minHeight: 48,
                        borderRadius: 3,
                        color: active ? "#fff" : "rgba(255,255,255,0.77)",
                        transition: "0.2s ease",
                        "&:hover": {
                          bgcolor: "rgba(255,255,255,0.07)",
                          color: "#fff",
                          transform: "translateX(2px)",
                        },
                        "&.Mui-selected": {
                          bgcolor: "#b91622",
                          color: "#fff",
                          boxShadow: "0 14px 35px rgba(185,22,34,0.42)",
                        },
                        "&.Mui-selected:hover": {
                          bgcolor: "#cf1d2b",
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          color: "inherit",
                          "& svg": { fontSize: 23 },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>

                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: 900,
                          fontSize: 14.5,
                        }}
                      />

                      {item.badge && (
                        <Chip
                          label={item.badge}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: 10.5,
                            fontWeight: 950,
                            color: "white",
                            bgcolor: "#b91622",
                          }}
                        />
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.7,
            mb: 1.2,
            borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.11)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                boxShadow: "0 0 0 5px rgba(34,197,94,0.13)",
              }}
            />
            <Typography sx={{ fontWeight: 950, fontSize: 13 }}>
              Sistem Statusu
            </Typography>
          </Stack>

          <Typography
            sx={{
              mt: 0.8,
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            Bütün modullar aktivdir
          </Typography>
        </Box>

        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 3,
            color: "rgba(255,255,255,0.78)",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.08)",
              color: "white",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText
            primary="Çıxış"
            primaryTypographyProps={{ fontWeight: 900 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f7fb" }}>
      <CssBaseline />

      {isDesktop ? (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: 0,
              bgcolor: "transparent",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", lg: "none" },
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: 0,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          ml: { lg: `${drawerWidth}px` },
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          bgcolor: "#0b0f19",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 14px 36px rgba(15,23,42,0.18)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: "78px !important",
            gap: 1.5,
            px: { xs: 2, md: 3 },
          }}
        >
          {!isDesktop && (
            <IconButton color="inherit" onClick={() => setMobileOpen(true)}>
              <MenuRoundedIcon />
            </IconButton>
          )}

          <Box sx={{ flex: 1 }} />

        
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
            sx={{ ml: 1 }}
          >
            <Box
              sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}
            >
              <Typography
                sx={{ color: "white", fontWeight: 950, lineHeight: 1.1 }}
              >
                {user?.fullName || "Admin"}
              </Typography>
              <Typography
                sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
              >
                {user?.role || "Administrator"}
              </Typography>
            </Box>

          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", lg: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          pt: "78px",
          bgcolor: "#f5f7fb",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
