import { api } from "../../lib/api";

export async function pinLogin(pin) {
  const res = await api.post("/auth/pin-login", { pin });
  return res.data; // { token }
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data; // { user: {...} }
}
