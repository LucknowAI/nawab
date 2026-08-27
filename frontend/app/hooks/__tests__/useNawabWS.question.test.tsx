import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { useNawabWS } from "../useNawabWS";
import { BackendStatusProvider } from "../../context/BackendStatusContext";

/**
 * Covers the ask_user round trip: while the agent is blocked on a `question`,
 * the user's next message must go out as `user_input` (resuming the open run),
 * not as `run` (which starts a second run and leaves ask_user hanging until its
 * 300s timeout).
 */

const sent: string[] = [];
let socket: FakeWebSocket;

class FakeWebSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    socket = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) { sent.push(data); }
  close() {}
}

/** Push a server event into the hook. */
function emit(event: unknown) {
  act(() => { socket.onmessage?.({ data: JSON.stringify(event) }); });
}

/** Latest hook return value, captured in an effect so render stays pure. */
const seen = { api: null as ReturnType<typeof useNawabWS> | null };
const api = () => seen.api!;

function Probe() {
  const value = useNawabWS({ threadId: "thread-1", isExistingThread: false });
  useEffect(() => { seen.api = value; });
  return null;
}

describe("useNawabWS — clarifying question round trip", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "t" }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mounted() {
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    );
    // wait for the socket to open and the auth frame to go out
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    sent.length = 0;
  }

  it("sends `run` normally, then `user_input` while a question is pending", async () => {
    await mounted();

    act(() => api().sendMessage("what is there to eat"));
    expect(JSON.parse(sent.at(-1)!).type).toBe("run");

    emit({ type: "question", question: "Veg or non-veg?" });
    await waitFor(() => expect(api().awaitingQuestion).toBe(true));

    act(() => api().sendMessage("veg"));
    const answer = JSON.parse(sent.at(-1)!);
    expect(answer).toEqual({ type: "user_input", content: "veg" });
    expect(api().awaitingQuestion).toBe(false);
  });

  it("renders the question in the feed", async () => {
    await mounted();
    emit({ type: "question", question: "Which city?" });
    await waitFor(() =>
      expect(api().items.some(i => i.kind === "question" && i.text === "Which city?")).toBe(true),
    );
  });

  it("stops routing to user_input once the run ends unanswered", async () => {
    await mounted();

    emit({ type: "question", question: "Veg or non-veg?" });
    await waitFor(() => expect(api().awaitingQuestion).toBe(true));

    emit({ type: "run_done", messages_snapshot: [] });
    await waitFor(() => expect(api().awaitingQuestion).toBe(false));

    act(() => api().sendMessage("hello again"));
    expect(JSON.parse(sent.at(-1)!).type).toBe("run");
  });
});
