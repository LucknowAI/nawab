import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

/**
 * POST /api/v1/voice/transcribe
 * Proxies multipart audio to the FastAPI STT endpoint.
 * Upstream returns the monorepo ok() envelope; this route forwards it as-is.
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

  try {
    const formData = await req.formData();
    const upstream = await fetch(`${BACKEND}/api/v1/voice/transcribe`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[voice/transcribe] proxy error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
