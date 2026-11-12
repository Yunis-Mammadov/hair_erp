import AppErrorBoundary from "./components/AppErrorBoundary";
import {lazy,Suspense} from "react";
const CheckoutPage=lazy(()=>import("./pages/CheckoutPage"));
const TeamPage=lazy(()=>import("./pages/TeamPage"));
const PlanPage=lazy(()=>import("./pages/PlanPage"));
const ServicePage=lazy(()=>import("./pages/ServicePage"));
const SettingsPage=lazy(()=>import("./pages/SettingsPage"));
import { useI18n } from "./i18n/useI18n";
import { t } from "./i18n/runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import AppShell from "./layout/AppShell";
const CustomerDetailPage=lazy(()=>import("./pages/CustomersDetailPage"));
const CustomersPage=lazy(()=>import("./pages/CustomersPage"));
const Dashboard=lazy(()=>import("./pages/Dashboard"));
const DeliveryPage=lazy(()=>import("./pages/DeliveryPage"));
const Forbidden=lazy(()=>import("./pages/Forbidden"));
const Login=lazy(()=>import("./pages/Login"));
const PurchaseHistoryPage=lazy(()=>import("./pages/PurchasesHistoryPage"));
const PurchasePage=lazy(()=>import("./pages/PurchasesPage"));
const ReceiptsPage=lazy(()=>import("./pages/ReceiptsPage"));
const ReturnsHistoryPage=lazy(()=>import("./pages/ReturnsHistoryPage"));
const ReturnsPage=lazy(()=>import("./pages/ReturnsPage"));
const SalesHistoryPage=lazy(()=>import("./pages/SalesHistoryPage"));
const SalesPage=lazy(()=>import("./pages/SalesPage"));
const StockPage=lazy(()=>import("./pages/StockPage"));
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
const LiveLocationPage=lazy(()=>import("./pages/LiveLocationPage"));

// placeholders
const Placeholder = ({
  title
}) => <div style={{
  padding: 16
}}>{title}</div>;
function HomePageByRole() {
  useI18n();
  const {
    user,
    isLoading
  } = useAuth();
  if (isLoading) {
    return <div style={{
      padding: 24
    }}>{t("Loading...")}</div>;
  }
  const role = user?.role;
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  if (role === "ADMIN") {
    return <AppShell>
        <Dashboard />
      </AppShell>;
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
  useI18n();
  return <AppErrorBoundary><Suspense fallback={<div role="status" style={{padding:24}}>{t("Loading...")}</div>}><Routes>
 <Route path="/checkout" element={<CheckoutPage/>}/><Route path="/support" element={<ServicePage/>}/><Route path="/privacy" element={<ServicePage kind="privacy"/>}/><Route path="/terms" element={<ServicePage kind="terms"/>}/><Route path="/renew" element={<PlanPage renewal/>}/>
 <Route path="/workspace/team" element={<ProtectedRoute><RoleRoute allow={["ADMIN"]}><AppShell><TeamPage/></AppShell></RoleRoute></ProtectedRoute>}/>
 <Route path="/workspace/plan" element={<ProtectedRoute><RoleRoute allow={["ADMIN"]}><AppShell><PlanPage/></AppShell></RoleRoute></ProtectedRoute>}/><Route path="/workspace/settings" element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />

      <Route path="/" element={<ProtectedRoute>
            <HomePageByRole />
          </ProtectedRoute>} />

      {/* ADMIN + EXPEDITOR */}

      <Route path="/exp/sales" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <SalesPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/sales-history" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE", "DRIVER"]}>
              <AppShell>
                <SalesHistoryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/customers" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <CustomersPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/customers/:id" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <CustomerDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/returns" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <ReturnsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/returns-history" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <ReturnsHistoryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/exp/receipts" element={<ProtectedRoute>
            <RoleRoute allow={["EXPEDITOR", "ADMIN"]}>
              <AppShell>
                <ReceiptsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      {/* ADMIN + WAREHOUSE */}

      <Route path="/warehouse/purchases" element={<ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <PurchasePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/warehouse/purchases-history" element={<ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE"]}>
              <AppShell>
                <PurchaseHistoryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/warehouse/stock" element={<ProtectedRoute>
            <RoleRoute allow={["ADMIN", "WAREHOUSE", "EXPEDITOR"]}>
              <AppShell>
                <StockPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      {/* DRIVER */}

      <Route path="/driver/deliveries" element={<ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <DeliveryPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/driver/routes" element={<ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <Placeholder title={t("Rutlar bölməsi")} />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="/driver/live-location" element={<ProtectedRoute>
            <RoleRoute allow={["DRIVER", "ADMIN"]}>
              <AppShell>
                <LiveLocationPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense></AppErrorBoundary>;
}
