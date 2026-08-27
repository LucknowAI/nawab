import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { BackendStatusProvider, useBackendStatus } from "../BackendStatusContext";
import { AuthProvider, useAuth } from "../AuthContext";

function Probe() {
  const { loginWithGoogle } = useAuth();
  const { down } = useBackendStatus();
  const [settled, setSettled] = useState(false);
  return (
    <div>
      <div data-testid="status">{down ? "down" : "up"}</div>
      {settled && <div data-testid="login-settled" />}
      <button
        onClick={() => {
          loginWithGoogle("fake-token")
            .catch(() => {
              /* expected to throw in these tests — the takeover/error UI is what matters */
            })
            .then(() => setSettled(true));
        }}
      >
        login
      </button>
    </div>
  );
}

// `healthOkAfterLogin` controls what the health-check proxy (/api/health) reports
// once the login attempt has fired — the mount-time health check always reports
// healthy so the initial UI state starts "up". This mirrors reality: a genuine
// 502 outage means the health endpoint would also be failing by the time
// reportOutage() re-checks it, while a genuine auth failure (401) leaves the
// backend perfectly healthy throughout.
function mockFetchWithGoogleStatus(
  status: number,
  detail: string,
  healthOkAfterLogin: boolean
) {
  let healthCallCount = 0;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/health")) {
      healthCallCount += 1;
      const ok = healthCallCount === 1 ? true : healthOkAfterLogin;
      return { ok } as Response;
    }
    if (url.includes("/api/v1/auth/me")) return { ok: false } as Response;
    if (url.includes("/api/v1/auth/google")) {
      return {
        ok: false,
        status,
        // the backend's StandardError envelope, forwarded by the proxy
        json: async () => ({ success: false, status_code: status, message: detail }),
      } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("AuthContext.loginWithGoogle backend-outage reporting", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("reports a backend outage when the proxy returns 502", async () => {
    global.fetch = mockFetchWithGoogleStatus(502, "Backend unreachable", false);

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
    global.fetch = mockFetchWithGoogleStatus(401, "Invalid Google token", true);

    render(
      <BackendStatusProvider>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("up"));

    screen.getByText("login").click();

    await waitFor(() => expect(screen.getByTestId("login-settled")).toBeInTheDocument());

    expect(screen.getByTestId("status")).toHaveTextContent("up");
  });
});
