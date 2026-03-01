import { useQuery } from "@tanstack/react-query";
import { getMe } from "./authApi";

export function useAuth() {
  const token = localStorage.getItem("token");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: !!token, // token yoxdursa /me çağırmır
    retry: false,
  });

  const user = meQuery.data?.user || null;

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return {
    token,
    user,
    isLoading: !!token && meQuery.isLoading,
    isError: meQuery.isError,
    logout,
  };
}
