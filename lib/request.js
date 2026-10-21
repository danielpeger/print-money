/** Read a query string from a Node request without the legacy `url.parse()` API. */
export function searchParam(req, name) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get(name);
}
