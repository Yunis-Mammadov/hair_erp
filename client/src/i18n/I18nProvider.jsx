import { useLayoutEffect } from "react";
import { useAuth } from "../features/auth/useAuth";
import { setWorkspace } from "./runtime";
import { useI18n } from "./useI18n";
export default function I18nProvider({ children }) {
  const { user } = useAuth();
  const { language } = useI18n();
  useLayoutEffect(() => { setWorkspace(user?.company); }, [user?.company]);
  useLayoutEffect(() => { document.documentElement.lang = language; }, [language]);
  return children;
}
