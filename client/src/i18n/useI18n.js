import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, t, setLanguage, formatMoney, formatDate } from "./runtime";
export function useI18n() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...state, t, setLanguage, money: formatMoney, date: formatDate };
}
