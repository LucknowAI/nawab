"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "../context/AuthContext";
import { BackendStatusProvider } from "../context/BackendStatusContext";
import { BackendStatusGate } from "./BackendStatusGate";
import { MotionConfig } from "framer-motion";
import { ReactNode } from "react";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <BackendStatusProvider>
      <GoogleOAuthProvider clientId={clientId}>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
            <BackendStatusGate>{children}</BackendStatusGate>
          </MotionConfig>
        </AuthProvider>
      </GoogleOAuthProvider>
    </BackendStatusProvider>
  );
}
