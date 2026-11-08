import { api } from "../../lib/api";

export async function companyLogin(email, password) {
  const { data } = await api.post("/auth/company-login", { email, password });
  return data;
}

export async function pinLogin(pin, loginToken) {
  const { data } = await api.post(
    "/auth/pin-login",
    { pin },
    {
      headers: { Authorization: `Bearer ${loginToken}` },
    },
  );
  return data;
}