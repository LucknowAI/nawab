import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * GET /api/conversations
 * Proxy to GET {BACKEND}/chat/conversations
 * Returns the list of conversations for the logged-in user, newest first.
 *
 * Query params forwarded: limit, page
 */
export const GET = async (req: NextRequest) => {
  const accessToken = req.cookies.get("access_token")?.value;

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  // Forward limit / page query params
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = `${BACKEND}/api/v1/chat/conversations${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(url, { headers });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Backend returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[conversations] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
