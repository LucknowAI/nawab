"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { useAutosize } from "../hooks/useAutosize";
import { errorMessage, unwrap } from "../lib/api";

/* ─── Types ─────────────────────────────────────────────────── */
interface FeedbackItem {
  id: number;
  message: string;
  created_at: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function groupByDate(items: FeedbackItem[]) {
  const groups: { label: string; items: FeedbackItem[] }[] = [];
  const map = new Map<string, FeedbackItem[]>();
  for (const item of items) {
    const label = formatDate(item.created_at);
    if (!map.has(label)) { map.set(label, []); groups.push({ label, items: map.get(label)! }); }
    map.get(label)!.push(item);
  }
  return groups;
}

/* ─── Back button ────────────────────────────────────────────── */
function BackButton() {
  const router = useRouter();
  return (
    <button className="fbp-back" onClick={() => router.push("/")} aria-label="Back to chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 5 5 12 12 19" />
      </svg>
      Back to chat
    </button>
  );
}

/* ─── Submit section ─────────────────────────────────────────── */
function SubmitSection({ onSubmitted }: { onSubmitted: () => void }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 1000;

  useAutosize(textareaRef, message, 320);

  useEffect(() => {
    if (!done) textareaRef.current?.focus();
  }, [done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = message.trim();
    if (!msg || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, "Failed to submit"));
      }
      setMessage("");
      setDone(true);
      onSubmitted();
      setTimeout(() => setDone(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="fbp-success">
        <span className="fbp-success__star">✦</span>
        <h2 className="fbp-success__title">Thank you</h2>
        <p className="fbp-success__body">
          Your feedback has been sent to the team. We read every message.
        </p>
        <button className="fbp-success__again" onClick={() => setDone(false)}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="fbp-form" onSubmit={handleSubmit}>
      <div className={`fbp-field${message.length > MAX * 0.9 ? " fbp-field--warn" : ""}`}>
        <textarea
          ref={textareaRef}
          className="fbp-textarea"
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MAX))}
          placeholder="What's working? What's broken? What would you love to see?"
          rows={5}
          disabled={submitting}
          autoFocus
        />
        <div className="fbp-field__footer">
          {error
            ? <span className="fbp-field__error" role="alert">{error}</span>
            : <span />
          }
          <span className={`fbp-charcount${message.length > MAX * 0.9 ? " fbp-charcount--warn" : ""}`}>
            {message.length}/{MAX}
          </span>
        </div>
      </div>
      <button
        type="submit"
        className="fbp-submit"
        disabled={!message.trim() || submitting}
      >
        {submitting
          ? <><span className="fbp-submit__spinner" />Sending…</>
          : "Send feedback"}
      </button>
    </form>
  );
}

/* ─── History section ────────────────────────────────────────── */
function HistorySection({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/feedback", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      setItems((await unwrap(res)) ?? []);
    } catch {
      setError("Could not load your feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const groups = groupByDate(items);

  return (
    <section className="fbp-history">
      <div className="fbp-history__header">
        <span className="fbp-history__rule" />
        <h2 className="fbp-history__label">Your previous feedback</h2>
        <span className="fbp-history__rule" />
      </div>

      {loading && (
        <div className="fbp-history__list">
          {[80, 56, 72].map((w, i) => (
            <div key={i} className="fbp-skel-row">
              <div className="fbp-skel nawab-shimmer" style={{ width: `${w}%`, height: 14 }} />
              <div className="fbp-skel nawab-shimmer" style={{ width: "40%", height: 10 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="fbp-empty">
          <span>⚠ {error}</span>
          <button className="fbp-retry" onClick={load}>Try again</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="fbp-empty">Nothing submitted yet — your feedback above will appear here.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="fbp-history__list">
          {groups.map(group => (
            <div key={group.label} className="fbp-group">
              <div className="fbp-group__date">{group.label}</div>
              {group.items.map(fb => (
                <div key={fb.id} className="fbp-entry">
                  <time className="fbp-entry__time">{formatTime(fb.created_at)}</time>
                  <p className="fbp-entry__msg">{fb.message}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
function FeedbackPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="fbp-page">
      <div className="fbp-wrap">
        <BackButton />

        {/* Hero */}
        <header className="fbp-hero">
          <div className="fbp-hero__star">✦</div>
          <h1 className="fbp-hero__title">Feedback</h1>
          <p className="fbp-hero__sub">
            Help us build a better Nawab AI. Every message is read by the team.
          </p>
        </header>

        <SubmitSection onSubmitted={() => setRefreshKey(k => k + 1)} />
        <HistorySection refreshKey={refreshKey} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <FeedbackPage />
    </AuthGuard>
  );
}
