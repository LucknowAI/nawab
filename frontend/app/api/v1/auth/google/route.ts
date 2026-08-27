import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * POST /api/auth/google
 *
 * Proxies the Google sign-in to the FastAPI backend.
 * Instead of letting the browser call the backend directly (cross-origin),
 * we go server-to-server and then re-set the access_token cookie on the
 * FRONTEND domain.  This means all subsequent browser→Next.js requests
 * will include the cookie, so /api/conversations, /api/v1/chat/ws, etc.
 * can read it with req.cookies.get("access_token").
 */
export const POST = async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, status_code: 400, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[auth/google] backend unreachable:", err);
    return NextResponse.json(
      { success: false, status_code: 502, message: "Backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // Extract the token value from the upstream Set-Cookie header.
  // We re-issue our own cookie so it is scoped to the Next.js (frontend)
  // domain instead of the backend domain.
  const setCookieHeader = upstream.headers.get("set-cookie") ?? "";
  const tokenMatch = setCookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/i);
  const tokenValue = tokenMatch?.[1];

  // Also try to read maxAge from the upstream header (e.g. Max-Age=86400)
  const maxAgeMatch = setCookieHeader.match(/Max-Age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 60 * 60 * 24; // default 24 h

  const response = NextResponse.json(data, { status: 200 });

  if (tokenValue) {
    response.cookies.set({
      name: "access_token",
      value: tokenValue,
      httpOnly: true,
      // secure must be true when deployed (HTTPS); false is fine for local HTTP
      secure: IS_PROD,
      // SameSite=Lax is sufficient — cookie and consumers are same origin (Next.js)
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  } else {
    // Fallback: no token in Set-Cookie — still return the data so the
    // client knows login succeeded, but auth will silently fail later.
    console.warn("[auth/google] No access_token found in upstream Set-Cookie header");
  }

  return response;
};
