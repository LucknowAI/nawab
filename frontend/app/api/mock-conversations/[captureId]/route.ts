import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

/**
 * GET /api/mock-conversations/[captureId]
 *
 * Proxies to GET {NEXT_PUBLIC_BACKEND_URL}/api/v1/chat/mock/conversations/{captureId}
 * Returns the parsed messages for a single captured conversation so the
 * history-demo page can pre-render them without sending a chat message.
 */
export const GET = async (
  req: NextRequest,
  context: { params: Promise<{ captureId: string }> }
) => {
  const { captureId } = await context.params;

  const accessToken = req.cookies.get("access_token")?.value;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const upstream = await fetch(
      `${BACKEND}/api/v1/chat/mock/conversations/${captureId}`,
      { headers }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Backend returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[mock-conversations/detail] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
