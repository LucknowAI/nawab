"use client";

/**
 * NawabMascot — a small courtier who lives on the rim of the input box.
 * Strolls the boundary, hangs off it, twirls his moustache, bows, waves.
 * Purely decorative: aria-hidden, and the track never intercepts pointer events.
 *
 * Palette follows the reference art: cream sherwani and turban, gold trim,
 * navy shawl. The city accent drives every gold surface, so he re-themes
 * with the rest of the app instead of being hardcoded to Lucknow gold.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

const CREAM     = "#F8F4EC";
const CREAM_DIM = "#E4DACA";
const SKIN      = "#F0D9BC";
const NAVY      = "#2B3557";
const INK       = "#2A1E16";
const HAIR      = "#241C18";
const BEARD     = "#D9D4CB";
const GEM       = "#3E8E8E";

/* Moods he cycles through. `hold` is how long each one stays on screen. */
const MOODS = [
  { name: "stroll", hold: 7600 },
  { name: "hang",   hold: 6200 },
  { name: "twirl",  hold: 4600 },
  { name: "bow",    hold: 3600 },
  { name: "wave",   hold: 3800 },
  { name: "peek",   hold: 5200 },
  { name: "ponder", hold: 4800 },
] as const;

type Mood = (typeof MOODS)[number]["name"] | "attentive";

export default function NawabMascot({
  color,
  variant = "landing",
  attentive = false,
}: {
  color: string;
  /** landing = larger figure on the hero box; chat = compact, on the docked bar */
  variant?: "landing" | "chat";
  /** while the user is typing he stops wandering and watches the field instead */
  attentive?: boolean;
}) {
  const [mood, setMood] = useState<Mood>("stroll");
  const [reduced, setReduced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Pick a different mood than the one just shown, so he never repeats twice. */
  // Named function expression so the self-reference is hoisted into its own
  // scope — referencing the `scheduleNext` const from inside itself is a TDZ trap.
  const scheduleNext = useCallback(function tick() {
    let next = lastRef.current;
    while (next === lastRef.current && MOODS.length > 1) {
      next = Math.floor(Math.random() * MOODS.length);
    }
    lastRef.current = next;
    const picked = MOODS[next];
    setMood(picked.name);
    timerRef.current = setTimeout(tick, picked.hold);
  }, []);

  useEffect(() => {
    if (reduced || attentive) return;
    timerRef.current = setTimeout(scheduleNext, MOODS[0].hold);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reduced, attentive, scheduleNext]);

  const active: Mood = reduced ? "ponder" : attentive ? "attentive" : mood;

  return (
    <div className={`nawab-mascot-track nawab-mascot-track--${variant}`} aria-hidden="true">
      <div
        className={`nawab-mascot is-${active}`}
        style={{ "--mc": color } as React.CSSProperties}
      >
        <svg viewBox="0 0 64 88" className="nawab-mascot__svg">
          {/*
            Head is painted back-to-front: face, then the hair mass over the
            skull, then the turban on top of the hair. That ordering is what
            keeps the cloth sitting ON him rather than floating above a bare
            scalp. Turban lives inside .m-head so it tilts with the head.
          */}
          <g className="m-head">
            <ellipse cx="32" cy="42" rx="13" ry="11.8" fill={SKIN} stroke={INK} strokeWidth="0.9" />

            {/* full hair mass: hairline stops just above the brows, bushy at the temples */}
            <path
              d="M18.4 46.5 C 15.2 42, 15.6 32.6, 19.6 28.8 C 23 25.6, 41 25.6, 44.4 28.8
                 C 48.4 32.6, 48.8 42, 45.6 46.5 C 46 41.2, 45.2 37, 43 35.6
                 C 40 33.8, 36 35.2, 32 35 C 28 35.2, 24 33.8, 21 35.6
                 C 18.8 37, 18 41.2, 18.4 46.5 Z"
              fill={HAIR}
              stroke={INK}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />

            {/* ears */}
            <ellipse cx="19.5" cy="42.6" rx="2.3" ry="3" fill={SKIN} stroke={INK} strokeWidth="0.7" />
            <ellipse cx="44.5" cy="42.6" rx="2.3" ry="3" fill={SKIN} stroke={INK} strokeWidth="0.7" />

            {/* trimmed grey beard along the jaw */}
            <path className="m-beard" d="M21.6 44 C 21.1 50.6, 25.6 55.2, 32 55.2 C 38.4 55.2, 42.9 50.6, 42.4 44 C 41 49.2, 37 51.2, 32 51.2 C 27 51.2, 23 49.2, 21.6 44 Z" fill={BEARD} />

            {/* brows */}
            <path className="m-brow m-brow--l" d="M22.8 38.6 Q 27 36.2, 31 38.4" stroke={HAIR} strokeWidth="1.9" strokeLinecap="round" fill="none" />
            <path className="m-brow m-brow--r" d="M33 38.4 Q 37 36.2, 41.2 38.6" stroke={HAIR} strokeWidth="1.9" strokeLinecap="round" fill="none" />

            {/* eyes, with a highlight so they stay lively at small sizes */}
            <g className="m-eyes">
              <ellipse className="m-eye m-eye--l" cx="27" cy="43.4" rx="2.9" ry="3.2" fill={INK} />
              <ellipse className="m-eye m-eye--r" cx="37" cy="43.4" rx="2.9" ry="3.2" fill={INK} />
              <circle cx="28.1" cy="42.2" r="1.05" fill="#FFFFFF" />
              <circle cx="38.1" cy="42.2" r="1.05" fill="#FFFFFF" />
            </g>

            {/* the moustache does most of the acting */}
            <path
              className="m-moustache"
              d="M32 49 C 28 46.5, 21.6 46.5, 19.6 50.5 C 18.4 53.2, 21.9 54.2, 23.5 51.8 C 25.1 49.4, 28.4 49.2, 32 50.6 C 35.6 49.2, 38.9 49.4, 40.5 51.8 C 42.1 54.2, 45.6 53.2, 44.4 50.5 C 42.4 46.5, 36 46.5, 32 49 Z"
              fill={HAIR}
            />

            {/* ── turban, worn over the hair ── */}
            <path
              className="m-turban"
              d="M13.8 31 C 13.8 13, 23.8 6.4, 32 6.4 C 40.2 6.4, 50.2 13, 50.2 31 Z"
              fill={CREAM}
              stroke={INK}
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            {/* shaded underside so the dome reads as fabric with volume */}
            <path d="M13.8 31 C 13.8 18, 19.4 10.4, 25.6 7.8 C 20.6 12.6, 18.2 21, 18.4 31 Z" fill={CREAM_DIM} opacity="0.75" />
            {/* wrap folds */}
            <g stroke={INK} strokeOpacity="0.28" strokeWidth="0.85" fill="none" strokeLinecap="round">
              <path d="M16.4 26.6 C 19.6 16.8, 25.4 11.2, 32.4 10" />
              <path d="M20.4 29.6 C 23.8 20.6, 29.6 14.8, 37 12.8" />
              <path d="M25.4 30.8 C 28.8 23.2, 34.4 18.4, 41.4 16.4" />
            </g>
            {/* gold wrap band, sitting low so no bare forehead shows */}
            <path
              className="m-turban-band"
              d="M13.85 25.6 C 21.6 30.8, 42.4 30.8, 50.15 25.6 L 50.2 29.8 C 42.4 35, 21.6 35, 13.8 29.8 Z"
              fill="var(--mc)"
              stroke={INK}
              strokeWidth="0.7"
            />

            {/* ── kalgi plume + sarpech jewel ── */}
            <g className="m-plume">
              <path
                d="M38 12 C 41 4.5, 46 1.5, 49 1.5 C 48 7, 44.5 12, 40 14.5 Z"
                fill={CREAM}
                stroke={INK}
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
            </g>
            <circle cx="38.6" cy="15.6" r="3.1" fill="var(--mc)" stroke={INK} strokeWidth="0.7" />
            <circle cx="38.6" cy="15.6" r="1.35" fill={GEM} />
          </g>

          {/* ── sherwani ── */}
          <path
            className="m-body"
            d="M32 53.4 C 25.5 53.4, 21.4 57, 20.5 61.4 L 18.6 78 L 45.4 78 L 43.5 61.4 C 42.6 57, 38.5 53.4, 32 53.4 Z"
            fill={CREAM}
            stroke={INK}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* gold hem */}
          <path className="m-sash" d="M18.95 74.8 L 45.05 74.8 L 45.4 78 L 18.6 78 Z" fill="var(--mc)" stroke={INK} strokeWidth="0.6" />
          {/* navy shawl over one shoulder */}
          <path
            className="m-shawl"
            d="M27.4 54 C 24 55.2, 22 57.4, 21.3 60.6 L 19.6 75.4 L 24.4 75.4 L 25.8 61 C 26.2 58.4, 27.2 56.4, 29 55.2 Z"
            fill={NAVY}
            stroke={INK}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d="M27.9 54.4 C 25.2 55.6, 23.4 57.6, 22.8 60.4 L 21.2 75.4" stroke="var(--mc)" strokeWidth="0.9" fill="none" opacity="0.9" />
          {/* gold collar + necklace + buttons */}
          <path d="M27.2 53.9 C 29 57.6, 35 57.6, 36.8 53.9 L 35.4 53.1 C 34.2 55.7, 29.8 55.7, 28.6 53.1 Z" fill="var(--mc)" stroke={INK} strokeWidth="0.55" />
          <path d="M27.6 57.6 C 29.4 61.6, 34.6 61.6, 36.4 57.6" stroke="var(--mc)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="64.4" r="1.15" fill="var(--mc)" />
          <circle cx="32" cy="68.6" r="1.15" fill="var(--mc)" />

          {/* ── churidar + curl-toed jutti ── */}
          <g className="m-leg m-leg--l">
            <path d="M24.4 78 L 28.6 78 L 28.2 83.4 L 24.8 83.4 Z" fill={CREAM} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M23.4 83 L 29.2 83 L 29.2 86.2 L 22.6 86.2 C 21.1 86.2, 20.9 84.5, 22.5 84.1 C 23.1 83.95, 23.4 83.6, 23.4 83 Z" fill="var(--mc)" stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
          </g>
          <g className="m-leg m-leg--r">
            <path d="M35.4 78 L 39.6 78 L 39.2 83.4 L 35.8 83.4 Z" fill={CREAM} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M40.6 83 L 34.8 83 L 34.8 86.2 L 41.4 86.2 C 42.9 86.2, 43.1 84.5, 41.5 84.1 C 40.9 83.95, 40.6 83.6, 40.6 83 Z" fill="var(--mc)" stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
          </g>

          {/* ── arms last, so they read on top of the sherwani ── */}
          <g className="m-arm m-arm--l">
            <path d="M22.6 58.6 L 14.9 67" stroke={INK} strokeWidth="6.6" strokeLinecap="round" fill="none" />
            <path d="M22.6 58.6 L 14.9 67" stroke={CREAM} strokeWidth="5.1" strokeLinecap="round" fill="none" />
            <path d="M17.2 65.2 L 15.6 66.9" stroke={CREAM_DIM} strokeWidth="5.1" fill="none" />
            <path d="M16.9 65.5 L 15.4 67.1" stroke="var(--mc)" strokeWidth="4.6" fill="none" />
            <circle cx="13.5" cy="68.4" r="3.2" fill={SKIN} stroke={INK} strokeWidth="0.8" />
          </g>
          <g className="m-arm m-arm--r">
            <path d="M41.4 58.6 L 49.1 67" stroke={INK} strokeWidth="6.6" strokeLinecap="round" fill="none" />
            <path d="M41.4 58.6 L 49.1 67" stroke={CREAM} strokeWidth="5.1" strokeLinecap="round" fill="none" />
            <path d="M46.8 65.2 L 48.4 66.9" stroke={CREAM_DIM} strokeWidth="5.1" fill="none" />
            <path d="M47.1 65.5 L 48.6 67.1" stroke="var(--mc)" strokeWidth="4.6" fill="none" />
            <circle cx="50.5" cy="68.4" r="3.2" fill={SKIN} stroke={INK} strokeWidth="0.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}
