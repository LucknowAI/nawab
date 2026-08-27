"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NawabChat from "./components/NawabChat";
import { springIn, fastOut, goldSweep } from "./lib/anime-utils";
import AuthGuard from "./components/AuthGuard";
import { unwrap } from "./lib/api";
import ConversationSidebar from "./components/ConversationSidebar";

const CITY_ID = "lucknow" as const;
const STORAGE_KEY = "nawab_active_thread_id";

async function createNewThread(): Promise<string> {
  const res = await fetch("/api/v1/chat/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ city_id: CITY_ID }),
  });
  if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`);
  const data = await unwrap<{ thread_id: string }>(res);
  return data!.thread_id;
}

function ChatPage() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isExistingThread, setIsExistingThread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  // true when the active thread has no messages yet
  const [currentThreadEmpty, setCurrentThreadEmpty] = useState(true);
  // prevent stale callbacks firing after thread switch
  const threadIdRef = useRef<string | null>(null);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);
  const goldOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-city", CITY_ID);
  }, []);

  // Detect desktop breakpoint — sidebar is in-flow at ≥ 1024px
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setDesktopSidebarOpen(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // On mount: resume stored thread or create a fresh one
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      threadIdRef.current = stored;
      setThreadId(stored);
      setIsExistingThread(true);
      // We don't know yet if it has messages — NawabChat will resolve via historyLoaded
      setCurrentThreadEmpty(false);
    } else {
      createNewThread()
        .then((id) => {
          threadIdRef.current = id;
          setThreadId(id);
          setIsExistingThread(false);
          setCurrentThreadEmpty(true);
          localStorage.setItem(STORAGE_KEY, id);
        })
        .catch(console.error);
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    if (currentThreadEmpty) {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
      return;
    }

    const overlay = goldOverlayRef.current;
    if (overlay) {
      await new Promise<void>((resolve) => {
        goldSweep(
          overlay,
          () => {}, // React re-renders after state change; nothing to manually hide
          resolve
        );
      });
    }

    try {
      const id = await createNewThread();
      threadIdRef.current = id;
      setThreadId(id);
      setIsExistingThread(false);
      setCurrentThreadEmpty(true);
      localStorage.setItem(STORAGE_KEY, id);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error("[ChatPage] Failed to create new thread:", e);
    }
  }, [currentThreadEmpty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewChat]);

  useEffect(() => {
    const el = mobileSidebarRef.current;
    if (!el || isDesktop) return;
    if (sidebarOpen) {
      springIn(el, "-100%");
    } else {
      fastOut(el, "-100%");
    }
  }, [sidebarOpen, isDesktop]);

  const handleSelectThread = useCallback(
    (id: string, messageCount: number) => {
      threadIdRef.current = id;
      setIsExistingThread(true);
      setCurrentThreadEmpty(messageCount === 0);
      setThreadId(id);
      localStorage.setItem(STORAGE_KEY, id);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
    []
  );

  const handleHasMessages = useCallback(() => {
    // Only update if this callback belongs to the current thread
    setCurrentThreadEmpty(false);
  }, []);

  if (!threadId) {
    return (
      <div
        className="nawab-app"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span
          style={{
            color: "var(--nawab-ink-60)",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.1rem",
            letterSpacing: "0.1em",
          }}
        >
          Loading…
        </span>
      </div>
    );
  }

  const sidebar = (
    <ConversationSidebar
      activeThreadId={threadId}
      onSelectThread={handleSelectThread}
      onNewChat={handleNewChat}
      onCollapse={isDesktop ? () => setDesktopSidebarOpen(false) : () => setSidebarOpen(false)}
      isCurrentThreadEmpty={currentThreadEmpty}
    />
  );

  return (
    <div className="nawab-app">
      {/* Toggle button — only while the sidebar is closed. It's a fixed overlay
          at z-index 100, so leaving it mounted over the open mobile drawer put
          it on top of the sidebar's "Nawab AI" header; the drawer has its own
          ✕ collapse button, making this one redundant once open. */}
      {(isDesktop ? !desktopSidebarOpen : !sidebarOpen) && (
        <button
          className="nawab-sidebar-toggle nawab-sidebar-toggle--visible"
          onClick={() =>
            isDesktop ? setDesktopSidebarOpen(true) : setSidebarOpen(true)
          }
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}

      {/* Desktop: sidebar as static flex sibling with collapse support */}
      {isDesktop && (
        <AnimatePresence>
          {desktopSidebarOpen && (
            <motion.div
              key="desktop-sidebar"
              initial={{ translateX: "-100%", width: 0 }}
              animate={{ translateX: "0%", width: "auto", transition: { duration: 0.26, ease: [0.36, 0, 0.66, 1] } }}
              exit={{ translateX: "-100%", width: 0, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              style={{ overflow: "hidden" }}
            >
              {sidebar}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile / Tablet: sidebar as fixed overlay with scrim */}
      {!isDesktop && (
        <>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                key="scrim"
                className="nawab-sidebar-scrim"
                aria-hidden="true"
                onClick={() => setSidebarOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div
            ref={mobileSidebarRef}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100%",
              zIndex: 50,
              transform: "translateX(-100%)",
            }}
          >
            {sidebar}
          </div>
        </>
      )}

      <main className="nawab-main">
        {/* Gold sweep overlay — always in DOM, off-screen until triggered */}
        <div
          ref={goldOverlayRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #c9a84c 0%, #C8782E 100%)",
            transform: "translateX(-101%)",
            zIndex: 20,
            pointerEvents: "none",
          }}
        />
        {/* rest of main content stays unchanged */}
        <div className="nawab-copilot-wrapper">
          <NawabChat
            key={threadId}
            cityId={CITY_ID}
            threadId={threadId}
            isExistingThread={isExistingThread}
            onHasMessages={handleHasMessages}
          />
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <ChatPage />
    </AuthGuard>
  );
}
