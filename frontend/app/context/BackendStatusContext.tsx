"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";

const HEALTH_URL = "/api/health";
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 5000;

interface BackendStatusContextValue {
  /** true once the backend is confirmed unreachable */
  down: boolean;
  /** any consumer can call this to report an outage it detected itself (e.g. WS reconnect exhaustion, a 502 from a proxy route) */
  reportOutage: () => Promise<void>;
}

const BackendStatusContext = createContext<BackendStatusContextValue | null>(null);

async function checkHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [down, setDown] = useState(false);

  const reportOutage = useCallback(async () => {
    const ok = await checkHealth();
    if (!ok) setDown(true);
  }, []);

  // One-shot health check on mount.
  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled && !ok) setDown(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // While down, poll until the backend answers again, then reload.
  useEffect(() => {
    if (!down) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const ok = await checkHealth();
      if (cancelled) return;
      if (ok) {
        window.location.reload();
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [down]);

  const value = useMemo(() => ({ down, reportOutage }), [down, reportOutage]);

  return (
    <BackendStatusContext.Provider value={value}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const ctx = useContext(BackendStatusContext);
  if (!ctx) throw new Error("useBackendStatus must be used inside <BackendStatusProvider>");
  return ctx;
}
