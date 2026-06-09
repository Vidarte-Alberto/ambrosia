import { API_URL } from "@/config/api";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const cookies = request.headers.get("cookie") || "";

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.paymentHash) {
    return Response.json({ error: "paymentHash required" }, { status: 400 });
  }

  let backendResponse;
  try {
    backendResponse = await fetch(`${API_URL}/store/orders/checkout-if-paid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }

  const responseBody = await backendResponse.json().catch(() => null);

  return Response.json(responseBody ?? {}, { status: backendResponse.status });
}
