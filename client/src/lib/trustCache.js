export function isTrustPath(pathname) {
  return pathname === "/trust" || pathname.startsWith("/trust/");
}

export async function fetchTrustRequest({ request }) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    return Response.error();
  }
}
