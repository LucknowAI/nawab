import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { BackendStatusProvider } from "../../context/BackendStatusContext";
import { BackendStatusGate } from "../BackendStatusGate";

describe("BackendStatusGate", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("renders the downtime takeover instead of children when the backend is down", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    render(
      <BackendStatusProvider>
        <BackendStatusGate>
          <div>app content</div>
        </BackendStatusGate>
      </BackendStatusProvider>
    );

    await waitFor(() => expect(screen.getByText("Nawab AI is resting")).toBeInTheDocument());
    expect(screen.queryByText("app content")).not.toBeInTheDocument();
  });

  it("renders children normally when the backend is reachable", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    render(
      <BackendStatusProvider>
        <BackendStatusGate>
          <div>app content</div>
        </BackendStatusGate>
      </BackendStatusProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText("app content")).toBeInTheDocument();
    expect(screen.queryByText("Nawab AI is resting")).not.toBeInTheDocument();
  });
});
