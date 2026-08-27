import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * GET /api/conversations/[threadId]/replay
 * Proxy to GET {BACKEND}/api/v1/chat/conversations/{threadId}/replay
 *
 * Returns the conversation as ordered frontend-renderable events reconstructed
 * from the stored messages_snapshot. Used to restore tool calls and assistant
 * text when loading chat history.
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
      `${BACKEND}/api/v1/chat/conversations/${threadId}/replay`,
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
    console.error("[conversations/replay] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
