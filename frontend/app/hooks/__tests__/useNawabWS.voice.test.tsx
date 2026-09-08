import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { useNawabWS } from "../useNawabWS";
import { BackendStatusProvider } from "../../context/BackendStatusContext";

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

function emit(event: unknown) {
  act(() => { socket.onmessage?.({ data: JSON.stringify(event) }); });
}

const seen = { api: null as ReturnType<typeof useNawabWS> | null };
const api = () => seen.api!;

function Probe() {
  const value = useNawabWS({ threadId: "thread-1", isExistingThread: false });
  useEffect(() => { seen.api = value; });
  return null;
}

describe("useNawabWS — voice_mode", () => {
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
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    sent.length = 0;
  }

  it("includes voice_mode on run frames when sendMessage(..., true)", async () => {
    await mounted();
    act(() => api().sendMessage("namaste", true));
    const frame = JSON.parse(sent.at(-1)!);
    expect(frame.type).toBe("run");
    expect(frame.voice_mode).toBe(true);
    expect(frame.content).toBe("namaste");
  });

  it("defaults voice_mode to false for typed chat", async () => {
    await mounted();
    act(() => api().sendMessage("hello"));
    const frame = JSON.parse(sent.at(-1)!);
    expect(frame.type).toBe("run");
    expect(frame.voice_mode).toBe(false);
  });

  it("exposes interruptSpeech / speaking flags", async () => {
    await mounted();
    expect(typeof api().interruptSpeech).toBe("function");
    expect(api().isSpeaking).toBe(false);
    expect(api().speechPending).toBe(false);
    // Ensure question path still works alongside voice fields
    emit({ type: "question", question: "Which area?" });
    await waitFor(() => expect(api().awaitingQuestion).toBe(true));
  });

  it("returns false from sendMessage when WebSocket is not open", async () => {
    await mounted();
    act(() => {
      socket.readyState = 3; // CLOSED
    });
    let ok = true;
    act(() => {
      ok = api().sendMessage("orphan voice", true);
    });
    expect(ok).toBe(false);
    expect(sent.length).toBe(0);
  });
});
