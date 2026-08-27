"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { NawabGoogleLogin } from "../components/GoogleSignInBtn";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import {
  scaleEntrance,
  staggerContainer,
  staggerItem,
  fadeSlideUp,
} from "../lib/motion";
import { royalFlourish } from "../lib/anime-utils";

// Fix 5: removed "choose" from LoginMode
type LoginMode = "email_input" | "otp_input";

function EmailOtpFlow() {
  // Fix 5: removed useRouter — LoginPage already handles redirect on user change
  const { requestOtp, loginWithEmail } = useAuth();

  const [mode, setMode] = useState<LoginMode>("email_input");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shake, setShake] = useState(false);

  // Fix 1: cleanup-only effect — the interval is started in handleSendOtp
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  async function handleSendOtp() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { expires_in } = await requestOtp(email.trim().toLowerCase());
      setCountdown(expires_in ?? 120);
      // Fix 1: start the interval once here instead of recreating it every tick
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      setMode("otp_input");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
      setShake(true);
      shakeTimerRef.current = setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithEmail(email.trim().toLowerCase(), otp.trim());
      // Fix 5: removed router.replace("/") — LoginPage useEffect handles this
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP.");
      setShake(true);
      shakeTimerRef.current = setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  }

  const shakeStyle = { animation: shake ? "shake 0.5s ease" : undefined };

  if (mode === "email_input") {
    // Fix 4: wrapped in <form> with onSubmit; removed onKeyDown from input; button is type="submit"
    return (
      <form
        onSubmit={e => { e.preventDefault(); handleSendOtp(); }}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}
      >
        {/* Fix 3: added aria-label */}
        <Input
          style={shakeStyle}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={busy}
          autoFocus
          aria-label="Email address"
        />
        <Button type="submit" full disabled={!email.trim() || busy}>
          {busy ? "Sending…" : "Send OTP"}
        </Button>
        {/* Fix 3: added role="alert" */}
        {error && (
          <p role="alert" style={{ color: "var(--nawab-rose)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.83rem", margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    );
  }

  // otp_input mode
  // Fix 4: wrapped in <form> with onSubmit; removed onKeyDown from input; primary button is type="submit"; others are type="button"
  return (
    <form
      onSubmit={e => { e.preventDefault(); handleVerifyOtp(); }}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}
    >
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.83rem", color: "var(--nawab-ink-60)", margin: 0 }}>
        OTP sent to <strong>{email}</strong>
        {countdown > 0 && <span style={{ marginLeft: "0.4rem", color: "var(--nawab-gold)" }}>({countdown}s)</span>}
      </p>
      {/* Fix 3: added aria-label and autoComplete */}
      <Input
        style={shakeStyle}
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="6-digit OTP"
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
        disabled={busy}
        autoFocus
        aria-label="One-time password"
        autoComplete="one-time-code"
      />
      <Button type="submit" full disabled={otp.length !== 6 || busy}>
        {busy ? "Verifying…" : "Verify OTP"}
      </Button>
      {countdown === 0 && (
        <Button
          type="button"
          variant="ghost"
          full
          onClick={() => { setOtp(""); setMode("email_input"); setError(null); }}
        >
          Resend OTP
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        style={{ border: "none", color: "var(--nawab-ink-60)", fontSize: "0.8rem", textAlign: "left", padding: 0 }}
        onClick={() => { setMode("email_input"); setError(null); setOtp(""); }}
      >
        ← Back
      </Button>
      {/* Fix 3: added role="alert" */}
      {error && (
        <p role="alert" style={{ color: "var(--nawab-rose)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.83rem", margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showEmail, setShowEmail] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const flourishFired = useRef(false);

  useEffect(() => {
    if (!loading && user && !flourishFired.current) {
      flourishFired.current = true;
      if (cardRef.current && particlesRef.current && ringRef.current) {
        royalFlourish(
          cardRef.current,
          particlesRef.current,
          ringRef.current,
          () => router.replace("/")
        );
      } else {
        router.replace("/");
      }
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <main className="nawab-login-root">
      <div className="nawab-login-bg" aria-hidden="true">
        <div className="nawab-login-bg-pattern" />
        <div className="nawab-login-bg-vignette" />
      </div>

      <motion.div
        ref={cardRef}
        className="nawab-login-card"
        variants={scaleEntrance}
        initial="hidden"
        animate="visible"
        style={{ position: "relative", overflow: "visible" }}
      >
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "contents" }}
        >
          {/* ornament */}
          <motion.div variants={staggerItem} style={{ display: "flex", alignItems: "center", gap: "14px", width: "100%" }}>
            <span style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, rgba(184,134,78,0.4))" }} />
            <span style={{ color: "var(--nawab-gold)", fontSize: "13px", letterSpacing: "0.25em", opacity: 0.9 }}>✦</span>
            <span style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, rgba(184,134,78,0.4))" }} />
          </motion.div>

          {/* title */}
          <motion.div variants={staggerItem} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(2.2rem, 6vw, 3rem)", letterSpacing: "0.1em", color: "var(--nawab-ink)", margin: 0, lineHeight: 1 }}>
              Nawab <span style={{ color: "var(--nawab-gold)", fontStyle: "italic" }}>AI</span>
            </h1>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 300, fontSize: "1rem", color: "rgba(30,23,40,0.5)", margin: 0, letterSpacing: "0.15em" }}>
              آداب &nbsp;&middot;&nbsp; Aadab &nbsp;&middot;&nbsp; Tazkira
            </p>
          </motion.div>

          {/* divider */}
          <motion.div variants={staggerItem} style={{ width: "100%", height: "1px", background: "rgba(184,134,78,0.2)" }} />

          {/* prompt */}
          <motion.p
            variants={staggerItem}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", color: "var(--nawab-ink-60)", margin: 0, lineHeight: 1.6, maxWidth: 300, textAlign: "center" }}
          >
            {showEmail
              ? "Enter your email to receive a one-time code."
              : <>Your AI companion for Lucknow.<br />Sign in to begin your journey.</>}
          </motion.p>

          {/* auth section — AnimatePresence for form switch */}
          <motion.div variants={staggerItem} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <AnimatePresence mode="wait">
              {showEmail ? (
                <motion.div
                  key="email-flow"
                  variants={fadeSlideUp}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}
                >
                  <EmailOtpFlow />
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(30,23,40,0.4)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      padding: 0,
                    }}
                    onClick={() => setShowEmail(false)}
                  >
                    ← Back to Google sign-in
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="google-flow"
                  variants={fadeSlideUp}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}
                >
                  <NawabGoogleLogin />
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(30,23,40,0.4)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                    onClick={() => setShowEmail(true)}
                  >
                    Sign in with email instead
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* footer */}
          <motion.p
            variants={staggerItem}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(184,134,78,0.5)", margin: 0 }}
          >
            Lucknow &nbsp;&middot;&nbsp; Uttar Pradesh
          </motion.p>
        </motion.div>

        {/* Particles container — populated by royalFlourish */}
        <div
          ref={particlesRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        />

        {/* Expanding ring */}
        <div
          ref={ringRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            border: "2px solid #c9a84c",
            borderRadius: "50%",
            width: 80,
            height: 80,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(0)",
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </motion.div>
    </main>
  );
}
