import { api } from "./api";
// Load a category completely for the existing category/cart UI. Each API page is bounded.
export async function categoryProducts(categoryId) {
  const products = [];
  let page = 1,
    totalPages = 1;
  do {
    const { data } = await api.get("/catalog/products", {
      params: { categoryId, page, limit: 100 },
    });
    products.push(...(data.products || []));
    totalPages = data.pagination?.totalPages || 0;
    page++;
  } while (page <= totalPages);
  return products;
}
export async function exportRecords(kind) {
  const { data } = await api.get(`/records/exports/${kind}`, {
    responseType: "blob",
  });
  downloadBlob(data, `${kind}.csv`);
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export { parseCSV } from "./csv.mjs";
