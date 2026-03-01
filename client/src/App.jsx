import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import AppShell from "./layout/AppShell";
import Login from "./pages/Login";
import Forbidden from "./pages/Forbidden";
import Dashboard from "./pages/Dashboard";

// placeholders (indi boş)
const Placeholder = ({ title }) => <div style={{ padding: 8 }}>{title}</div>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Expeditor */}
      <Route
        path="/exp/sales"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <Placeholder title="Ekspeditor Satış (gəlir)" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exp/returns"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <Placeholder title="Geri Qaytarma (gəlir)" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exp/customers"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <Placeholder title="Müştərilər (gəlir)" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
