import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function RoleRoute({ allow = [], children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/forbidden" replace />;

  return children;
}
