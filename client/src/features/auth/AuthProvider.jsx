import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

import { AuthContext } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);
  const login = useCallback((token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      pending = true;
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled && localStorage.getItem("token") === token) {
          localStorage.setItem("user", JSON.stringify(data));
          setUser(data);
        }
      } catch (error) {
        if (
          !cancelled &&
          localStorage.getItem("token") === token &&
          [401, 403].includes(error?.response?.status)
        )
          logout();
      } finally {
        pending = false;
        if (!cancelled) setIsLoading(false);
      }
    }
    refresh();
    const focus = () => refresh();
    const visibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(timer);
    };
  }, [logout]);
  const value = useMemo(
    () => ({ user, setUser, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}