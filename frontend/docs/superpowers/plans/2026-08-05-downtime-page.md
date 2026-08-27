# Downtime Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a full-screen, brand-styled "downtime" takeover whenever the backend is confirmed unreachable — on initial load, when the chat WebSocket exhausts its reconnect attempts, or when Google sign-in fails because the backend proxy can't reach it — and auto-recover (reload) once it's back.

**Architecture:** A `BackendStatusContext` holds a single `down` boolean and exposes `reportOutage()`. It self-checks the backend health endpoint on mount and polls it every 5s while down, reloading the page on first success. `useNawabWS` and `AuthContext.loginWithGoogle` call `reportOutage()` from their own failure paths. A `BackendStatusGate` component, mounted inside `Providers.tsx`, swaps the app's children for a `DowntimePage` component whenever `down` is true.

**Tech Stack:** Next.js 16 (App Router) / React 19, existing `app/context/AuthContext.tsx` pattern (context + provider + hook in one file). New: Vitest + `@testing-library/react` for unit tests (repo currently has zero frontend test infra).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-downtime-page-design.md` — every requirement in it is authoritative; this plan implements it in full except the explicitly out-of-scope items (email/OTP flow, WS-up-but-HTTP-down edge case).
- Health endpoint: `GET {NEXT_PUBLIC_BACKEND_URL}/api/v1/health/` (matches `useNawabWS.ts`'s existing `BACKEND` constant and the backend's `health_router`).
- Health check timeout: 5000ms (`AbortController`). Poll interval while down: 5000ms.
- Recovery: on first successful poll while down, call `window.location.reload()` — no partial state resumption.
- No manual retry button on the downtime page.
- Styling: use the existing CSS custom properties in `app/globals.css` (`--nawab-ivory`, `--nawab-parchment`, `--nawab-ink`, `--nawab-ink-60`, `--nawab-gold`, `--nawab-border`) and the Fredoka/Google Sans font stack already loaded in `app/layout.tsx`. Follow the `.nawab-status-pill` class-in-`globals.css` convention (not inline styles) since this is an app-level component.
- Google-login-unreachable detection: `res.status === 502` from `/api/v1/auth/google` (the status `app/api/v1/auth/google/route.ts:33` returns only when its own upstream `fetch` throws — distinct from any 4xx the backend itself returns for a bad token).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/context/BackendStatusContext.tsx` | State/logic only: `down` boolean, health check, polling, `reportOutage()`. No UI. |
| `app/context/__tests__/BackendStatusContext.test.tsx` | Unit tests for the above. |
| `app/components/DowntimePage.tsx` | Presentational full-screen takeover. No logic. |
| `app/components/BackendStatusGate.tsx` | Reads `useBackendStatus()`, renders `DowntimePage` or `children`. |
| `app/components/Providers.tsx` | *Modify* — wrap with `BackendStatusProvider` + `BackendStatusGate`. |
| `app/hooks/useNawabWS.ts` | *Modify* — call `reportOutage()` when reconnect attempts are exhausted. |
| `app/context/AuthContext.tsx` | *Modify* — call `reportOutage()` when `loginWithGoogle` gets a 502. |
| `app/context/__tests__/AuthContext.test.tsx` | Unit tests for the 502 wiring. |
| `app/globals.css` | *Modify* — append `.nawab-downtime*` rules. |
| `vitest.config.ts`, `vitest.setup.ts` | New test infra config. |
| `package.json` | *Modify* — add test deps + `test` script. |
| `app/__tests__/smoke.test.tsx` | Confirms the test harness itself works. |

---

## Task 1: Test infrastructure (Vitest + React Testing Library)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/__tests__/smoke.test.tsx`

**Interfaces:**
- Produces: `npm test` runs Vitest once (`vitest run`); later tasks' test files are picked up automatically by the config's default `**/*.test.{ts,tsx}` glob.

- [ ] **Step 1: Install test dependencies**

```bash
cd /home/aayush/UPAI/nawabAiFrontend
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 3: Add the test setup file**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the `test` script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Write a smoke test**

Create `app/__tests__/smoke.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test harness smoke test", () => {
  it("renders a basic component", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it and confirm the harness works**

Run: `npm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts app/__tests__/smoke.test.tsx
git commit -m "test: add vitest + react-testing-library harness"
```

---

## Task 2: `BackendStatusContext`

**Files:**
- Create: `app/context/BackendStatusContext.tsx`
- Test: `app/context/__tests__/BackendStatusContext.test.tsx`

**Interfaces:**
- Produces:
  - `BackendStatusProvider({ children }: { children: ReactNode }): JSX.Element` — exported component.
  - `useBackendStatus(): { down: boolean; reportOutage: () => void }` — exported hook. Throws if called outside `BackendStatusProvider`.
- Consumes: nothing from other tasks (this is the foundation).

- [ ] **Step 1: Write the failing tests**

Create `app/context/__tests__/BackendStatusContext.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BackendStatusProvider, useBackendStatus } from "../BackendStatusContext";

function StatusProbe() {
  const { down } = useBackendStatus();
  return <div data-testid="status">{down ? "down" : "up"}</div>;
}

describe("BackendStatusContext", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
    vi.useRealTimers();
  });

  it("flips down to true when the initial health check fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    render(
      <BackendStatusProvider>
        <StatusProbe />
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("down"));
  });

  it("stays up when the initial health check succeeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    render(
      <BackendStatusProvider>
        <StatusProbe />
      </BackendStatusProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByTestId("status")).toHaveTextContent("up");
  });

  it("reloads the page once a poll succeeds while down", async () => {
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue({ ok: true } as Response);
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
    });

    render(
      <BackendStatusProvider>
        <StatusProbe />
      </BackendStatusProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("down"));

    await vi.advanceTimersByTimeAsync(5000);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("reportOutage() flips down to true directly", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    function Reporter() {
      const { down, reportOutage } = useBackendStatus();
      return (
        <div>
          <div data-testid="status">{down ? "down" : "up"}</div>
          <button onClick={reportOutage}>report</button>
        </div>
      );
    }

    render(
      <BackendStatusProvider>
        <Reporter />
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("up"));
    screen.getByText("report").click();
    expect(screen.getByTestId("status")).toHaveTextContent("down");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- BackendStatusContext`
Expected: FAIL — `Failed to resolve import "../BackendStatusContext"` (file doesn't exist yet).

- [ ] **Step 3: Implement `BackendStatusContext`**

Create `app/context/BackendStatusContext.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";
const HEALTH_URL = `${BACKEND}/api/v1/health/`;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 5000;

interface BackendStatusContextValue {
  /** true once the backend is confirmed unreachable */
  down: boolean;
  /** any consumer can call this to report an outage it detected itself (e.g. WS reconnect exhaustion, a 502 from a proxy route) */
  reportOutage: () => void;
}

const BackendStatusContext = createContext<BackendStatusContextValue | null>(null);

async function checkHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [down, setDown] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reportOutage = useCallback(() => {
    setDown(true);
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

    pollTimerRef.current = setInterval(async () => {
      const ok = await checkHealth();
      if (ok) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        window.location.reload();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [down]);

  return (
    <BackendStatusContext.Provider value={{ down, reportOutage }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const ctx = useContext(BackendStatusContext);
  if (!ctx) throw new Error("useBackendStatus must be used inside <BackendStatusProvider>");
  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- BackendStatusContext`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/context/BackendStatusContext.tsx app/context/__tests__/BackendStatusContext.test.tsx
git commit -m "feat: add BackendStatusContext for backend outage detection"
```

---

## Task 3: `DowntimePage` component + styles

**Files:**
- Create: `app/components/DowntimePage.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing (pure presentational, no props).
- Produces: `DowntimePage(): JSX.Element` — default export, used by Task 4.

- [ ] **Step 1: Add the styles**

Append to the end of `app/globals.css`:

```css

/* ── Downtime takeover ─────────────────────────────────────────────── */

.nawab-downtime {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nawab-ivory);
  padding: 24px;
}

.nawab-downtime__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 360px;
  text-align: center;
  padding: 32px 28px;
  background: var(--nawab-parchment);
  border: 1px solid var(--nawab-border);
  border-radius: 20px;
}

.nawab-downtime__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--nawab-gold);
  animation: pulse-glow 1.6s ease-in-out infinite;
}

.nawab-downtime__title {
  font-family: 'Fredoka', sans-serif;
  font-weight: 400;
  font-size: 1.5rem;
  letter-spacing: 0.04em;
  color: var(--nawab-ink);
  margin: 0;
}

.nawab-downtime__body {
  font-family: 'Google Sans', sans-serif;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--nawab-ink-60);
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nawab-downtime__dot {
    animation: none;
  }
}
```

- [ ] **Step 2: Create the component**

Create `app/components/DowntimePage.tsx`:

```tsx
"use client";

export default function DowntimePage() {
  return (
    <div className="nawab-downtime" role="status" aria-live="polite">
      <div className="nawab-downtime__card">
        <span className="nawab-downtime__dot" aria-hidden="true" />
        <h1 className="nawab-downtime__title">Nawab AI is resting</h1>
        <p className="nawab-downtime__body">
          We can&rsquo;t reach the palace right now. Reconnecting automatically&hellip;
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds (this component isn't wired in yet, but must type-check and compile cleanly).

- [ ] **Step 4: Commit**

```bash
git add app/components/DowntimePage.tsx app/globals.css
git commit -m "feat: add DowntimePage takeover component"
```

---

## Task 4: `BackendStatusGate` + wire into `Providers.tsx`

**Files:**
- Create: `app/components/BackendStatusGate.tsx`
- Modify: `app/components/Providers.tsx`

**Interfaces:**
- Consumes: `useBackendStatus` from `app/context/BackendStatusContext.tsx` (Task 2), `DowntimePage` from `app/components/DowntimePage.tsx` (Task 3).
- Produces: `BackendStatusGate({ children }: { children: ReactNode }): JSX.Element` — used only by `Providers.tsx`.

- [ ] **Step 1: Create the gate component**

Create `app/components/BackendStatusGate.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import { useBackendStatus } from "../context/BackendStatusContext";
import DowntimePage from "./DowntimePage";

export function BackendStatusGate({ children }: { children: ReactNode }) {
  const { down } = useBackendStatus();
  return down ? <DowntimePage /> : <>{children}</>;
}
```

- [ ] **Step 2: Wire it into `Providers.tsx`**

Read the current file first (`app/components/Providers.tsx`), then replace its contents with:

```tsx
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
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check — takeover renders when backend is down**

With the frontend dev server running (`npm run dev`, default port 9001) and the backend **stopped**:
1. Load the app in a browser.
2. Expected: within ~5s, the "Nawab AI is resting" takeover replaces the whole page.
3. Start the backend.
4. Expected: within ~5s of it coming back up, the page reloads on its own and the normal app appears.

- [ ] **Step 5: Commit**

```bash
git add app/components/BackendStatusGate.tsx app/components/Providers.tsx
git commit -m "feat: wire BackendStatusGate into Providers"
```

---

## Task 5: `useNawabWS` — report outage on reconnect exhaustion

**Files:**
- Modify: `app/hooks/useNawabWS.ts`

**Interfaces:**
- Consumes: `useBackendStatus` from `app/context/BackendStatusContext.tsx` (Task 2) — specifically `reportOutage: () => void`.

No new automated test for this task (per spec, this trigger is covered by manual QA only — `useNawabWS` has no existing test suite and mocking its WebSocket lifecycle is out of scope here).

- [ ] **Step 1: Import the hook and call `reportOutage()` on exhaustion**

In `app/hooks/useNawabWS.ts`, add the import near the top (after the existing imports):

```ts
import { useBackendStatus } from "../context/BackendStatusContext";
```

Inside the `useNawabWS` function body, right after the existing state declarations (near `const [historyLoaded, setHistoryLoaded] = useState(...)`), add:

```ts
  const { reportOutage } = useBackendStatus();
```

Then find the `ws.onclose` handler's exhausted-retries branch:

```ts
      } else {
        setReconnecting(false);
        setRunning(false);
        setItems(prev => [...prev, {
          kind: "text", id: newId(),
          text: "⚠ Connection lost. Please refresh the page to reconnect.",
          streaming: false,
        }]);
      }
```

Change it to:

```ts
      } else {
        setReconnecting(false);
        setRunning(false);
        reportOutage();
        setItems(prev => [...prev, {
          kind: "text", id: newId(),
          text: "⚠ Connection lost. Please refresh the page to reconnect.",
          streaming: false,
        }]);
      }
```

Finally, add `reportOutage` to the `connect` callback's dependency array (it's referenced inside `ws.onclose`, defined inside `connect`). Find:

```ts
  }, [dispatch, loadHistory]);
```

Change it to:

```ts
  }, [dispatch, loadHistory, reportOutage]);
```

(`reportOutage` is stable across renders — see Task 2's `useCallback(() => setDown(true), [])` — so this doesn't break the "connect is stable" invariant the surrounding comment describes.)

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check — takeover renders on WS reconnect exhaustion**

With the frontend and backend both running, open a chat conversation, then stop the backend.
Expected: the existing "Reconnecting…" pill appears, and after 3 failed attempts the downtime takeover replaces the page (the inline "Connection lost" message may flash briefly first — that's expected, it's the fallback).

- [ ] **Step 4: Commit**

```bash
git add app/hooks/useNawabWS.ts
git commit -m "feat: report backend outage on WS reconnect exhaustion"
```

---

## Task 6: `AuthContext` — report outage on Google login 502

**Files:**
- Modify: `app/context/AuthContext.tsx`
- Test: `app/context/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `useBackendStatus` from `app/context/BackendStatusContext.tsx` (Task 2).

- [ ] **Step 1: Write the failing tests**

Create `app/context/__tests__/AuthContext.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BackendStatusProvider, useBackendStatus } from "../BackendStatusContext";
import { AuthProvider, useAuth } from "../AuthContext";

function Probe() {
  const { loginWithGoogle } = useAuth();
  const { down } = useBackendStatus();
  return (
    <div>
      <div data-testid="status">{down ? "down" : "up"}</div>
      <button
        onClick={() => {
          loginWithGoogle("fake-token").catch(() => {
            /* expected to throw in these tests — the takeover/error UI is what matters */
          });
        }}
      >
        login
      </button>
    </div>
  );
}

function mockFetchWithGoogleStatus(status: number, detail: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/v1/health/")) return { ok: true } as Response;
    if (url.includes("/api/v1/auth/me")) return { ok: false } as Response;
    if (url.includes("/api/v1/auth/google")) {
      return {
        ok: false,
        status,
        json: async () => ({ detail }),
      } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("AuthContext.loginWithGoogle backend-outage reporting", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports a backend outage when the proxy returns 502", async () => {
    global.fetch = mockFetchWithGoogleStatus(502, "Backend unreachable");

    render(
      <BackendStatusProvider>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("up"));

    screen.getByText("login").click();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("down"));
  });

  it("does not report an outage for a genuine auth failure", async () => {
    global.fetch = mockFetchWithGoogleStatus(401, "Invalid Google token");

    render(
      <BackendStatusProvider>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("up"));

    screen.getByText("login").click();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/auth/google", expect.anything())
    );

    expect(screen.getByTestId("status")).toHaveTextContent("up");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AuthContext`
Expected: FAIL on the first test — `down` never becomes `"down"` (current `loginWithGoogle` doesn't call `reportOutage`, and `AuthContext.tsx` doesn't yet call `useBackendStatus`, so this fails at the assertion, not at import time — `useAuth`/`AuthProvider` already exist).

- [ ] **Step 3: Wire `reportOutage` into `loginWithGoogle`**

In `app/context/AuthContext.tsx`, add the import (after the existing `"use client"` imports):

```ts
import { useBackendStatus } from "./BackendStatusContext";
```

Inside `AuthProvider`, right after the existing `useState` declarations (`const [user, setUser] = useState...`, `const [loading, setLoading] = useState(true);`), add:

```ts
  const { reportOutage } = useBackendStatus();
```

Then change `loginWithGoogle` from:

```ts
  const loginWithGoogle = useCallback(async (idToken: string) => {
    // Call our own Next.js proxy, which sets the cookie on the frontend domain.
    const res = await fetch("/api/v1/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail ?? "Login failed");
    }
```

to:

```ts
  const loginWithGoogle = useCallback(async (idToken: string) => {
    // Call our own Next.js proxy, which sets the cookie on the frontend domain.
    const res = await fetch("/api/v1/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      // 502 is what app/api/v1/auth/google/route.ts returns only when its own
      // upstream fetch to the backend throws — i.e. the backend itself is
      // unreachable, not a real auth failure (bad token, expired session, ...).
      if (res.status === 502) reportOutage();
      throw new Error(err.detail ?? "Login failed");
    }
```

And add `reportOutage` to `loginWithGoogle`'s dependency array — find:

```ts
  }, []);
```

immediately following the `loginWithGoogle` function body (the first such occurrence after `setUser({...})` inside it), and change it to:

```ts
  }, [reportOutage]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AuthContext`
Expected: PASS — 2 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests across all files PASS (smoke + BackendStatusContext + AuthContext).

- [ ] **Step 6: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual check — takeover renders on Google login failure**

With the frontend running and the backend **stopped**, go to `/login` and click "Sign in with Google" (complete the Google OAuth popup if prompted).
Expected: the downtime takeover replaces the page instead of (or immediately after) an inline "Login failed" message.

- [ ] **Step 8: Commit**

```bash
git add app/context/AuthContext.tsx app/context/__tests__/AuthContext.test.tsx
git commit -m "feat: report backend outage on Google login 502"
```

---

## Task 7: Final end-to-end verification

No new files. This is a manual QA pass across all three triggers together, run once at the end.

- [ ] **Step 1: Full manual walkthrough**

1. `npm run build && npm run start` (or `npm run dev`) with the backend running normally — confirm the app loads with no takeover.
2. Stop the backend — confirm the takeover appears within ~5s on whatever page is open (try `/`, `/login`, `/about`).
3. Restart the backend — confirm the page auto-reloads within ~5s and the app is usable again.
4. With backend running, open a chat, then stop the backend mid-conversation — confirm the WS "Reconnecting…" pill appears, then the takeover after ~3 failed attempts (roughly 7s given `RECONNECT_DELAYS = [1000, 2000, 4000]`).
5. With backend stopped from a cold load, go to `/login` and attempt Google sign-in — confirm the takeover (or the inline "Login failed" fallback, since the takeover may already be showing from the initial health check) — either is acceptable, but no unhandled crash or blank screen.

- [ ] **Step 2: Run the full test suite one last time**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/downtime-page
```

(Do not open the PR yet — confirm with the user first.)
