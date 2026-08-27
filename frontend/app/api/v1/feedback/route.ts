import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * POST /api/v1/feedback
 * Submit a feedback message from the authenticated user.
 * Proxies to POST {BACKEND}/api/v1/feedback/
 *
 * GET /api/v1/feedback
 * List all feedback submitted by the authenticated user.
 * Proxies to GET {BACKEND}/api/v1/feedback/
 */

function authHeaders(req: NextRequest): Record<string, string> {
  const token = req.cookies.get("access_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const POST = async (req: NextRequest) => {
  const headers = authHeaders(req);
  if (!headers.Authorization) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/v1/feedback/`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[feedback/POST] error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};

export const GET = async (req: NextRequest) => {
  const headers = authHeaders(req);
  if (!headers.Authorization) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "50";
  const offset = searchParams.get("offset") ?? "0";

  try {
    const upstream = await fetch(
      `${BACKEND}/api/v1/feedback/?limit=${limit}&offset=${offset}`,
      { headers }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[feedback/GET] error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
