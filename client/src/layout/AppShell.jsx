import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";

import { useAuth } from "../features/auth/useAuth";

const drawerWidth = 280;

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
        icon: <HomeOutlinedIcon />,
        roles: ["ADMIN"],
      },
      {
        label: "Satış",
        to: "/exp/sales",
        icon: <ShoppingCartOutlinedIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
      },
      {
        label: "Satış Tarixçəsi",
        to: "/exp/sales-history",
        icon: <HistoryOutlinedIcon />,
        roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE", "DRIVER"],
      },
      {
        label: "Müştərilər",
        to: "/exp/customers",
        icon: <PeopleAltOutlinedIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
      },
      {
        label: "Mədaxil",
        to: "/exp/receipts",
        icon: <AttachMoneyIcon />,
        roles: ["ADMIN", "EXPEDITOR"],
      },
      {
        label: "Geri Qaytarma",
        to: "/exp/returns",
        icon: <AssignmentReturnOutlinedIcon />,
        roles: ["ADMIN", "EXPEDITOR", "WAREHOUSE"],
      },
      {
        label: "Alış",
        to: "/warehouse/purchases",
        icon: <Inventory2OutlinedIcon />,
        roles: ["ADMIN", "WAREHOUSE"],
      },
      {
        label: "Alış Tarixçəsi",
        to: "/warehouse/purchases-history",
        icon: <HistoryOutlinedIcon />,
        roles: ["ADMIN", "WAREHOUSE"],
      },
      {
        label: "Anbar qalığı",
        to: "/warehouse/stock",
        icon: <WarehouseOutlinedIcon />,
        roles: ["ADMIN", "WAREHOUSE", "EXPEDITOR"],
      },
      {
        label: "Çatdırılma",
        to: "/driver/deliveries",
        icon: <LocalShippingOutlinedIcon />,
        roles: ["ADMIN", "DRIVER"],
      },
      {
        label: "Rutlar",
        to: "/driver/routes",
        icon: <RouteOutlinedIcon />,
        roles: ["ADMIN", "DRIVER"],
      },
    ],
    [],
  );

  const navItems = useMemo(() => {
    if (!role) return [];
    return allNavItems.filter((item) => item.roles.includes(role));
  }, [allNavItems, role]);

  useEffect(() => {
    if (!isDesktop) {
      setMobileOpen(false);
    }
  }, [location.pathname, isDesktop]);

  function handleDrawerToggle() {
    setMobileOpen((prev) => !prev);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar>
        <Typography sx={{ fontWeight: 900, letterSpacing: -0.3 }}>
          Menü
        </Typography>
      </Toolbar>

      <Box sx={{ px: 1, flex: 1, overflowY: "auto" }}>
        <Typography sx={{ px: 1.5, py: 1, fontWeight: 900, opacity: 0.75 }}>
          Navigasiya
        </Typography>

        <List sx={{ pb: 1 }}>
          {navItems.map((item) => {
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
                onClick={() => {
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2.5,
                  mx: 1,
                  my: 0.5,
                  "&.Mui-selected": {
                    backgroundColor: "action.selected",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: 800 }}
                />
              </ListItemButton>
            );
          })}
        </List>

        <Divider sx={{ mx: 1, my: 1 }} />

        <List>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2.5,
              mx: 1,
              my: 0.5,
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Çıxış"
              primaryTypographyProps={{ fontWeight: 800 }}
            />
          </ListItemButton>
        </List>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            sx={{ fontWeight: 900, letterSpacing: -0.3 }}
          >
            Hair ERP
          </Typography>

          <Box sx={{ flex: 1 }} />

          {user?.fullName && (
            <Typography sx={{ mr: 1.5, fontWeight: 700, opacity: 0.9 }}>
              {user.fullName}
            </Typography>
          )}

          {isDesktop && (
            <IconButton color="inherit" onClick={handleLogout} title="Çıxış">
              <LogoutOutlinedIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

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
              borderRightColor: "divider",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", lg: "none" },
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            xs: "100%",
            lg: `calc(100% - ${drawerWidth}px)`,
          },
          minWidth: 0,
          pt: 2,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
