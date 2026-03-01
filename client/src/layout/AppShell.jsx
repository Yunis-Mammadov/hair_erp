import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../features/auth/useAuth";

const drawerWidth = 260;

function menuByRole(role) {
  // route-ları sonra real səhifələrə bağlayacağıq
  const common = [{ label: "Ana Səhifə", to: "/" }];

  const expeditor = [
    { label: "Ekspeditor Satış", to: "/exp/sales" },
    { label: "Geri Qaytarma", to: "/exp/returns" },
    { label: "Müştərilər", to: "/exp/customers" },
  ];

  const warehouse = [
    { label: "Çatdırılma", to: "/wh/deliveries" },
    { label: "Anbar Qalığı", to: "/wh/stock" },
  ];

  const driver = [
    { label: "Çatdırılma", to: "/drv/deliveries" },
    { label: "GeoLocation", to: "/drv/geolocation" },
  ];

  const admin = [
    { label: "İstifadəçilər", to: "/admin/users" },
    { label: "Məhsullar", to: "/admin/products" },
    { label: "Kateqoriyalar", to: "/admin/categories" },
    { label: "Stok", to: "/admin/stock" },
  ];

  switch (role) {
    case "EXPEDITOR":
      return [...common, ...expeditor];
    case "WAREHOUSE":
      return [...common, ...warehouse];
    case "DRIVER":
      return [...common, ...driver];
    case "ADMIN":
      return [...common, ...admin];
    default:
      return common;
  }
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const menu = useMemo(() => menuByRole(user?.role), [user?.role]);

  const drawerContent = (
    <Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Hair ERP</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {user?.fullName} — {user?.role}
        </Typography>
      </Box>
      <Divider />
      <List>
        {menu.map((item) => (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={location.pathname === item.to}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {menu.find((m) => m.to === location.pathname)?.label ?? "Dashboard"}
          </Typography>

          <IconButton color="inherit" onClick={logout} title="Çıxış">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
         {children}
      </Box>
    </Box>
  );
}
