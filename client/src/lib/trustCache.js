export function isTrustPath(pathname) {
  return pathname === "/trust" || pathname.startsWith("/trust/");
}

// A failed TLS check must never fall back to an old response or offline page.
export async function fetchTrustRequest({ request }) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    return Response.error();
  }
}
