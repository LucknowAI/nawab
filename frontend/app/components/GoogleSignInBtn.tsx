"use client";

import { useState } from "react";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export function NawabGoogleLogin() {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError("No credential received from Google.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle(credentialResponse.credential);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {busy ? (
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            color: "var(--nawab-ink-60)",
            fontSize: "1rem",
          }}
        >
          Signing in...
        </p>
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google sign-in was cancelled or failed.")}
          shape="rectangular"
          theme="filled_black"
          size="large"
          text="signin_with"
          logo_alignment="left"
        />
      )}
      {error && (
        <p
          style={{
            color: "var(--nawab-rose)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.85rem",
            maxWidth: 320,
            textAlign: "center",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
