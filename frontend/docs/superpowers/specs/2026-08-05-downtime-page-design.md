# Downtime page — design spec

Tracks: [LucknowAI/nawabAi2.0#7](https://github.com/LucknowAI/nawabAi2.0/issues/7) "Investigate and mitigate downtime" — frontend mitigation half (backend-side investigation tracked separately).

## Problem

When the backend is unreachable, users currently see fragmented, inconsistent signals:
- Chat: a "reconnecting" pill, then after 3 failed WS reconnect attempts, an inline "Connection lost. Please refresh the page to reconnect." message appended to the chat feed.
- Login (Google flow): a small inline error string ("Login failed") indistinguishable from a genuine auth failure (bad token, expired session).
- Any other page (`/about`, `/feedback`, etc.): no signal at all — requests just silently fail.

There's no single, branded "the service is down" experience, and no automatic recovery — users must manually refresh even after the backend comes back.

## Goals

- One full-screen takeover shown app-wide whenever the backend is confirmed unreachable, in brand style.
- Two independent triggers: an on-load health check, and WS reconnect exhaustion.
- Google sign-in specifically distinguishes "backend unreachable" from a real auth failure and triggers the same takeover.
- Automatic recovery: poll in the background while down; on first success, reload the page. No manual retry button.

## Non-goals

- Email/OTP login flow is not wired to this (same "backend unreachable" shape exists in its proxy route, but out of scope here — flagged as a natural follow-on).
- No distinction between "health endpoint down" vs "WS port blocked but HTTP fine" — both are surfaced as the same generic takeover.
- No status history / uptime log — this is a live indicator only.

## Architecture

### `BackendStatusContext` (`app/context/BackendStatusContext.tsx`)

React context + provider holding `down: boolean`.

- On mount: one `GET {BACKEND}/api/v1/health/` with a 5s `AbortController` timeout. Any failure (network error, non-2xx, timeout) → `down = true`.
- Exposes `reportOutage()` — any consumer can flip `down = true` directly (used by WS exhaustion and the Google login proxy failure).
- While `down === true`: poll the same health endpoint every 5s. First success → `window.location.reload()`. (Reload, not just flipping `down` back to `false`, sidesteps needing to re-plumb WS/auth state resumption through every consumer — simplest correct recovery.)
- Mounted in `Providers.tsx`, above `AuthProvider` (so `AuthContext` can call `useBackendStatus()`), and conditionally renders `<DowntimePage/>` in place of `children` when `down`.

### `DowntimePage` (`app/components/DowntimePage.tsx`)

Full-screen, brand-styled per `DESIGN.md` tokens (ivory/parchment background, ink text, gold accent, Fredoka display heading). Copy: "Nawab AI is resting" + short line + pulsing "Reconnecting…" indicator. No manual retry button. `aria-live="polite"` wrapper so the state change is announced.

### Trigger wiring

1. **Health check on load** — handled inside `BackendStatusProvider` itself, no other file changes needed.
2. **WS reconnect exhaustion** — `useNawabWS` (`app/hooks/useNawabWS.ts`) calls `useBackendStatus().reportOutage()` in the `ws.onclose` branch where `attempt >= MAX_RECONNECT_ATTEMPTS` today appends the inline "Connection lost" message. Keep the inline message as a fallback in case the takeover is somehow suppressed, but the takeover is expected to cover the screen first.
3. **Google login backend-unreachable** — `AuthContext.loginWithGoogle` (`app/context/AuthContext.tsx`) checks `res.status === 502` (the specific status `app/api/v1/auth/google/route.ts` returns only when its upstream `fetch` throws — distinct from the backend's own 4xx auth failures, which pass through unchanged). On `502`, call `reportOutage()` in addition to throwing the existing `Error` (so `GoogleSignInBtn`'s inline error stays as a fallback if the takeover doesn't mount in time).

## Data flow

```
App mount
  └─ BackendStatusProvider mounts → health check
       ├─ ok → render children normally
       └─ fail → down=true → render DowntimePage → poll every 5s
                                                      └─ ok → reload page

Chat open, WS drops
  └─ useNawabWS retries 3x → exhausted → reportOutage() → down=true → same as above

Login screen, Google sign-in
  └─ loginWithGoogle() → proxy fetch throws → 502 "Backend unreachable"
       → reportOutage() (+ existing inline error throw as fallback)
```

## Error handling

- Health check: any failure mode (network error, non-2xx, timeout) treated identically as "down" — no need to distinguish.
- Health check succeeds but WS still can't connect (e.g. only the WS port/route is blocked): out of scope for this spec; existing WS-level inline message remains the fallback for that specific edge case.

## Testing

- Unit: `BackendStatusContext` — mount with failing health check → `down` becomes `true`; subsequent successful poll → `window.location.reload` called.
- Unit: `AuthContext.loginWithGoogle` — proxy returns 502 → `reportOutage()` called.
- Manual: kill backend locally, confirm takeover renders on load, on WS drop, and on Google sign-in attempt; restart backend, confirm auto-recovery reload within ~5s.
