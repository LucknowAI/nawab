import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


export const DELETE = async (
  req: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) => {
  const { threadId } = await context.params;
  const accessToken = req.cookies.get("access_token")?.value;

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  try {
    const upstream = await fetch(
      `${BACKEND}/api/v1/chat/conversations/${threadId}`,
      { method: "DELETE", headers }
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
    console.error("[conversations/delete] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
};
