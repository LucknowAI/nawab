import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ws-token
 *
 * Returns the JWT from the HttpOnly cookie so the browser can authenticate
 * the WebSocket connection, which connects directly to the backend domain
 * and therefore cannot rely on the cookie being forwarded automatically.
 */
export const GET = async (req: NextRequest) => {
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, status_code: 401, message: "Not authenticated" },
      { status: 401 },
    );
  }
  return NextResponse.json({ token });
};
