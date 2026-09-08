import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

/**
 * GET /api/ws-token
 *
 * Mints a short-lived, single-use WebSocket ticket via the backend.
 * The long-lived JWT stays in the HttpOnly cookie and is never returned to JS.
 */
export const GET = async (req: NextRequest) => {
  const accessToken = req.cookies.get("access_token")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, status_code: 401, message: "Not authenticated" },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/api/v1/auth/ws-ticket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("[ws-token] backend unreachable:", err);
    return NextResponse.json(
      { success: false, status_code: 502, message: "Backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        status_code: upstream.status,
        message: (data as { message?: string }).message || "Not authenticated",
      },
      { status: upstream.status },
    );
  }

  // Backend ok() envelope: { success, status_code, message: { ticket, expires_in } }
  const payload =
    data && typeof data === "object" && "message" in data
      ? (data as { message: { ticket?: string } }).message
      : (data as { ticket?: string });
  const ticket = payload?.ticket;
  if (!ticket) {
    return NextResponse.json(
      { success: false, status_code: 502, message: "Ticket unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json({ token: ticket });
};
