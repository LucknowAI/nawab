"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { errorMessage, unwrap } from "@/app/lib/api";
import { useBackendStatus } from "./BackendStatusContext";

/* ─── Types ─────────────────────────────────────────────── */

export interface AuthUser {
  user_id: number;
  email: string;
  full_name: string | null;
  picture: string | null;
  // access_token is kept in the HttpOnly cookie only — never stored in JS
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the initial /auth/me check is in-flight */
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  requestOtp: (email: string) => Promise<{ expires_in: number }>;
  loginWithEmail: (email: string, otp: string) => Promise<void>;
}

/* ─── Context ────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | null>(null);

/** Auth calls hang the login form while in flight, so they must not hang forever. */
const AUTH_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw err;
  }
}

/* ─── Provider ───────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { reportOutage } = useBackendStatus();

  // On mount — ask the Next.js proxy if the cookie is still valid.
  // The cookie is on the same (frontend) domain so it is sent automatically.
  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? unwrap<AuthUser>(r) : null))
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {/* network error — treat as logged-out */})
      .finally(() => setLoading(false));
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    // Call our own Next.js proxy, which sets the cookie on the frontend domain.
    const res = await fetchWithTimeout("/api/v1/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
      const detail = await errorMessage(res, "Login failed");
      // 502 is what app/api/v1/auth/google/route.ts returns both when its own
      // upstream fetch to the backend throws, and when the backend's upstream
      // status is itself 502 — i.e. the backend is unreachable or its own
      // gateway is down, not a real auth failure (bad token, expired session, ...).
      if (res.status === 502) reportOutage();
      throw new Error(detail);
    }

    const data = await unwrap<AuthUser>(res);

    // Store only the profile fields in React state — NOT the token
    if (data) setUser({
      user_id:   data.user_id,
      email:     data.email,
      full_name: data.full_name ?? null,
      picture:   data.picture ?? null,
    });
  }, [reportOutage]);

  const logout = useCallback(async () => {
    // Tell the proxy to clear the cookie from the frontend domain.
    await fetch("/api/v1/auth/logout", {
      method: "POST",
    }).catch(() => {/* ignore network errors on logout */});

    setUser(null);
  }, []);

  const requestOtp = useCallback(async (email: string): Promise<{ expires_in: number }> => {
    const res = await fetchWithTimeout("/api/v1/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      throw new Error(await errorMessage(res, "Failed to send OTP"));
    }
    return (await unwrap<{ expires_in: number }>(res))!;
  }, []);

  const loginWithEmail = useCallback(async (email: string, otp: string) => {
    const res = await fetchWithTimeout("/api/v1/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) {
      throw new Error(await errorMessage(res, "Invalid or expired OTP"));
    }
    const data = await unwrap<AuthUser>(res);
    if (data) setUser({
      user_id: data.user_id,
      email: data.email,
      full_name: data.full_name ?? null,
      picture: data.picture ?? null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, requestOtp, loginWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ───────────────────────────────────────────────── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
