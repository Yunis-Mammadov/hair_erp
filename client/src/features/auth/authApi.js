import axios from "axios";

const API_URL = "https://hair-erp-3.onrender.com";

export async function pinLogin(pin) {
  const res = await axios.post(`${API_URL}/api/auth/pin-login`, { pin });
  return res.data;
}
