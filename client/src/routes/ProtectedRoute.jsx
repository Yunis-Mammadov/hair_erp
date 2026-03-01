import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (isLoading) return <div style={{ padding: 24 }}>Loading...</div>;

  return children;
}
