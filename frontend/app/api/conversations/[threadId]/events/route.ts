import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * GET /api/conversations/[threadId]/events
 * Proxy to GET {BACKEND}/chat/conversations/{threadId}/events
 *
 * Returns the ordered AG-UI event log for one conversation.
 * Feed the result into runtime.replayEvents() to reconstruct the chat UI.
 */
export const GET = async (
  req: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) => {
  const { threadId } = await context.params;
  const accessToken = req.cookies.get("access_token")?.value;

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  try {
    const upstream = await fetch(
      `${BACKEND}/api/v1/chat/conversations/${threadId}/events`,
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
    console.error("[conversations/events] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
