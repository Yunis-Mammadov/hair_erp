import axios from "axios";

const API_URL = "http://localhost:7079";

export async function pinLogin(pin) {
  const res = await axios.post(`${API_URL}/api/auth/pin-login`, { pin });
  return res.data;
}
