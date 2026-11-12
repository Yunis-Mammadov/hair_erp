import { t } from "../../i18n/runtime";
import { useContext } from "react";
import { AuthContext } from "./AuthContext";
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error(t("useAuth must be used within AuthProvider"));
  return ctx;
}
