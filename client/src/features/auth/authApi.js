import { api } from "../../lib/api";

export async function pinLogin(pin) {
  const res = await api.post("/auth/pin-login", { pin });
  return res.data;
}
