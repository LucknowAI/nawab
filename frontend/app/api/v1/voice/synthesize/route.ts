import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

/**
 * POST /api/v1/voice/synthesize
 * Proxies JSON text → raw WAV from FastAPI TTS.
 * Upstream returns binary audio on success (not the ok() envelope).
 */

export const maxDuration = 300;

function authHeaders(req: NextRequest): Record<string, string> {
  const token = req.cookies.get("access_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const POST = async (req: NextRequest) => {
  const headers = authHeaders(req);
  if (!headers.Authorization) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/v1/voice/synthesize`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      try {
        return NextResponse.json(JSON.parse(errText), { status: upstream.status });
      } catch {
        return NextResponse.json(
          { error: errText || "TTS failed" },
          { status: upstream.status },
        );
      }
    }

    const audio = await upstream.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[voice/synthesize] proxy error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
