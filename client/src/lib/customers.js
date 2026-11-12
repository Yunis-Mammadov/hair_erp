import { api } from "./api";

export async function getCustomers(
  search = "",
  expeditorId = "",
  options = {},
) {
  const params = { ...options };

  if (search && search.trim()) {
    params.search = search.trim();
  }

  if (expeditorId && expeditorId.trim()) {
    params.expeditorId = expeditorId.trim();
  }

  const { data } = await api.get("/customers", {
    params,
  });

  return data;
}

export async function getCustomerById(id) {
  const { data } = await api.get(`/customers/${id}`);
  return data;
}
