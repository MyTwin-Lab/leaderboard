// Shared queryFn helper for React Query: fetch + ok-check + JSON parse in one
// call, so every useQuery() across the app fails consistently on non-2xx
// responses instead of silently caching `undefined`.
export async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json();
}
