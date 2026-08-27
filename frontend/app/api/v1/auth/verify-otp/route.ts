import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";

const IS_PROD = process.env.NODE_ENV === "production";

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
    upstream = await fetch(`${BACKEND}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[auth/verify-otp] backend unreachable:", err);
    return NextResponse.json(
      { success: false, status_code: 502, message: "Backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // Extract token from backend Set-Cookie and re-issue on frontend domain
  const setCookieHeader = upstream.headers.get("set-cookie") ?? "";
  const tokenMatch = setCookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/i);
  const tokenValue = tokenMatch?.[1];
  const maxAgeMatch = setCookieHeader.match(/Max-Age=(\d+)/i);
  // Default to 7 days — OTP sessions are long-lived (matches backend token expiry)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 60 * 60 * 24 * 7;

  const response = NextResponse.json(data, { status: 200 });

  if (tokenValue) {
    response.cookies.set({
      name: "access_token",
      value: tokenValue,
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  } else {
    console.warn("[auth/verify-otp] No access_token found in upstream Set-Cookie");
  }

  return response;
};
