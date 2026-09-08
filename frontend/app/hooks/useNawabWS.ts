"use client";
import { BACKEND } from "@/app/lib/backend";
import { unwrap } from "@/app/lib/api";
import { asWavBlob, ttsClient } from "@/app/lib/tts";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackendStatus } from "../context/BackendStatusContext";

/* ─── TTS helpers (shared audio element + sentence chunking) ─────────────── */

/** Tiny silent WAV used to unlock autoplay on a user gesture (mic click). */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedTtsAudio: HTMLAudioElement | null = null;

function getSharedTtsAudio(): HTMLAudioElement {
  if (!sharedTtsAudio) {
    sharedTtsAudio = document.createElement("audio");
    sharedTtsAudio.setAttribute("playsinline", "true");
    sharedTtsAudio.preload = "auto";
    sharedTtsAudio.style.display = "none";
    document.body.appendChild(sharedTtsAudio);
  }
  return sharedTtsAudio;
}

function unlockAudioPlayback() {
  if (typeof window === "undefined") return;
  try {
    const audio = getSharedTtsAudio();
    audio.muted = true;
    audio.src = SILENT_WAV;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.volume = 1;
      })
      .catch(() => {
        /* autoplay still blocked — a later mic click will retry */
      });
  } catch {
    // ignore
  }
}

/** Pull complete sentences for TTS (. ? ! ।). Display text is unchanged. */
function pullTtsUtterances(buffer: string): { utterances: string[]; rest: string } {
  const utterances: string[] = [];
  let buf = buffer;
  const hard = /([.?!।])/;
  const maxChars = 120;

  let match: RegExpMatchArray | null;
  while ((match = buf.match(hard)) && match.index !== undefined) {
    const piece = buf.slice(0, match.index + 1).trim();
    buf = buf.slice(match.index + 1);
    if (piece) utterances.push(piece);
  }
  if (buf.length >= maxChars) {
    const cut = buf.lastIndexOf(" ", maxChars);
    const idx = cut >= 40 ? cut : maxChars;
    const piece = buf.slice(0, idx).trim();
    buf = buf.slice(idx);
    if (piece) utterances.push(piece);
  }
  return { utterances, rest: buf };
}

/* ─── Display types (same shape as old useNawabStream) ────────────────────── */

export type DisplayItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "text"; id: string; text: string; streaming: boolean }
  | { kind: "question"; id: string; text: string }
  | { kind: "tool"; id: string; toolCallId: string; toolName: string; args: Record<string, unknown> | null; streaming: boolean };

export interface ActiveSearch {
  query: string;
  type: string;
}

export interface NawabWSState {
  items: DisplayItem[];
  running: boolean;
  activeSearch: ActiveSearch | null;
  thinkingSteps: Array<{ tool: string; query: string }>;
  /** Returns false when the socket is not open (caller should unlock voice UI). */
  sendMessage: (text: string, voiceMode?: boolean) => boolean;
  reconnecting: boolean;
  historyLoaded: boolean;
  /** True while the agent is blocked on ask_user; the next sendMessage answers it. */
  awaitingQuestion: boolean;
  interruptSpeech: () => void;
  /** Synced to actual <audio> playback — not text arrival. */
  isSpeaking: boolean;
  /** True while voice TTS work remains (queued or synthesizing). */
  speechPending: boolean;
}

/* ─── WebSocket event types from backend ──────────────────────────────────── */

type WSEvent =
  | { type: "text_delta"; delta: string }
  | { type: "text_done"; content: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "thinking_done"; content: string }
  | { type: "tool_call"; tool_call_id: string; tool_name: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool_call_id: string; tool_name: string; content: string }
  | { type: "agent_status"; message: string }
  | { type: "question"; question: string }
  | { type: "run_done"; messages_snapshot: unknown[] }
  | { type: "error"; message: string };

/* ─── Constants ───────────────────────────────────────────────────────────── */

const SEARCH_TOOLS = new Set(["google_search", "google_news", "google_maps", "google_videos"]);
const UI_TOOLS = new Set(["showPlaces", "showNews", "showVideos", "showMapResults", "showImages", "showFact", "showSources", "showMetroRoute"]);
const SEARCH_TYPE_LABELS: Record<string, string> = {
  google_search: "web",
  google_news: "news",
  google_maps: "maps",
  google_videos: "videos",
};

// Convert http(s):// → ws(s)://
const WS_BASE = BACKEND.replace(/^https/, "wss").replace(/^http/, "ws");
const WS_URL = `${WS_BASE}/api/v1/chat/ws`;

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS = [1000, 2000, 4000]; // ms

// Text deltas arrive from the backend in irregular, token-sized chunks which
// reads as jumpy/chunky. To make it look like a smooth per-character typewriter,
// buffer incoming deltas and reveal them a few characters at a time on a fixed
// tick instead of dumping the whole chunk into the DOM at once.
const REVEAL_TICK_MS = 20;
const REVEAL_CATCHUP_DIVISOR = 10; // higher = smoother but slower to catch up on big bursts

function newId() { return crypto.randomUUID(); }

/* ─── Hook ────────────────────────────────────────────────────────────────── */

export function useNawabWS({
  threadId,
  isExistingThread,
  onToolComplete,
}: {
  threadId: string | null;
  isExistingThread: boolean;
  onToolComplete?: (toolName: string, args: Record<string, unknown>) => void;
}): NawabWSState {

  const [items, setItems] = useState<DisplayItem[]>([]);
  const [running, setRunning] = useState(false);
  const [activeSearch, setActiveSearch] = useState<ActiveSearch | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ tool: string; query: string }>>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(!isExistingThread);
  const [awaitingQuestion, setAwaitingQuestion] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechPending, setSpeechPending] = useState(false);

  const { reportOutage } = useBackendStatus();

  const wsRef = useRef<WebSocket | null>(null);
  // Mirrors `awaitingQuestion` so the stable dispatch/sendMessage callbacks can
  // read it without re-creating themselves on every change.
  const awaitingQuestionRef = useRef(false);
  // Tracks the display-item id for the currently streaming text block
  const currentTextIdRef = useRef<string | null>(null);
  // Per-item buffer of not-yet-revealed characters, drained by the reveal loop below
  const pendingCharsRef = useRef<Map<string, string>>(new Map());
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true when WE close the socket (threadId change / unmount) to suppress reconnect
  const isCleaningUpRef = useRef(false);
  const onToolCompleteRef = useRef(onToolComplete);
  useEffect(() => { onToolCompleteRef.current = onToolComplete; }, [onToolComplete]);

  // ── Speech playback (Kokoro via /api/v1/voice/synthesize) ──
  const MAX_READY_BUFFER = 2;
  const MAX_SYNTH_IN_FLIGHT = 1;
  /** Abort hung synthesize calls so speechPending cannot lock the composer forever. */
  const TTS_SYNTH_TIMEOUT_MS = 45_000;

  type ReadyTtsChunk = { blob: Blob; index: number; synthStarted: number };

  const speechBufferRef = useRef<string>("");
  const speechTextQueueRef = useRef<string[]>([]);
  const readyChunksRef = useRef<ReadyTtsChunk[]>([]);
  const synthInFlightRef = useRef(0);
  const isPlayingRef = useRef<boolean>(false);
  const shouldSpeakRef = useRef<boolean>(false);
  const ttsGenerationRef = useRef(0);
  const ttsChunkSeqRef = useRef(0);
  const ttsAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pumpTtsRef = useRef<() => void>(() => {});

  const clearTtsQueues = useCallback(() => {
    speechTextQueueRef.current = [];
    readyChunksRef.current = [];
    synthInFlightRef.current = 0;
    ttsChunkSeqRef.current = 0;
  }, []);

  const stopCurrentAudio = useCallback(() => {
    for (const controller of ttsAbortControllersRef.current) {
      controller.abort();
    }
    ttsAbortControllersRef.current.clear();
    const audio = audioRef.current ?? sharedTtsAudio;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const ttsWorkRemaining = useCallback(() => {
    return (
      speechTextQueueRef.current.length > 0 ||
      readyChunksRef.current.length > 0 ||
      synthInFlightRef.current > 0 ||
      isPlayingRef.current
    );
  }, []);

  const interruptSpeech = useCallback(() => {
    ttsGenerationRef.current += 1;
    stopCurrentAudio();
    clearTtsQueues();
    isPlayingRef.current = false;
    speechBufferRef.current = "";
    setIsSpeaking(false);
    setSpeechPending(false);
    unlockAudioPlayback();
  }, [stopCurrentAudio, clearTtsQueues]);

  const playNextReadyChunk = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isPlayingRef.current) return;

    const generation = ttsGenerationRef.current;
    const next = readyChunksRef.current.shift();
    if (!next) {
      if (!ttsWorkRemaining()) {
        setIsSpeaking(false);
        setSpeechPending(false);
      } else {
        setSpeechPending(true);
      }
      return;
    }

    isPlayingRef.current = true;
    setSpeechPending(true);

    const wavBlob = asWavBlob(next.blob);
    const url = URL.createObjectURL(wavBlob);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;

    const audio = getSharedTtsAudio();
    audioRef.current = audio;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (generation !== ttsGenerationRef.current) return;
      isPlayingRef.current = false;
      if (!ttsWorkRemaining()) {
        setIsSpeaking(false);
        setSpeechPending(false);
      }
      pumpTtsRef.current();
    };

    audio.onended = finish;
    audio.onerror = () => {
      console.error("[tts] audio playback failed");
      finish();
    };
    audio.muted = false;
    audio.volume = 1;
    audio.src = url;

    void (async () => {
      try {
        await audio.play();
        if (generation !== ttsGenerationRef.current) return;
        setIsSpeaking(true);
        pumpTtsRef.current();
      } catch (err) {
        console.error("[tts] audio.play() failed", err);
        finish();
      }
    })();
  }, [ttsWorkRemaining]);

  const prefetchNextChunks = useCallback(() => {
    if (typeof window === "undefined") return;

    while (
      synthInFlightRef.current < MAX_SYNTH_IN_FLIGHT &&
      speechTextQueueRef.current.length > 0 &&
      readyChunksRef.current.length + synthInFlightRef.current < MAX_READY_BUFFER
    ) {
      const sentence = speechTextQueueRef.current.shift();
      if (!sentence) break;

      const cleanText = sentence
        .replace(/[*#_`~]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      if (!cleanText) continue;

      const generation = ttsGenerationRef.current;
      const index = ++ttsChunkSeqRef.current;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, TTS_SYNTH_TIMEOUT_MS);
      ttsAbortControllersRef.current.add(controller);
      synthInFlightRef.current += 1;
      const synthStarted = performance.now();

      ttsClient
        .synthesize(cleanText, controller.signal)
        .then((blob) => {
          window.clearTimeout(timeoutId);
          ttsAbortControllersRef.current.delete(controller);
          synthInFlightRef.current = Math.max(0, synthInFlightRef.current - 1);
          if (generation !== ttsGenerationRef.current) return;
          readyChunksRef.current.push({ blob, index, synthStarted });
          pumpTtsRef.current();
        })
        .catch((err: unknown) => {
          window.clearTimeout(timeoutId);
          ttsAbortControllersRef.current.delete(controller);
          synthInFlightRef.current = Math.max(0, synthInFlightRef.current - 1);
          if (generation !== ttsGenerationRef.current) {
            return;
          }
          console.error("[tts] synthesize failed (no browser fallback):", err);
          pumpTtsRef.current();
          if (!ttsWorkRemaining()) {
            setIsSpeaking(false);
            setSpeechPending(false);
          }
        });
    }
  }, [ttsWorkRemaining]);

  const pumpTts = useCallback(() => {
    if (typeof window === "undefined") return;
    playNextReadyChunk();
    prefetchNextChunks();
  }, [playNextReadyChunk, prefetchNextChunks]);

  useEffect(() => {
    pumpTtsRef.current = pumpTts;
  }, [pumpTts]);

  const queueSentenceForSpeech = useCallback((sentence: string) => {
    speechTextQueueRef.current.push(sentence);
    setSpeechPending(true);
    pumpTts();
  }, [pumpTts]);

  const queueSentenceForSpeechRef = useRef(queueSentenceForSpeech);
  queueSentenceForSpeechRef.current = queueSentenceForSpeech;
  const startRevealLoopRef = useRef<() => void>(() => {});

  /* ── History loader ──────────────────────────────────────────────────── */

  const loadHistory = useCallback(async (tid: string) => {
    try {
      // Use the replay endpoint — it reconstructs the full event list including
      // tool_call items from the stored messages_snapshot, so tool results
      // (place cards, news, etc.) are shown when loading a previous conversation.
      const res = await fetch(`/api/conversations/${tid}/replay`, { credentials: "include" });
      if (res.status === 404) {
        // Thread no longer exists on the server — clear stale localStorage entry
        if (typeof window !== "undefined") {
          localStorage.removeItem("nawab_active_thread_id");
        }
        return;
      }
      if (!res.ok) return;

      type ReplayEvent = { type: string; [key: string]: unknown };
      const events = (await unwrap<ReplayEvent[]>(res)) ?? [];

      const displayItems: DisplayItem[] = [];
      for (const event of events) {
        if (event.type === "user_message") {
          displayItems.push({ kind: "user", id: newId(), text: event.content as string });
        } else if (event.type === "text_done") {
          const text = event.content as string;
          if (text) displayItems.push({ kind: "text", id: newId(), text, streaming: false });
        } else if (event.type === "tool_call") {
          const toolName = event.tool_name as string;
          const args = (event.args ?? {}) as Record<string, unknown>;
          const toolCallId = (event.tool_call_id as string) ?? newId();
          displayItems.push({ kind: "tool", id: newId(), toolCallId, toolName, args, streaming: false });
          // Populate the tab context (places, news, videos, etc.)
          onToolCompleteRef.current?.(toolName, args);
        } else if (event.type === "question") {
          const text = event.question as string;
          if (text) displayItems.push({ kind: "question", id: newId(), text });
        }
        // thinking_done, tool_result, user_answer — not rendered in the feed
      }

      setItems(displayItems);
    } catch (e) {
      console.error("[useNawabWS] history load error:", e);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  /* ── Char-level reveal loop ──────────────────────────────────────────── */
  // Drains pendingCharsRef on a fixed tick so text appears to type out smoothly
  // regardless of how large/irregular the incoming text_delta chunks are.

  const startRevealLoop = useCallback(() => {
    if (revealTimerRef.current) return;
    revealTimerRef.current = setInterval(() => {
      const pending = pendingCharsRef.current;
      if (pending.size === 0) {
        clearInterval(revealTimerRef.current!);
        revealTimerRef.current = null;
        return;
      }
      // Drain the buffer here, once, as a plain side effect — NOT inside the
      // setItems updater below. React (Strict Mode) can invoke a setState
      // updater twice per commit; mutating pending/removing chars from it
      // inside that updater silently ate every other chunk of text.
      const reveals = new Map<string, string>();
      for (const [id, buf] of pending) {
        // Reveal faster when the backlog is big so a large burst still catches
        // up quickly, but never less than 1 char/tick for a steady typewriter feel.
        const charsThisTick = Math.max(1, Math.ceil(buf.length / REVEAL_CATCHUP_DIVISOR));
        const reveal = buf.slice(0, charsThisTick);
        const rest = buf.slice(charsThisTick);
        if (rest) pending.set(id, rest);
        else pending.delete(id);
        reveals.set(id, reveal);
      }

      setItems(prev => prev.map(item => {
        if (item.kind !== "text") return item;
        const reveal = reveals.get(item.id);
        return reveal ? { ...item, text: item.text + reveal } : item;
      }));
    }, REVEAL_TICK_MS);
  }, []);

  startRevealLoopRef.current = startRevealLoop;

  /* ── Event dispatcher ────────────────────────────────────────────────── */

  const dispatch = useCallback((event: WSEvent) => {
    switch (event.type) {

      case "text_delta": {
        let id = currentTextIdRef.current;
        if (!id) {
          // Start a new streaming text item
          id = newId();
          currentTextIdRef.current = id;
          setItems(prev => [...prev, { kind: "text", id: id!, text: "", streaming: true }]);
        }
        const pending = pendingCharsRef.current;
        pending.set(id, (pending.get(id) ?? "") + event.delta);
        startRevealLoopRef.current();

        speechBufferRef.current += event.delta;
        if (shouldSpeakRef.current) {
          const { utterances, rest } = pullTtsUtterances(speechBufferRef.current);
          speechBufferRef.current = rest;
          for (const utterance of utterances) queueSentenceForSpeechRef.current(utterance);
        }
        break;
      }

      case "text_done": {
        if (currentTextIdRef.current) {
          const id = currentTextIdRef.current;
          setItems(prev => prev.map(item =>
            item.id === id && item.kind === "text"
              ? { ...item, streaming: false }
              : item
          ));
          currentTextIdRef.current = null;
        }

        const remaining = speechBufferRef.current.trim();
        if (remaining && shouldSpeakRef.current) {
          queueSentenceForSpeechRef.current(remaining);
        }
        speechBufferRef.current = "";
        break;
      }

      case "thinking_delta":
      case "thinking_done":
        // Thinking events received — no UI action yet
        break;

      case "question": {
        // The agent's ask_user tool is blocked waiting on input_queue (300s
        // timeout backend-side). Show the question and route the user's next
        // message to it as `user_input` rather than starting a fresh run.
        awaitingQuestionRef.current = true;
        setAwaitingQuestion(true);
        currentTextIdRef.current = null;
        setActiveSearch(null);
        setItems(prev => [...prev, { kind: "question", id: newId(), text: event.question }]);
        break;
      }

      case "agent_status": {
        // Message format: "Searching Google Maps: biryani Lucknow"
        const colonIdx = event.message.indexOf(":");
        if (colonIdx !== -1) {
          setActiveSearch({
            type: event.message.slice(0, colonIdx).trim(),
            query: event.message.slice(colonIdx + 1).trim(),
          });
        } else {
          setActiveSearch({ type: event.message, query: "" });
        }
        break;
      }

      case "tool_call": {
        const { tool_name, tool_call_id, args } = event;
        if (SEARCH_TOOLS.has(tool_name)) {
          const type = SEARCH_TYPE_LABELS[tool_name] ?? tool_name;
          const query =
            typeof args?.query === "string" ? args.query
            : Array.isArray(args?.keywords) ? (args.keywords as string[]).join(", ")
            : "";
          setActiveSearch({ type, query });
          setThinkingSteps(prev => [...prev, { tool: tool_name, query }]);
        } else if (UI_TOOLS.has(tool_name)) {
          const id = newId();
          setItems(prev => [...prev, {
            kind: "tool", id, toolCallId: tool_call_id,
            toolName: tool_name, args, streaming: false,
          }]);
          onToolCompleteRef.current?.(tool_name, args);
        }
        break;
      }

      case "tool_result": {
        setActiveSearch(null);
        break;
      }

      case "run_done": {
        setRunning(false);
        setActiveSearch(null);
        currentTextIdRef.current = null;
        // The run ended without the question being answered (e.g. ask_user
        // timed out) — stop routing the next message to user_input.
        awaitingQuestionRef.current = false;
        setAwaitingQuestion(false);
        break;
      }

      case "error": {
        setRunning(false);
        setActiveSearch(null);
        currentTextIdRef.current = null;
        awaitingQuestionRef.current = false;
        setAwaitingQuestion(false);
        setItems(prev => [...prev, {
          kind: "text", id: newId(),
          text: `⚠ ${event.message || "Something went wrong. Please try again."}`,
          streaming: false,
        }]);
        break;
      }
    }
  }, []); // dispatch is intentionally stable: it only uses refs and setState, no captured props/state

  /* ── connect (and reconnect) ─────────────────────────────────────────── */

  const connect = useCallback((tid: string, loadHist: boolean) => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // detach old handler before closing
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      // Cross-origin WS cannot send the frontend HttpOnly cookie. Fetch a
      // short-lived single-use ticket (never the long-lived JWT) each connect.
      let ticket: string | null = null;
      try {
        const res = await fetch("/api/ws-token");
        if (res.ok) {
          const data = await res.json() as { token: string };
          ticket = data.token;
        }
      } catch {
        // ignore — backend will time out and we'll see an error message
      }
      if (ticket && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "auth", token: ticket }));
      }
      reconnectAttemptsRef.current = 0;
      setReconnecting(false);
      if (loadHist) loadHistory(tid);
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WSEvent;
        dispatch(event);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (isCleaningUpRef.current) return; // intentional close — suppress reconnect
      // connect is stable (dispatch + loadHistory have [] deps), so the closure is safe

      const attempt = reconnectAttemptsRef.current;
      if (attempt < MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(true);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          connect(tid, false); // reconnect; history already loaded
        }, RECONNECT_DELAYS[attempt]);
      } else {
        setReconnecting(false);
        setRunning(false);
        interruptSpeech();
        reportOutage();
        setItems(prev => [...prev, {
          kind: "text", id: newId(),
          text: "⚠ Connection lost. Please refresh the page to reconnect.",
          streaming: false,
        }]);
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror — reconnect logic handled there
    };
  }, [dispatch, loadHistory, reportOutage, interruptSpeech]);

  /* ── Effect: open / close WS on threadId change ──────────────────────── */

  useEffect(() => {
    if (!threadId) return;

    isCleaningUpRef.current = false;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Reset UI & speech state for new thread
    interruptSpeech();
    setItems([]);
    setRunning(false);
    setActiveSearch(null);
    setThinkingSteps([]);
    setReconnecting(false);
    currentTextIdRef.current = null;
    pendingCharsRef.current.clear();
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    connect(threadId, isExistingThread);

    return () => {
      isCleaningUpRef.current = true;
      interruptSpeech();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      pendingCharsRef.current.clear();
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [threadId, isExistingThread, connect, interruptSpeech]);

  /* ── sendMessage ─────────────────────────────────────────────────────── */

  const sendMessage = useCallback((text: string, voiceMode = false): boolean => {
    if (!threadId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[useNawabWS] WebSocket not open, cannot send message");
      return false;
    }
    setItems(prev => [...prev, { kind: "user", id: newId(), text }]);

    // Answering a clarifying question resumes the run that's already in flight;
    // sending `run` here would start a second one and leave ask_user hanging
    // until it times out.
    if (awaitingQuestionRef.current) {
      awaitingQuestionRef.current = false;
      setAwaitingQuestion(false);
      wsRef.current.send(JSON.stringify({ type: "user_input", content: text }));
      return true;
    }

    // New turn cancels any in-flight TTS queue/playback/prefetch.
    ttsGenerationRef.current += 1;
    stopCurrentAudio();
    clearTtsQueues();
    isPlayingRef.current = false;
    speechBufferRef.current = "";
    setIsSpeaking(false);
    setSpeechPending(false);
    shouldSpeakRef.current = voiceMode;
    if (voiceMode) {
      console.info("[tts] voice mode enabled for this turn");
    }

    setRunning(true);
    setThinkingSteps([]);
    setActiveSearch(null);
    currentTextIdRef.current = null;
    wsRef.current.send(JSON.stringify({
      type: "run",
      thread_id: threadId,
      content: text,
      voice_mode: voiceMode,
    }));
    return true;
  }, [threadId, stopCurrentAudio, clearTtsQueues]);

  return {
    items,
    running,
    activeSearch,
    thinkingSteps,
    sendMessage,
    reconnecting,
    historyLoaded,
    awaitingQuestion,
    interruptSpeech,
    isSpeaking,
    speechPending,
  };
}
