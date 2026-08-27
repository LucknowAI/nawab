import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { BackendStatusProvider, useBackendStatus } from "../BackendStatusContext";

function StatusProbe() {
  const { down } = useBackendStatus();
  return <div data-testid="status">{down ? "down" : "up"}</div>;
}

describe("BackendStatusContext", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  afterEach(() => {
    cleanup();
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

  it("reportOutage() flips down to true when a follow-up health check also fails", async () => {
    // Mount-time health check succeeds (status starts "up"), but the health
    // check reportOutage() itself performs fails — simulating a confirmed
    // real outage, which is the only case reportOutage() should act on.
    let callCount = 0;
    global.fetch = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) return { ok: true } as Response;
      throw new Error("network error");
    });

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
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("down"));
  });

  it("reportOutage() does not flip down when a follow-up health check succeeds", async () => {
    // Simulates a WS-only failure: the health endpoint is genuinely fine, so
    // reportOutage() must not declare an outage.
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
    await screen.getByText("report").click();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("status")).toHaveTextContent("up");
  });
});
