"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, silkTransition } from "../lib/motion";
import { useRouter } from "next/navigation";
import { CITIES } from "./CitySelector";
import { unwrap } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pulseBorder } from "../lib/anime-utils";

/* ─── Social SVG icons ───────────────────────────────────────── */
function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconDiscord() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function IconHuggingFace() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      {/* Simplified HF face */}
      <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 2a9 9 0 110 18A9 9 0 0112 3zm-3.5 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM8 14.5c.55 1.5 1.667 2.5 4 2.5s3.45-1 4-2.5H8z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" aria-hidden="true">
      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6.5 7v5M9.5 7v5M3 4l.8 8.4A1 1 0 004.8 13.5h6.4a1 1 0 001-.9L13 4"/>
    </svg>
  );
}

function IconCommudle() {
  /* Community / people icon */
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

/* ─── Social links config ────────────────────────────────────── */
const SOCIALS: Array<{ label: string; href: string; icon: React.ReactNode }> = [
  { label: "WhatsApp",     href: "https://chat.whatsapp.com/IAM2fp4IoLiGbuI6ZeNfzH",               icon: <IconWhatsApp /> },
  { label: "LinkedIn",     href: "https://www.linkedin.com/company/lucknow-ai-labs",                icon: <IconLinkedIn /> },
  { label: "Instagram",    href: "https://www.instagram.com/lucknow_ai/",                           icon: <IconInstagram /> },
  { label: "Commudle",     href: "https://www.commudle.com/communities/upai-labs/events",           icon: <IconCommudle /> },
  { label: "Hugging Face", href: "https://huggingface.co/lucknowai",                                icon: <IconHuggingFace /> },
  { label: "YouTube",      href: "https://www.youtube.com/@lucknowailabs",                          icon: <IconYouTube /> },
  { label: "Website",      href: "https://lucknowai.github.io/",                                    icon: <IconGlobe /> },
  { label: "Discord",      href: "https://discord.com/invite/QKw67PDZUm",                           icon: <IconDiscord /> },
];

/* ─── Types ─────────────────────────────────────────────────── */
export interface Conversation {
  thread_id: string;
  title: string | null;
  status: "active" | "completed" | "archived";
  message_count: number;
  city_id?: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  activeThreadId: string;
  onSelectThread: (threadId: string, messageCount: number) => void;
  onNewChat: () => void;
  onCollapse?: () => void;
  isCurrentThreadEmpty?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────── */
function titleFor(c: Conversation) {
  if (c.title) return c.title;
  return `Chat · ${new Date(c.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

/* ─── Skeleton ──────────────────────────────────────────────── */
function ConvSkeleton() {
  return (
    <div className="conv-skeleton">
      <div className="conv-skeleton__title nawab-shimmer" />
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────── */
export default function ConversationSidebar({
  activeThreadId, onSelectThread, onNewChat, onCollapse, isCurrentThreadEmpty,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const newChatBtnRef = useRef<HTMLButtonElement>(null);

  const { user, logout } = useAuth();
  const router = useRouter();
  const city = CITIES[0];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const fetchPage = useCallback(async (pageNum: number, append = false, silent = false) => {
    // `silent` is for background refreshes (e.g. after switching threads) where
    // we already have data on screen — showing the skeleton would blank a list
    // the user is actively looking at for no reason.
    if (pageNum === 1 && !silent) { setLoading(true); setError(null); }
    try {
      const res = await fetch(`/api/conversations?limit=10&page=${pageNum}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await unwrap<Conversation[] | { conversations?: Conversation[]; has_more?: boolean }>(res)) ?? [];
      const convs: Conversation[] = Array.isArray(data) ? data : (data.conversations ?? []);
      setConversations(prev => append ? [...prev, ...convs] : convs);
      setHasMore(Array.isArray(data) ? false : (data.has_more ?? false));
    } catch (e) {
      if (!silent) setError("Could not load conversations.");
      console.error("[ConversationSidebar]", e);
    } finally {
      if (pageNum === 1 && !silent) setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.thread_id !== threadId));
    if (threadId === activeThreadId) {
      onNewChat();
    }
    try {
      const res = await fetch(`/api/conversations/${threadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        console.error("[ConversationSidebar] delete failed:", res.status);
        fetchPage(1);
      }
    } catch (err) {
      console.error("[ConversationSidebar] delete failed:", err);
      fetchPage(1);
    }
  }, [activeThreadId, onNewChat, fetchPage]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setLoadingMore(true);
      fetchPage(page + 1, true)
        .then(() => setPage(p => p + 1))
        .finally(() => setLoadingMore(false));
    }
  }, [loadingMore, hasMore, page, fetchPage]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // Refresh the list after switching threads (title/count may have changed) —
  // skip the very first run, the mount effect above already just fetched it.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const t = setTimeout(() => fetchPage(1, false, true), 1500);
    return () => clearTimeout(t);
  }, [activeThreadId, fetchPage]);

  const filtered = conversations;

  return (
    <aside className="nawab-sidebar">
      {/* ── Header ── */}
      <div className="nawab-sidebar__header">
        <span className="nawab-sidebar__logo">✦ Nawab AI</span>
        {onCollapse && (
          <button
            className="nawab-sidebar__collapse-btn"
            onClick={onCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="nawab-sidebar__divider" />

      {/* ── Conversations ── */}
      <nav ref={listRef as React.RefObject<HTMLElement>} className="nawab-sidebar__list" onScroll={handleScroll}>
        <motion.button
          ref={newChatBtnRef}
          className={`nawab-sidebar__new-chat-item${isCurrentThreadEmpty ? " nawab-sidebar__new-chat-item--disabled" : ""}`}
          onClick={
            isCurrentThreadEmpty
              ? undefined
              : () => {
                  if (newChatBtnRef.current) pulseBorder(newChatBtnRef.current);
                  onNewChat();
                }
          }
          title={isCurrentThreadEmpty ? "Current chat is empty" : "New thread (⌘K)"}
          whileHover={isCurrentThreadEmpty ? undefined : { scale: 1.01 }}
          whileTap={isCurrentThreadEmpty ? undefined : { scale: 0.98 }}
          transition={silkTransition}
          style={{ opacity: isCurrentThreadEmpty ? 0.4 : 1, cursor: isCurrentThreadEmpty ? "default" : "pointer" }}
        >
          <span className="nawab-sidebar__new-chat-icon">+</span>
          <span className="nawab-sidebar__new-chat-label">New thread</span>
          <kbd className="nawab-sidebar__kbd">⌘K</kbd>
        </motion.button>

        {loading && (
          <div style={{ padding: "0.5rem 0" }}>
            {[0, 1, 2, 3].map((i) => <ConvSkeleton key={i} />)}
          </div>
        )}

        {!loading && error && (
          <div className="nawab-sidebar__empty">
            <span style={{ fontSize: "1.4rem", opacity: 0.4 }}>⚠</span>
            <span>{error}</span>
            <button className="nawab-sidebar__retry" onClick={() => fetchPage(1)}>Retry</button>
          </div>
        )}

        <motion.div
          className="nawab-sidebar__conv-list-inner"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {!loading && !error && filtered.length === 0 && (
            <div className="nawab-sidebar__empty">
              <span className="nawab-sidebar__empty-symbol" style={{ color: city.color }}>{city.symbol}</span>
              <span>No conversations yet.</span>
              <span className="nawab-sidebar__empty-hint">Start chatting to see your history here.</span>
            </div>
          )}
          {!loading && !error && filtered.map((c) => {
            const isActive = c.thread_id === activeThreadId;
            return (
              <motion.div
                key={c.thread_id}
                className="nawab-sidebar__item-wrap"
                variants={staggerItem}
                onMouseEnter={() => setHoveredThread(c.thread_id)}
                onMouseLeave={() => setHoveredThread(null)}
              >
                <motion.button
                  className={`nawab-sidebar__item${isActive ? " nawab-sidebar__item--active" : ""}`}
                  onClick={() => onSelectThread(c.thread_id, c.message_count)}
                  whileHover={{ x: 2 }}
                  transition={silkTransition}
                >
                  <span className="nawab-sidebar__item-title">{titleFor(c)}</span>
                </motion.button>
                <button
                  className="nawab-sidebar__item-delete"
                  onClick={(e) => handleDelete(e, c.thread_id)}
                  aria-label="Delete conversation"
                  title="Delete"
                  style={{ opacity: hoveredThread === c.thread_id ? 1 : 0 }}
                >
                  <IconTrash />
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {loadingMore && (
          <div style={{ padding: "0.5rem 0" }}>
            <ConvSkeleton />
          </div>
        )}
      </nav>

      {/* ── Bottom: links + socials + user (scrollable, capped height) ── */}
      <div className="nawab-sidebar__bottom">
      {/* ── Community links ── */}
      <div className="nawab-sidebar__links">
        <a href="/about" className="nawab-sidebar__link">About</a>
        <a
          href="https://lucknowai.github.io/"
          target="_blank" rel="noopener noreferrer"
          className="nawab-sidebar__link"
        >
          Join Lucknow AI Labs ↗
        </a>
        <a
          href="https://github.com/LucknowAI"
          target="_blank" rel="noopener noreferrer"
          className="nawab-sidebar__link"
        >
          Contribute ↗
        </a>
        <button
          className="nawab-sidebar__link nawab-sidebar__link--btn"
          onClick={() => router.push("/feedback")}
        >
          Give feedback
        </button>
      </div>

      {/* ── Socials ── */}
      <div className="nawab-sidebar__socials">
        {SOCIALS.map(s => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="nawab-sidebar__social-btn"
            aria-label={s.label}
          >
            <span className="nawab-sidebar__social-name">{s.label}</span>
            <span className="nawab-sidebar__social-icon">{s.icon}</span>
          </a>
        ))}
      </div>

      {/* ── Footer — user avatar + sign out ── */}
      <div className="nawab-sidebar__footer nawab-sidebar__footer--user">
        {user?.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.full_name ?? user.email}
            width={24}
            height={24}
            style={{
              borderRadius: "50%",
              border: `1.5px solid ${city.color}`,
              flexShrink: 0,
            }}
            referrerPolicy="no-referrer"
          />
        )}
        <span className="nawab-sidebar__footer-name">
          {user?.full_name ?? user?.email ?? ""}
        </span>
        <button className="nawab-sidebar__signout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
      </div>{/* ── end .nawab-sidebar__bottom ── */}
    </aside>
  );
}
