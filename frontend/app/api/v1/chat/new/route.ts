import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

/**
 * POST /api/v1/chat/new
 *
 * Creates a new conversation in the backend and returns its thread_id.
 * Called by page.tsx before opening a WebSocket connection.
 * Returns: { thread_id: string, city_id: string, greeting: string }
 */

export const POST = async (req: NextRequest) => {
  const accessToken = req.cookies.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { success: false, status_code: 401, message: "Not authenticated" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // city_id is optional — an empty body is valid for this endpoint
    body = {};
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/api/v1/chat/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[chat/new] backend unreachable:", err);
    return NextResponse.json(
      { success: false, status_code: 502, message: "Backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
};
