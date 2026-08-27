import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


/**
 * GET /api/auth/me
 *
 * Reads the access_token cookie set on the frontend domain (placed there by
 * /api/auth/google) and proxies a validation request to the FastAPI backend.
 * Returns the current user profile if the token is valid, 401 otherwise.
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
    upstream = await fetch(`${BACKEND}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error("[auth/me] backend unreachable:", err);
    return NextResponse.json(
      { success: false, status_code: 502, message: "Backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
};
