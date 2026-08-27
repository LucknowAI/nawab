"use client";
import { useState } from "react";

/**
 * The shared shell behind the tool-call cards: rounded ivory surface, hover
 * lift, fade-up entrance, and the `link ? <a>…</a> : …` wrap that six card
 * types had each written out for themselves.
 *
 * The children render prop receives `hovered` so cards can drive their own
 * inner effects (image zoom, gradient overlays) off the same state.
 */
export function Card({
  link,
  onClick,
  accent,
  lift = "translateY(-4px)",
  style,
  children,
}: {
  link?: string;
  /** Handled in-app instead of navigating — cards that open a lightbox. */
  onClick?: () => void;
  /** City colour used for the hover glow. */
  accent?: string;
  /** Transform applied while hovered — some cards scale instead of rising. */
  lift?: string;
  style?: React.CSSProperties;
  children: (hovered: boolean) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const inner = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      // A clickable div still has to answer the keyboard.
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: "none",
        background: "var(--nawab-ivory)",
        cursor: link || onClick ? "pointer" : "default",
        transform: hovered ? lift : "none",
        transition: "transform 0.2s, box-shadow 0.2s",
        boxShadow: hovered
          ? `0 8px 24px ${accent ? `${accent}30` : "rgba(30,23,40,0.18)"}`
          : "0 2px 8px rgba(30,23,40,0.05)",
        animation: "nawab-fade-up 0.4s ease both",
        textDecoration: "none",
        color: "inherit",
        ...style,
      }}
    >
      {children(hovered)}
    </div>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </a>
  ) : (
    inner
  );
}
