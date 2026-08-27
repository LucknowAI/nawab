import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * POST /api/auth/logout
 *
 * Notifies the FastAPI backend to invalidate the session/token, then clears
 * the access_token cookie from the frontend domain.
 */
export const POST = async (req: NextRequest) => {
  const accessToken = req.cookies.get("access_token")?.value;

  // Best-effort call to the backend — ignore failures (e.g. already expired)
  if (accessToken) {
    try {
      await fetch(`${BACKEND}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.warn("[auth/logout] backend call failed:", err);
    }
  }

  const response = NextResponse.json({ ok: true });

  // Clear the cookie from the frontend domain
  response.cookies.set({
    name: "access_token",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
};
