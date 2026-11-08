import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function RoleRoute({ allow = [], children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const role = user?.role;

  // ✅ Debug: role yoxdursa ekranda göstər
  if (!role) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>403</div>
        <div>Role tapılmadı.</div>
        <pre style={{ marginTop: 12, opacity: 0.8 }}>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    );
  }

  if (!allow.includes(role)) {
    return <Navigate to="/forbidden" replace state={{ from: location }} />;
  }

  return children;
}
