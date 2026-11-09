import { Navigate, useLocation } from "react-router-dom";
import { canOpenPage } from "../features/plans/access";
import { useAuth } from "../features/auth/useAuth";

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canOpenPage(user, location.pathname))
    return <Navigate to="/forbidden" replace />;

  return children;
}