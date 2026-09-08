"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { RemoteImg } from "./ui/RemoteImg";
import { SendButton } from "./ui/SendButton";
import { useAutosize } from "../hooks/useAutosize";
import {
  renderToolCall, CITY_COLORS,
  PlaceCard, NewsCard, VideoCard, MapPlaceCard, ImageCard,
  type Place, type NewsArticle, type VideoItem, type MapPlace, type ImageItem,
} from "./NawabActionsProvider";
import { CITIES, type CityId } from "./CitySelector";
import NawabMascot from "./NawabMascot";
import VoiceRecorderButton, { type VoiceUiPhase } from "./VoiceRecorderButton";
import {
  ResponseTabsProvider, useResponseTabs,
  type TabType,
} from "./ResponseTabsContext";
import { useNawabWS, type DisplayItem } from "../hooks/useNawabWS";
import { motion, AnimatePresence } from "framer-motion";
import {
  fadeSlideUp,
  staggerContainer,
  staggerItem,
  silkTransition,
  landingExit,
  slideDownIn,
} from "../lib/motion";
import { staggerFadeUp, rippleBurst, shakeX } from "../lib/anime-utils";

/* ── Constants ──────────────────────────────────────────── */

const CITY_SUGGESTIONS: Record<CityId, string[]> = {
  lucknow:  ["Best biryani places near Hazratganj", "Historical sites in Lucknow", "Weekend activities in Lucknow", "Lucknow street food guide", "Cultural events this week", "Best cafes in Gomti Nagar", "Shopping in Aminabad", "Nawabi cuisine must-tries"],
  varanasi: ["Ghat rituals and timings", "Best places to watch Ganga Aarti", "Ancient temples in Varanasi", "Banarasi silk saree shopping", "Street food near Dashashwamedh Ghat", "Varanasi ghats to visit at sunrise"],
  kanpur:   ["Best restaurants in Civil Lines", "Kanpur leather market guide", "Historical sites in Kanpur", "Shopping in Naveen Market", "Weekend getaways from Kanpur"],
  noida:    ["Best malls in Noida", "Tech hubs and startup spaces", "Top restaurants in Sector 18", "Weekend activities near Noida", "Best cafes for work in Noida"],
};

const TAB_LABELS: Record<TabType, string> = {
  answer: "Answer", places: "Places", news: "News", videos: "Videos", maps: "Maps", images: "Images",
};


/** Subtle “Nawab is thinking…” with animated dots — voice THINKING only. */
function VoiceThinkingLabel() {
  return (
    <span className="nawab-voice-status">
      Nawab is thinking
      <span className="nawab-voice-status__dots" aria-hidden="true">
        <i>.</i><i>.</i><i>.</i>
      </span>
    </span>
  );
}

function deriveVoicePhase(
  voiceStatus: "idle" | "listening" | "transcribing",
  voiceTurnActive: boolean,
  isSpeaking: boolean,
  speechPending: boolean,
): VoiceUiPhase {
  if (isSpeaking) return "speaking";
  if (voiceStatus === "listening") return "listening";
  if (voiceStatus === "transcribing" || voiceTurnActive || speechPending) return "thinking";
  return "ready";
}

/* ── LandingBox ─────────────────────────────────────────── */

function LandingBox({
  cityId, city, onSend, voicePhase, onVoiceStateChange, onVoiceSend, onInterrupt,
}: {
  cityId: CityId;
  city: (typeof CITIES)[number];
  onSend: (msg: string, voiceMode?: boolean) => void;
  voicePhase: VoiceUiPhase;
  onVoiceStateChange: (state: "idle" | "listening" | "transcribing") => void;
  onVoiceSend: (text: string) => void;
  onInterrupt: () => void;
}) {
  const [value, setValue] = useState("");
  const [suggIdx, setSuggIdx] = useState(0);
  const [suggKey, setSuggKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = CITY_SUGGESTIONS[cityId];
  const voiceBusy = voicePhase !== "ready";

  useEffect(() => {
    if (value) return;
    const t = setInterval(() => {
      setSuggIdx(i => (i + 1) % suggestions.length);
      setSuggKey(k => k + 1);
    }, 3200);
    return () => clearInterval(t);
  }, [value, suggestions.length]);

  useAutosize(textareaRef, value);

  const submit = () => {
    const msg = value.trim();
    if (!msg) return;
    setValue("");
    onSend(msg, false);
  };

  const statusPlaceholder =
    voicePhase === "listening" ? (
      "Nawab is listening…"
    ) : voicePhase === "thinking" ? (
      <VoiceThinkingLabel />
    ) : voicePhase === "speaking" ? (
      "Nawab is speaking…"
    ) : null;

  return (
    <div className="nawab-landing">
      <div className="nawab-landing__inner">
        <motion.div
          className="nawab-landing__brand"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.span
            className="nawab-landing__star"
            style={{ color: city.color }}
            variants={staggerItem}
          >
            ✦
          </motion.span>
          <motion.h1 className="nawab-landing__title" variants={staggerItem}>
            Nawab <span style={{ color: city.color }}>AI</span>
          </motion.h1>
          <motion.p className="nawab-landing__subtitle" variants={staggerItem}>
            {city.name}
          </motion.p>
        </motion.div>

        <motion.div
          className="nawab-landing__box"
          style={{ "--lc": city.color } as React.CSSProperties}
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          transition={{ ...silkTransition, delay: 0.3 }}
        >
          <NawabMascot
            color={city.color}
            variant="landing"
            attentive={!!value || voicePhase === "thinking"}
            speaking={voicePhase === "speaking"}
          />
          <div className="nawab-landing__field-wrap">
            {!value && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={statusPlaceholder ? voicePhase : suggKey}
                  className="nawab-landing__placeholder"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 0.55, y: 0, transition: silkTransition }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
                  style={{ position: "absolute" }}
                >
                  {statusPlaceholder ?? suggestions[suggIdx]}
                </motion.span>
              </AnimatePresence>
            )}
            <textarea
              ref={textareaRef}
              className="nawab-landing__textarea"
              value={value}
              rows={1}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              disabled={voiceBusy}
              autoFocus
            />
          </div>
          <VoiceRecorderButton
            color={city.color}
            uiPhase={voicePhase}
            disabled={value.trim().length > 0 || voicePhase === "thinking"}
            onTranscriptionStart={() => onVoiceStateChange("transcribing")}
            onTranscriptionComplete={(text) => {
              if (text.trim()) onVoiceSend(text);
              else onVoiceStateChange("idle");
            }}
            onVoiceStateChange={onVoiceStateChange}
            onInterrupt={onInterrupt}
          />
          <SendButton active={!!value.trim() && !voiceBusy} color={city.color} onClick={submit} />
        </motion.div>
      </div>
    </div>
  );
}

/* ── ChatInput ──────────────────────────────────────────── */

function ChatInput({
  onSend, disabled, color, voicePhase, onVoiceStateChange, onVoiceSend, onInterrupt,
}: {
  onSend: (msg: string, voiceMode?: boolean) => void;
  disabled: boolean;
  color: string;
  voicePhase: VoiceUiPhase;
  onVoiceStateChange: (state: "idle" | "listening" | "transcribing") => void;
  onVoiceSend: (text: string) => void;
  onInterrupt: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const voiceBusy = voicePhase !== "ready";
  const micDisabled =
    value.trim().length > 0 ||
    voicePhase === "thinking" ||
    (voicePhase === "ready" && disabled);

  useAutosize(textareaRef, value);

  const submit = () => {
    const msg = value.trim();
    if (!msg || disabled || voiceBusy) return;
    setValue("");
    onSend(msg, false);
  };

  const placeholder =
    voicePhase === "listening"
      ? "Listening..."
      : voicePhase === "thinking"
      ? undefined
      : voicePhase === "speaking"
      ? "Nawab is speaking…"
      : disabled
      ? "Nawab is thinking…"
      : "Ask anything about Lucknow…";

  return (
    <div className="nawab-chat-input" style={{ "--lc": color } as React.CSSProperties}>
      <NawabMascot
        color={color}
        variant="chat"
        attentive={!!value || disabled || voicePhase === "thinking"}
        speaking={voicePhase === "speaking"}
      />
      <div className="nawab-landing__field-wrap">
        <textarea
          ref={textareaRef}
          className="nawab-landing__textarea"
          value={value}
          rows={1}
          placeholder={voicePhase === "thinking" ? "" : placeholder}
          onChange={e => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!value.trim()) {
                if (textareaRef.current) shakeX(textareaRef.current);
              } else {
                submit();
              }
            }
          }}
          disabled={disabled || voiceBusy}
        />
        {!value && voicePhase === "thinking" && (
          <span className="nawab-landing__placeholder" style={{ position: "absolute", opacity: 0.55, pointerEvents: "none" }}>
            <VoiceThinkingLabel />
          </span>
        )}
      </div>
      <VoiceRecorderButton
        color={color}
        uiPhase={voicePhase}
        disabled={micDisabled}
        onTranscriptionStart={() => onVoiceStateChange("transcribing")}
        onTranscriptionComplete={(text) => {
          if (text.trim()) onVoiceSend(text);
          else onVoiceStateChange("idle");
        }}
        onVoiceStateChange={onVoiceStateChange}
        onInterrupt={onInterrupt}
      />
      <SendButton
        ref={sendBtnRef}
        active={!!value.trim() && !disabled && !voiceBusy}
        color={color}
        style={{ position: "relative", overflow: "hidden" }}
        onClick={(e) => {
          if (value.trim() && !disabled && !voiceBusy && sendBtnRef.current) {
            rippleBurst(sendBtnRef.current, e.nativeEvent);
          }
          submit();
        }}
      />
    </div>
  );
}

/* Markdown from the model can embed images from arbitrary hosts. Without this
   override they render as bare <img> — no error fallback, no referrer policy,
   and no width cap inside a 78%-wide bubble. */
const MD_COMPONENTS: Components = {
  img: ({ src, alt }) => (
    <RemoteImg
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      style={{ maxWidth: "100%", height: "auto", borderRadius: 10, display: "block" }}
    />
  ),
};

/* ── MessageList ────────────────────────────────────────── */

function MessageList({ items, cityColor }: { items: DisplayItem[]; cityColor: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const prev = prevCountRef.current;
    const curr = items.length;
    if (curr <= prev) {
      prevCountRef.current = curr;
      return;
    }
    const newEls: HTMLElement[] = [];
    for (let i = prev; i < curr; i++) {
      const el = list.querySelector<HTMLElement>(`[data-item-index="${i}"]`);
      if (el) newEls.push(el);
    }
    if (newEls.length > 0) {
      staggerFadeUp(newEls, 80, 450);
    }
    prevCountRef.current = curr;
  }, [items]);

  return (
    <div className="nawab-message-list" ref={listRef}>
      {items.map((item, index) => {
        if (item.kind === "user") {
          return (
            <div
              key={item.id}
              className="nawab-message nawab-message--user"
              data-item-index={index}
            >
              {item.text}
            </div>
          );
        }
        if (item.kind === "text") {
          if (!item.text && item.streaming) {
            return (
              <div
                key={item.id}
                className="nawab-message nawab-message--assistant"
                data-item-index={index}
              >
                <span className="nawab-typing-dots"><span /><span /><span /></span>
              </div>
            );
          }
          if (!item.text) return null;
          return (
            <div
              key={item.id}
              className="nawab-message nawab-message--assistant"
              data-item-index={index}
            >
              <ReactMarkdown components={MD_COMPONENTS}>{item.text}</ReactMarkdown>
            </div>
          );
        }
        if (item.kind === "question") {
          return (
            <div key={item.id} data-item-index={index} className="nawab-question" style={{ borderColor: cityColor }}>
              <span className="nawab-question__label" style={{ color: cityColor }}>Nawab asks</span>
              <p className="nawab-question__text">{item.text}</p>
            </div>
          );
        }
        if (item.kind === "tool") {
          const node = renderToolCall(item.toolName, item.args, cityColor);
          if (!node) return null;
          return (
            <div
              key={item.id}
              data-item-index={index}
            >
              {node}
            </div>
          );
        }
        return null;
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ── Tab components ─────────────────────────────────────── */

function TabBar({ color }: { color: string }) {
  const { availableTabs, activeTab, setActiveTab } = useResponseTabs();
  if (availableTabs.length <= 1) return null;
  return (
    <div className="nawab-tabbar">
      {availableTabs.map(tab => (
        <button
          key={tab}
          className={`nawab-tabbar__tab${activeTab === tab ? " nawab-tabbar__tab--active" : ""}`}
          style={activeTab === tab ? { color, position: "relative" } : { position: "relative" }}
          onClick={() => setActiveTab(tab)}
        >
          {TAB_LABELS[tab]}
          {activeTab === tab && (
            <motion.div
              layoutId="tab-indicator"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                background: color,
                borderRadius: 2,
              }}
              transition={silkTransition}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function TabPanel({ cityId }: { cityId: CityId }) {
  const { activeTab, tabs } = useResponseTabs();
  const color = CITY_COLORS[cityId] ?? "#C8782E";
  if (activeTab === "answer") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        className="nawab-tabpanel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.25 } }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
      >
        {activeTab === "places" && (
          <motion.div
            className="nawab-grid nawab-grid--places"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tabs.places.map((p, i) => (
              <motion.div key={i} variants={staggerItem}>
                <PlaceCard place={p} wide />
              </motion.div>
            ))}
          </motion.div>
        )}
        {activeTab === "news" && (
          <motion.div
            className="nawab-grid nawab-grid--news"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tabs.news.map((a, i) => (
              <motion.div key={i} variants={staggerItem}>
                <NewsCard article={a} cityColor={color} />
              </motion.div>
            ))}
          </motion.div>
        )}
        {activeTab === "videos" && (
          <motion.div
            className="nawab-grid nawab-grid--videos"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tabs.videos.map((v, i) => (
              <motion.div key={i} variants={staggerItem}>
                <VideoCard video={v} cityColor={color} wide />
              </motion.div>
            ))}
          </motion.div>
        )}
        {activeTab === "maps" && (
          <motion.div
            className="nawab-grid nawab-grid--maps"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tabs.maps.map((p, i) => (
              <motion.div key={i} variants={staggerItem}>
                <MapPlaceCard place={p} cityColor={color} wide />
              </motion.div>
            ))}
          </motion.div>
        )}
        {activeTab === "images" && tabs.images && tabs.images.length > 0 && (
          <motion.div
            className="nawab-grid nawab-grid--images"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tabs.images.map((img, i) => (
              <motion.div key={i} variants={staggerItem}>
                <ImageCard image={img} cityColor={color} wide />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── ThinkingPanel ──────────────────────────────────────── */

function ThinkingPanel({ steps, color }: { steps: Array<{tool: string; query: string}>, color: string }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  const ICONS: Record<string, string> = {
    places: "📍", restaurants: "🍽️", events: "🎉", news: "📰",
    videos: "▶", images: "🖼️", shopping: "🛍️",
  };
  return (
    <div className="nawab-thinking">
      <motion.button
        className="nawab-thinking__toggle"
        onClick={() => setOpen(v => !v)}
        style={{ color: "var(--nawab-ink-60)" }}
        whileHover={{ opacity: 0.8 }}
        transition={silkTransition}
      >
        <span style={{ color, fontSize: "0.75rem" }}>⚙</span>
        <span>Searched {steps.length} time{steps.length > 1 ? "s" : ""}</span>
        <motion.span
          style={{ marginLeft: "auto", fontSize: "0.65rem" }}
          animate={{ rotate: open ? 180 : 0 }}
          transition={silkTransition}
        >
          ▼
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nawab-thinking__steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: silkTransition }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            style={{ overflow: "hidden" }}
          >
            {steps.map((s, i) => (
              <div key={i} className="nawab-thinking__step">
                <span className="nawab-thinking__icon">{ICONS[s.tool] ?? "🔍"}</span>
                <span className="nawab-thinking__query">{s.query}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── ChatInner ──────────────────────────────────────────── */

type Mode = "landing" | "leaving" | "chat";

function ChatInner({ cityId, threadId, isExistingThread, city, onHasMessages }: {
  cityId: CityId; threadId: string; isExistingThread: boolean; city: (typeof CITIES)[number];
  onHasMessages?: () => void;
}) {
  const color = CITY_COLORS[cityId] ?? "#C8782E";
  const { availableTabs, activeTab } = useResponseTabs();

  const { addPlaces, addNews, addVideos, addMaps, addImages } = useResponseTabs();

  const onToolComplete = useCallback(
    (toolName: string, args: Record<string, unknown>) => {
      if (toolName === "showPlaces" && args.places)        addPlaces(args.places as Place[]);
      else if (toolName === "showNews" && args.articles)   addNews(args.articles as NewsArticle[]);
      else if (toolName === "showVideos" && args.videos)   addVideos(args.videos as VideoItem[]);
      else if (toolName === "showMapResults" && args.places) addMaps(args.places as MapPlace[]);
      else if (toolName === "showImages" && args.images)   addImages(args.images as ImageItem[]);
    },
    [addPlaces, addNews, addVideos, addMaps, addImages],
  );

  const {
    items, running, activeSearch, thinkingSteps, sendMessage, reconnecting,
    historyLoaded, awaitingQuestion, interruptSpeech, isSpeaking, speechPending,
  } = useNawabWS({
    threadId,
    isExistingThread,
    onToolComplete,
  });

  const [mode, setMode] = useState<Mode>(isExistingThread ? "chat" : "landing");
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [pendingVoiceMode, setPendingVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "transcribing">("idle");
  const [voiceTurnActive, setVoiceTurnActive] = useState(false);
  const voiceTurnStartedRef = useRef(false);
  const calledOnHasMessages = useRef(false);

  const voicePhase = deriveVoicePhase(voiceStatus, voiceTurnActive, isSpeaking, speechPending);

  useEffect(() => {
    if (!voiceTurnActive) return;
    if (running || isSpeaking || speechPending) {
      voiceTurnStartedRef.current = true;
      return;
    }
    if (!voiceTurnStartedRef.current) return;
    setVoiceTurnActive(false);
    setVoiceStatus("idle");
    voiceTurnStartedRef.current = false;
  }, [voiceTurnActive, running, isSpeaking, speechPending]);

  // If we loaded history for an existing thread but it's empty, show landing.
  // Guarded on !pendingMsg — otherwise this races the effect below: when landing
  // mode flushes a pendingMsg via sendMessage, both effects fire in the same
  // render pass and this one sees stale (still-empty) items before sendMessage
  // has added the user bubble, incorrectly bouncing back to landing.
  useEffect(() => {
    if (historyLoaded && items.length === 0 && mode === "chat" && !running && !pendingMsg) {
      setMode("landing");
    }
  }, [historyLoaded, items.length, mode, running, pendingMsg]);

  // Notify parent when thread gets its first message
  useEffect(() => {
    if (items.length > 0 && !calledOnHasMessages.current) {
      calledOnHasMessages.current = true;
      onHasMessages?.();
    }
  }, [items.length, onHasMessages]);

  const clearVoiceLock = useCallback(() => {
    setVoiceTurnActive(false);
    setVoiceStatus("idle");
    voiceTurnStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (mode !== "chat" || !pendingMsg) return;
    const ok = sendMessage(pendingMsg, pendingVoiceMode);
    const wasVoice = pendingVoiceMode;
    setPendingMsg(null);
    setPendingVoiceMode(false);
    if (!ok && wasVoice) {
      clearVoiceLock();
    }
  }, [mode, pendingMsg, pendingVoiceMode, sendMessage, clearVoiceLock]);

  const handleSend = useCallback((msg: string, voiceMode = false): boolean => {
    if (mode === "landing" || mode === "leaving") {
      setPendingMsg(msg);
      setPendingVoiceMode(voiceMode);
      setMode("leaving");
      setTimeout(() => setMode("chat"), 420);
      return true; // flush happens after transition; failure handled there
    }
    return sendMessage(msg, voiceMode);
  }, [mode, sendMessage]);

  const handleVoiceSend = useCallback((text: string) => {
    voiceTurnStartedRef.current = false;
    setVoiceTurnActive(true);
    const ok = handleSend(text, true);
    if (!ok) {
      clearVoiceLock();
    }
  }, [handleSend, clearVoiceLock]);

  const handleVoiceInterrupt = useCallback(() => {
    interruptSpeech();
    clearVoiceLock();
  }, [interruptSpeech, clearVoiceLock]);

  const isLanding = mode === "landing" || mode === "leaving";

  return (
    <div className="nawab-chat-shell">
      <AnimatePresence mode="wait">
        {isLanding ? (
          <motion.div
            key="landing"
            variants={landingExit}
            initial="hidden"
            animate="hidden"
            exit="exit"
            style={{ width: "100%", height: "100%" }}
          >
            <LandingBox
              cityId={cityId}
              city={city}
              onSend={handleSend}
              voicePhase={voicePhase}
              onVoiceStateChange={setVoiceStatus}
              onVoiceSend={handleVoiceSend}
              onInterrupt={handleVoiceInterrupt}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            variants={fadeSlideUp}
            initial="hidden"
            animate="visible"
            style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
          >
            <AnimatePresence>
              {running && activeSearch?.query && (
                <motion.div
                  key="status-searching"
                  className="nawab-status-pill"
                  variants={slideDownIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <span className="nawab-status-pill__dot" style={{ background: color }} />
                  <span className="nawab-status-pill__text">
                    {activeSearch.type ? `Searching ${activeSearch.type}` : "Searching"} · <em>{activeSearch.query}</em>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {reconnecting && (
                <motion.div
                  key="status-reconnecting"
                  className="nawab-status-pill"
                  variants={slideDownIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <span className="nawab-status-pill__dot" style={{ background: color }} />
                  <span className="nawab-status-pill__text">Reconnecting…</span>
                </motion.div>
              )}
            </AnimatePresence>

            {!running && thinkingSteps.length > 0 && (
              <ThinkingPanel steps={thinkingSteps} color={color} />
            )}

            {availableTabs.length > 1 && <TabBar color={color} />}

            <div className="nawab-chat-body">
              {activeTab !== "answer" && availableTabs.length > 1 ? (
                <TabPanel cityId={cityId} />
              ) : (
                <MessageList items={items} cityColor={color} />
              )}
            </div>

            {/* awaitingQuestion keeps `running` true (the agent's run is still
                open, blocked on ask_user) — but the user has to be able to type
                the answer, so it un-disables the composer. */}
            <ChatInput
              onSend={handleSend}
              disabled={(running && !awaitingQuestion) || reconnecting}
              color={color}
              voicePhase={voicePhase}
              onVoiceStateChange={setVoiceStatus}
              onVoiceSend={handleVoiceSend}
              onInterrupt={handleVoiceInterrupt}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────── */

export default function NawabChat({ cityId, threadId, isExistingThread, onHasMessages }: {
  cityId: CityId; threadId: string; isExistingThread: boolean; onHasMessages?: () => void;
}) {
  const city = CITIES.find(c => c.id === cityId) ?? CITIES[0];

  return (
    <ResponseTabsProvider>
      <div className="nawab-chat-frame">
        <ChatInner cityId={cityId} threadId={threadId} isExistingThread={isExistingThread} city={city} onHasMessages={onHasMessages} />
      </div>
    </ResponseTabsProvider>
  );
}
