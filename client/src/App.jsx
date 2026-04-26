import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import AppShell from "./layout/AppShell";
import CustomerDetailPage from "./pages/CustomersDetailPage";
import CustomersPage from "./pages/CustomersPage";
import Dashboard from "./pages/Dashboard";
import DeliveryPage from "./pages/DeliveryPage";
import Forbidden from "./pages/Forbidden";
import Login from "./pages/Login";
import PurchaseHistoryPage from "./pages/PurchasesHistoryPage";
import PurchasePage from "./pages/PurchasesPage";
import ReceiptsPage from "./pages/ReceiptsPage";
import ReturnsHistoryPage from "./pages/ReturnsHistoryPage";
import ReturnsPage from "./pages/ReturnsPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import SalesPage from "./pages/SalesPage";
import StockPage from "./pages/StockPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import LiveLocationPage from "./pages/LiveLocationPage";

// placeholders
const Placeholder = ({ title }) => <div style={{ padding: 16 }}>{title}</div>;

function HomePageByRole() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const role = user?.role;

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (role === "ADMIN") {
    return (
      <AppShell>
        <Dashboard />
      </AppShell>
    );
  }

  if (role === "EXPEDITOR") {
    return <Navigate to="/exp/sales" replace />;
  }

  if (role === "WAREHOUSE") {
    return <Navigate to="/warehouse/stock" replace />;
  }

  if (role === "DRIVER") {
    return <Navigate to="/driver/deliveries" replace />;
  }

  return <Navigate to="/forbidden" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePageByRole />
          </ProtectedRoute>
        }
      />

      {/* ADMIN + EXPEDITOR */}

      <Route
        path="/exp/sales"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <SalesPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exp/sales-history"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE", "DRIVER"]}>
              <AppShell>
                <SalesHistoryPage />
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
                <CustomersPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exp/customers/:id"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <CustomerDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exp/returns"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <ReturnsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exp/returns-history"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <ReturnsHistoryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exp/receipts"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <ReceiptsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ADMIN + WAREHOUSE */}

      <Route
        path="/warehouse/purchases"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <PurchasePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/warehouse/purchases-history"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <PurchaseHistoryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/warehouse/stock"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE", "EXPEDITOR"]}>
              <AppShell>
                <StockPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* DRIVER */}

      <Route
        path="/driver/deliveries"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <DeliveryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/driver/routes"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <Placeholder title="Rutlar bölməsi" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/driver/live-location"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <LiveLocationPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
