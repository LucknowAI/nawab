"use client";

import React from "react";
import { Card } from "./ui/Card";
import { Shimmer } from "./ui/Shimmer";
import { RemoteImg } from "./ui/RemoteImg";
import { Lightbox } from "./ui/Lightbox";

/* The keyframes these cards animate with (nawab-fade-up, nawab-pulse,
   nawab-shimmer, nawab-spin) live in globals.css. They used to be injected here
   as a <style> tag rendered 16 times over. */

export function SectionHeader({ title, color = "var(--nawab-gold)" }: { title?: string; color?: string }) {
  if (!title) return null;
  return (
    <p style={{ margin: "0 0 10px", fontFamily: "'Fredoka', sans-serif", fontWeight: 500, fontSize: "0.92rem", color: "var(--nawab-ink)", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8, animation: "nawab-fade-up 0.4s ease both" }}>
      <span style={{ color, fontSize: "10px" }}>✦</span>
      {title}
    </p>
  );
}


export function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin", scrollbarColor: "var(--nawab-border) transparent" }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ① PLACES  (tourist spots, landmarks)
═══════════════════════════════════════════════════════════ */
export interface Place {
  name: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  link?: string;
}

export function PlaceCard({ place, wide }: { place: Place; wide?: boolean }) {
  return (
    <Card
      link={place.link}
      accent="#b8864e"
      style={{ display: "flex", flexDirection: "column", width: wide ? "100%" : 160, minWidth: wide ? 0 : 160, flexShrink: 0 }}
    >
      {hovered => (
        <>
          <div style={{ width: "100%", height: wide ? 200 : 110, background: "linear-gradient(135deg, #e8d9bf 0%, #c9a96e22 100%)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RemoteImg
              src={place.thumbnailUrl || place.imageUrl}
              fallbackSrc={place.thumbnailUrl ? place.imageUrl : undefined}
              alt={place.name}
              fallback={<span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "2.2rem", color: "var(--nawab-gold)", opacity: 0.5, fontWeight: 300 }}>{place.name?.charAt(0) ?? "?"}</span>}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.3s", transform: hovered ? "scale(1.06)" : "scale(1)" }}
            />
            <div style={{ position: "absolute", inset: 0, background: hovered ? "linear-gradient(to top, #1e172840 0%, transparent 60%)" : "transparent", transition: "background 0.2s" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(to right, var(--nawab-gold), #c9a96e44)" }} />
          </div>
          <div style={{ padding: "9px 11px 11px", display: "flex", flexDirection: "column", gap: 3 }}>
            <p style={{ margin: 0, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: "0.84rem", color: "var(--nawab-ink)", letterSpacing: "0.03em", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{place.name}</p>
            {place.description && <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{place.description}</p>}
            {place.link && <p style={{ margin: "4px 0 0", fontSize: "0.63rem", color: "var(--nawab-gold)", fontFamily: "'Google Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, opacity: hovered ? 1 : 0.75 }}>Explore →</p>}
          </div>
        </>
      )}
    </Card>
  );
}

function PlaceSkeleton() {
  return (
    <div style={{ width: 160, minWidth: 160, borderRadius: 16, overflow: "hidden", border: "none", flexShrink: 0 }}>
      <Shimmer style={{ height: 110, borderRadius: 0 }} />
      <div style={{ padding: "9px 11px 11px", display: "flex", flexDirection: "column", gap: 6, background: "var(--nawab-ivory)" }}>
        <Shimmer style={{ height: 12, width: "80%" }} />
        <Shimmer style={{ height: 10, width: "60%" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ② NEWS CARDS
═══════════════════════════════════════════════════════════ */
export interface NewsArticle {
  headline: string;
  source?: string;
  publishedAt?: string;
  imageUrl?: string;
  link?: string;
  summary?: string;
}

export function NewsCard({ article, cityColor }: { article: NewsArticle; cityColor: string }) {
  return (
    <Card
      link={article.link}
      accent={cityColor}
      style={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", flexShrink: 0 }}
    >
      {hovered => (
        <>
      {/* Image or gradient */}
      <div style={{ width: "100%", height: 140, background: `linear-gradient(135deg, ${cityColor}20 0%, var(--nawab-parchment) 100%)`, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <RemoteImg
          src={article.imageUrl}
          fallback={<span style={{ fontSize: "2rem", opacity: 0.3 }}>📰</span>}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", transform: hovered ? "scale(1.05)" : "scale(1)" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,23,40,0.5) 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${cityColor}, ${cityColor}44)` }} />
        {/* Source badge */}
        {article.source && (
          <span style={{ position: "absolute", bottom: 6, left: 8, fontFamily: "'Google Sans', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "rgba(30,23,40,0.6)", borderRadius: 4, padding: "2px 6px" }}>
            {article.source}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        <p style={{ margin: 0, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: "0.88rem", color: "var(--nawab-ink)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{article.headline}</p>
        {article.summary && <p style={{ margin: 0, fontSize: "0.67rem", color: "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif", lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{article.summary}</p>}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
          {article.publishedAt && <span style={{ fontSize: "0.6rem", color: "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif" }}>{article.publishedAt}</span>}
          {article.link && <span style={{ fontSize: "0.62rem", color: cityColor, fontFamily: "'Google Sans', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", opacity: hovered ? 1 : 0.7 }}>Read →</span>}
        </div>
      </div>
        </>
      )}
    </Card>
  );
}

function NewsSkeleton() {
  return (
    <div style={{ width: "100%", minWidth: 0, borderRadius: 16, overflow: "hidden", border: "none", flexShrink: 0 }}>
      <Shimmer style={{ height: 140, borderRadius: 0 }} />
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6, background: "var(--nawab-ivory)" }}>
        <Shimmer style={{ height: 12, width: "90%" }} />
        <Shimmer style={{ height: 12, width: "75%" }} />
        <Shimmer style={{ height: 10, width: "55%" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ③ VIDEO CARDS  (auto-play on scroll, mute toggle)
═══════════════════════════════════════════════════════════ */
export interface VideoItem {
  title: string;
  channel?: string;
  thumbnailUrl?: string;
  link?: string;
  duration?: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([^&#]+)/) ||
    url.match(/youtu\.be\/([^?&#]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?&#/]+)/) ||
    url.match(/youtube\.com\/embed\/([^?&#/]+)/);
  return m ? m[1] : null;
}

export function VideoCard({ video, cityColor, wide }: { video: VideoItem; cityColor: string; wide?: boolean }) {
  const [hovered, setHovered]   = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const [isMuted, setIsMuted]   = React.useState(true);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const iframeRef    = React.useRef<HTMLIFrameElement>(null);

  /* hover OR scroll-into-view → play */
  const isPlaying = hovered || isInView;

  const videoId  = video.link ? getYouTubeId(video.link) : null;
  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&playsinline=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${videoId}`
    : null;

  /* ── Intersection Observer: auto-play when ≥50% visible ── */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!videoId || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.intersectionRatio >= 0.5),
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [videoId]);

  /* ── Reset mute whenever video stops ── */
  React.useEffect(() => {
    if (!isPlaying) setIsMuted(true);
  }, [isPlaying]);

  /* ── Mute / Unmute via YouTube postMessage API ── */
  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isMuted;
    setIsMuted(next);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] }),
      "*",
    );
  };

  const card = (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: wide ? "100%" : 260, minWidth: wide ? 0 : 260,
        borderRadius: 16,
        overflow: "hidden",
        border: "none",
        background: "#0e0a18",
        display: "flex", flexDirection: "column",
        flexShrink: 0,
        transform: hovered ? "translateY(-4px)" : "none",
        transition: "transform 0.2s, box-shadow 0.2s",
        boxShadow: isPlaying
          ? `0 0 0 3px ${cityColor}30, 0 12px 40px ${cityColor}40`
          : hovered
          ? `0 8px 24px ${cityColor}25`
          : "0 2px 8px rgba(0,0,0,0.18)",
        animation: "nawab-fade-up 0.4s ease both",
        textDecoration: "none", color: "inherit",
        scrollSnapAlign: "start",
        cursor: "pointer",
      }}
    >
      {/* ── Video / Thumbnail area ── */}
      <div style={{ width: "100%", height: wide ? 240 : 160, position: "relative", overflow: "hidden", flexShrink: 0, background: "#0e0a18" }}>

        {/* YouTube iframe — pointer-events:none so clicks fall through to the <a> wrapper */}
        {isPlaying && embedSrc && (
          <iframe
            ref={iframeRef}
            src={embedSrc}
            allow="autoplay; encrypted-media; picture-in-picture"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", display: "block", pointerEvents: "none" }}
          />
        )}

        {/* Thumbnail — shown when not playing */}
        {!isPlaying && (
          <RemoteImg
            src={video.thumbnailUrl}
            fallback={
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, #1E1728 0%, ${cityColor}33 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "2.5rem", opacity: 0.35 }}>▶</span>
              </div>
            }
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Play button overlay — only when not playing */}
        {!isPlaying && (
          <div style={{ position: "absolute", inset: 0, background: hovered ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: hovered ? cityColor : "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: hovered ? `0 0 22px ${cityColor}90` : "0 2px 10px rgba(0,0,0,0.3)", transition: "background 0.2s, box-shadow 0.2s" }}>
              <span style={{ fontSize: "0.95rem", color: hovered ? "#fff" : "#1E1728", marginLeft: 3, lineHeight: 1 }}>▶</span>
            </div>
          </div>
        )}

        {/* Duration badge */}
        {video.duration && !isPlaying && (
          <span style={{ position: "absolute", bottom: 7, right: 8, fontFamily: "'Google Sans', sans-serif", fontSize: "0.6rem", fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.78)", borderRadius: 4, padding: "2px 6px", zIndex: 2 }}>
            {video.duration}
          </span>
        )}

        {/* Animated bars — playing indicator */}
        {isPlaying && (
          <div style={{ position: "absolute", top: 8, left: 9, display: "flex", gap: 2, alignItems: "flex-end", zIndex: 10, pointerEvents: "none" }}>
            {[9, 14, 10, 16, 11].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: cityColor, borderRadius: 2, opacity: 0.9, animation: `nawab-pulse ${0.5 + i * 0.12}s ease-in-out infinite alternate` }} />
            ))}
          </div>
        )}

        {/* Mute / Unmute — shown while playing */}
        {isPlaying && (
          <button
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            style={{ position: "absolute", bottom: 8, right: 8, zIndex: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", border: `1.5px solid ${isMuted ? "rgba(255,255,255,0.25)" : cityColor}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", color: "#fff", transition: "border-color 0.2s" }}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        )}

        {/* Top accent stripe */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${cityColor}, ${cityColor}55)`, zIndex: 3, pointerEvents: "none" }} />
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "9px 12px 11px", display: "flex", flexDirection: "column", gap: 3, background: isPlaying ? `linear-gradient(135deg, #14101f 0%, ${cityColor}18 100%)` : "var(--nawab-ivory)", transition: "background 0.4s" }}>
        <p style={{ margin: 0, fontFamily: "'Google Sans', sans-serif", fontWeight: 500, fontSize: "0.76rem", color: isPlaying ? "#f0eaff" : "var(--nawab-ink)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", transition: "color 0.3s" }}>
          {video.title}
        </p>
        {video.channel && (
          <p style={{ margin: 0, fontSize: "0.63rem", color: isPlaying ? `${cityColor}cc` : "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif", transition: "color 0.3s" }}>
            {video.channel}
          </p>
        )}
      </div>
    </div>
  );

  /* Always wrap in <a> — iframe has pointerEvents:none so all clicks open YouTube */
  return video.link
    ? <a href={video.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{card}</a>
    : card;
}

function VideoSkeleton() {
  return (
    <div style={{ width: 260, minWidth: 260, borderRadius: 16, overflow: "hidden", border: "none", flexShrink: 0 }}>
      <Shimmer style={{ height: 160, borderRadius: 0 }} />
      <div style={{ padding: "9px 12px 11px", display: "flex", flexDirection: "column", gap: 5, background: "var(--nawab-ivory)" }}>
        <Shimmer style={{ height: 11, width: "90%" }} />
        <Shimmer style={{ height: 11, width: "70%" }} />
        <Shimmer style={{ height: 9,  width: "45%" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ④ MAP RESULT CARDS  (local businesses / places from Maps)
═══════════════════════════════════════════════════════════ */
export interface MapPlace {
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  link?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
}

function StarRating({ rating, color }: { rating: number; color: string }) {
  const filled = Math.round(rating);
  return (
    <span style={{ display: "flex", gap: 1, alignItems: "center" }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ fontSize: "0.6rem", color: i <= filled ? color : "var(--nawab-border)" }}>★</span>
      ))}
    </span>
  );
}

export function MapPlaceCard({ place, cityColor, wide }: { place: MapPlace; cityColor: string; wide?: boolean }) {
  const [hovered, setHovered] = React.useState(false);

  // Build the Google Maps embed query — prefer lat/lng, fall back to name+address
  const mapQuery = place.lat != null && place.lng != null
    ? `${place.lat},${place.lng}`
    : encodeURIComponent([place.name, place.address].filter(Boolean).join(", "));
  const embedSrc = `https://maps.google.com/maps?q=${mapQuery}&output=embed&z=15`;

  const inner = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: wide ? "100%" : 260, minWidth: wide ? 0 : 260, borderRadius: 16, border: "none", background: "var(--nawab-ivory)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 0, flexShrink: 0, cursor: place.link ? "pointer" : "default", transform: hovered ? "translateY(-4px)" : "none", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: hovered ? `0 8px 24px ${cityColor}30` : "0 2px 8px rgba(30,23,40,0.05)", position: "relative", animation: "nawab-fade-up 0.4s ease both", textDecoration: "none", color: "inherit" }}
    >
      {/* Photo, when the Maps result actually had one — skipped entirely
          otherwise, the map embed below carries the card fine without it. */}
      {(place.thumbnailUrl || place.imageUrl) && (
        <div style={{ width: "100%", height: 110, overflow: "hidden", flexShrink: 0 }}>
          <RemoteImg
            src={place.thumbnailUrl || place.imageUrl}
            fallbackSrc={place.thumbnailUrl ? place.imageUrl : undefined}
            alt={place.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Google Maps embed */}
      <div style={{ position: "relative", width: "100%", height: 160, overflow: "hidden", flexShrink: 0 }}>
        <iframe
          src={embedSrc}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map of ${place.name}`}
        />
        {/* Accent bar at top of map */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${cityColor}, ${cityColor}44)` }} />
      </div>

      {/* Info section */}
      <div style={{ padding: "12px 14px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Category badge */}
        {place.category && (
          <span style={{ alignSelf: "flex-start", fontFamily: "'Google Sans', sans-serif", fontSize: "0.58rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: cityColor, background: `${cityColor}15`, borderRadius: 999, padding: "2px 8px", border: `1px solid ${cityColor}30` }}>
            {place.category}
          </span>
        )}

        {/* Name */}
        <p style={{ margin: 0, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: "0.92rem", color: "var(--nawab-ink)", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{place.name}</p>

        {/* Rating */}
        {place.rating != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <StarRating rating={place.rating} color={cityColor} />
            <span style={{ fontFamily: "'Google Sans', sans-serif", fontSize: "0.67rem", color: "var(--nawab-ink-60)" }}>
              {place.rating.toFixed(1)}{place.reviewCount ? ` (${place.reviewCount})` : ""}
            </span>
          </div>
        )}

        {/* Address */}
        {place.address && (
          <p style={{ margin: 0, fontSize: "0.66rem", color: "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            📍 {place.address}
          </p>
        )}

        {/* Phone */}
        {place.phone && (
          <p style={{ margin: 0, fontSize: "0.64rem", color: "var(--nawab-ink-60)", fontFamily: "'Google Sans', sans-serif" }}>📞 {place.phone}</p>
        )}

        {/* CTA */}
        {place.link && (
          <p style={{ margin: "2px 0 0", fontSize: "0.62rem", color: cityColor, fontFamily: "'Google Sans', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", opacity: hovered ? 1 : 0.7, transition: "opacity 0.2s" }}>
            View on Maps →
          </p>
        )}
      </div>
    </div>
  );
  return place.link ? <a href={place.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{inner}</a> : inner;
}

function MapSkeleton() {
  return (
    <div style={{ width: 240, minWidth: 240, borderRadius: 16, border: "none", background: "var(--nawab-ivory)", padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
      <Shimmer style={{ height: 9, width: "40%" }} />
      <Shimmer style={{ height: 13, width: "85%" }} />
      <Shimmer style={{ height: 9, width: "55%" }} />
      <Shimmer style={{ height: 9, width: "70%" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ⑤ IMAGE GALLERY
═══════════════════════════════════════════════════════════ */
export interface ImageItem {
  title?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  link?: string;
  source?: string;
}

export function ImageCard({ image, cityColor, wide }: { image: ImageItem; cityColor: string; wide?: boolean }) {
  // Clicking a photo opens it full-size rather than navigating away; the source
  // page is still one click further, from inside the lightbox.
  const [zoomed, setZoomed] = React.useState(false);
  return (
    <>
    <Card
      onClick={() => setZoomed(true)}
      accent={cityColor}
      lift="scale(1.04)"
      style={{
        width: wide ? "100%" : 200, minWidth: wide ? 0 : 200, height: 220,
        position: "relative", flexShrink: 0,
        background: "var(--nawab-border)",
      }}
    >
      {hovered => (
        <>
      {/* thumbnailUrl first: it's Google's own copy and effectively always
          resolves. imageUrl points at the origin host (upload.wikimedia.org and
          friends), which is the one that 403s, 404s, or is plain http://. */}
      <RemoteImg
        src={image.thumbnailUrl || image.imageUrl}
        fallbackSrc={image.thumbnailUrl ? image.imageUrl : undefined}
        alt={image.title || ""}
        fallback={
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e8d9bf, #c9a96e22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "2rem", opacity: 0.4 }}>🖼️</span>
          </div>
        }
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.3s", transform: hovered ? "scale(1.08)" : "scale(1)" }}
      />
      {/* Gradient overlay on hover showing title */}
      {image.title && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: hovered ? "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" : "transparent",
          padding: "20px 8px 7px", transition: "background 0.2s",
        }}>
          {hovered && (
            <p style={{ margin: 0, fontFamily: "'Google Sans', sans-serif", fontSize: "0.62rem", color: "#fff", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {image.title}
            </p>
          )}
        </div>
      )}
      {/* Accent top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, ${cityColor}, ${cityColor}44)` }} />
        </>
      )}
    </Card>
    {zoomed && (
      <Lightbox
        src={image.thumbnailUrl || image.imageUrl}
        fallbackSrc={image.thumbnailUrl ? image.imageUrl : undefined}
        alt={image.title || ""}
        caption={image.title}
        link={image.link}
        onClose={() => setZoomed(false)}
      />
    )}
    </>
  );
}

function ImageSkeleton() {
  return <Shimmer style={{ width: 200, minWidth: 200, height: 220, borderRadius: 16, flexShrink: 0 }} />;
}

/* ═══════════════════════════════════════════════════════════
   ⑥ FACT / HIGHLIGHT CARD
═══════════════════════════════════════════════════════════ */
export interface FactData {
  title: string;
  content: string;
  category?: string; // history | food | culture | festival | architecture | person
}

const CATEGORY_ICONS: Record<string, string> = {
  history: "🏛️", food: "🍽️", culture: "🎭", festival: "🪔",
  architecture: "🕌", person: "👤", default: "✦",
};

export function FactCard({ fact, cityColor }: { fact: FactData; cityColor: string }) {
  const icon = CATEGORY_ICONS[fact.category ?? "default"] ?? CATEGORY_ICONS.default;
  return (
    <div style={{ borderRadius: 16, border: "none", background: `linear-gradient(135deg, var(--nawab-ivory) 0%, ${cityColor}08 100%)`, padding: "1.5rem 1.75rem", position: "relative", overflow: "hidden", animation: "nawab-fade-up 0.5s ease both" }}>
      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(to right, ${cityColor}, ${cityColor}55)` }} />
      {/* Large watermark quote */}
      <span style={{ position: "absolute", top: -10, right: 16, fontFamily: "'Fredoka', sans-serif", fontSize: "6rem", color: cityColor, opacity: 0.06, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>&ldquo;</span>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        {/* Icon */}
        <span style={{ fontSize: "1.75rem", lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>

        <div style={{ flex: 1 }}>
          {fact.category && (
            <span style={{ fontFamily: "'Google Sans', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: cityColor, marginBottom: "0.5rem", display: "block" }}>
              {fact.category}
            </span>
          )}
          <h3 style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 500, fontSize: "1.15rem", color: "var(--nawab-ink)", margin: "0 0 0.5rem", letterSpacing: "0.03em", lineHeight: 1.3 }}>{fact.title}</h3>
          <p style={{ fontFamily: "'Google Sans', sans-serif", fontSize: "0.82rem", color: "var(--nawab-ink-60)", lineHeight: 1.65, margin: 0 }}>{fact.content}</p>
        </div>
      </div>
    </div>
  );
}

export interface MetroStationPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface MetroRouteData {
  origin_input: string;
  origin_station: MetroStationPoint;
  origin_walk_km: number;
  destination_input: string;
  destination_station: MetroStationPoint;
  destination_walk_km: number;
  distance_km: number;
  fare_inr: number;
  num_stops: number;
  fare_source?: "official" | "estimated";
  travel_time?: string | null;
  origin_station_status?: string | null;
  destination_station_status?: string | null;
}

/** A map pin that keeps the exact station coordinates but labels them with the
 *  station's name — without the label Google reverse-geocodes the point to
 *  whatever shop or park happens to sit next to the station entrance. */
function metroPin(point: MetroStationPoint) {
  return encodeURIComponent(`${point.lat},${point.lng} (${point.name} Metro Station)`);
}

/** "0:24:00" → "24 min". Returns null for zero/absent durations. */
function formatTravelTime(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  const [h = 0, m = 0, s = 0] = parts;
  const totalMinutes = h * 60 + m + Math.round(s / 60);
  if (totalMinutes <= 0) return null;
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

export function MetroRouteCard({ route, cityColor }: { route: MetroRouteData; cityColor: string }) {
  const { origin_station, destination_station } = route;
  // dirflg=r asks for transit directions — without it Google embeds a driving
  // route, which has nothing to do with the metro trip being described.
  const embedSrc = `https://maps.google.com/maps?saddr=${metroPin(origin_station)}&daddr=${metroPin(destination_station)}&dirflg=r&output=embed`;
  const travelTime = formatTravelTime(route.travel_time);
  const isEstimated = route.fare_source === "estimated";
  const closedStation = [
    route.origin_station_status && !/open/i.test(route.origin_station_status) ? origin_station.name : null,
    route.destination_station_status && !/open/i.test(route.destination_station_status) ? destination_station.name : null,
  ].filter(Boolean);

  return (
    <div style={{ borderRadius: 16, border: "none", background: "var(--nawab-ivory)", overflow: "hidden", position: "relative", animation: "nawab-fade-up 0.5s ease both" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(to right, ${cityColor}, ${cityColor}55)`, zIndex: 1 }} />

      <div style={{ padding: "1.25rem 1.5rem 1rem" }}>
        <span style={{ fontFamily: "'Google Sans', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: cityColor, display: "flex", alignItems: "center", gap: 6 }}>
          🚇 Metro Route
        </span>

        <p style={{ margin: "0.6rem 0 0", fontFamily: "'Google Sans', sans-serif", fontSize: "0.8rem", color: "var(--nawab-ink-60)" }}>
          {route.origin_walk_km > 0.05
            ? <>Walk ~{route.origin_walk_km} km to <strong style={{ color: "var(--nawab-ink)" }}>{origin_station.name}</strong></>
            : <>Board at <strong style={{ color: "var(--nawab-ink)" }}>{origin_station.name}</strong></>}
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0.75rem 0", padding: "0.75rem 1rem", borderRadius: 12, background: `${cityColor}0c`, border: `1px solid ${cityColor}25` }}>
          <h3 style={{ margin: 0, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "var(--nawab-ink)", lineHeight: 1.35 }}>
            {origin_station.name} → {destination_station.name}
          </h3>
          <span style={{ flexShrink: 0, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: "1.1rem", color: cityColor }}>
            {isEstimated ? "~" : ""}₹{route.fare_inr}
          </span>
        </div>
        <p style={{ margin: 0, fontFamily: "'Google Sans', sans-serif", fontSize: "0.7rem", color: "var(--nawab-ink-60)" }}>
          {route.num_stops} stop{route.num_stops === 1 ? "" : "s"} · {route.distance_km} km ride
          {travelTime ? ` · ~${travelTime} on the train` : ""}
          {isEstimated ? " · fare approximate" : ""}
        </p>

        <p style={{ margin: "0.6rem 0 0", fontFamily: "'Google Sans', sans-serif", fontSize: "0.8rem", color: "var(--nawab-ink-60)" }}>
          {route.destination_walk_km > 0.05
            ? <>Get off at <strong style={{ color: "var(--nawab-ink)" }}>{destination_station.name}</strong>, then walk ~{route.destination_walk_km} km</>
            : <>Get off at <strong style={{ color: "var(--nawab-ink)" }}>{destination_station.name}</strong></>}
        </p>

        {closedStation.length > 0 && (
          <p style={{ margin: "0.5rem 0 0", fontFamily: "'Google Sans', sans-serif", fontSize: "0.72rem", color: "#b45309" }}>
            ⚠ Check before you travel — {closedStation.join(" and ")} may not be open.
          </p>
        )}
      </div>

      <div style={{ width: "100%", height: 220 }}>
        <iframe
          src={embedSrc}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Metro route from ${origin_station.name} to ${destination_station.name}`}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LOADING STATES
═══════════════════════════════════════════════════════════ */
function SectionLoading({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      padding: "8px 12px",
      marginBottom: 8,
      borderRadius: 10,
      border: `1px solid ${color}25`,
      background: `linear-gradient(to right, ${color}08, transparent)`,
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "nawab-fade-up 0.3s ease both",
    }}>
      {/* Three-dot bouncing indicator */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              animation: `nawab-pulse ${0.6 + i * 0.15}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <span style={{
        fontFamily: "'Google Sans', sans-serif",
        fontSize: "0.74rem",
        color: "var(--nawab-ink)",
        letterSpacing: "0.04em",
        fontWeight: 450,
      }}>
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ⑦ SOURCES CARD
═══════════════════════════════════════════════════════════ */
function SourcesCard({ sources, cityColor }: { sources: { title?: string; url: string }[]; cityColor: string }) {
  return (
    <div style={{
      marginTop: 8, padding: "10px 14px", borderRadius: 12,
      border: `1px solid ${cityColor}25`, background: `${cityColor}06`,
      animation: "nawab-fade-up 0.3s ease both",
    }}>
      <p style={{
        margin: "0 0 8px", fontSize: "0.62rem", fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase", color: cityColor,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>✦</span> Sources
      </p>
      {sources.map((s, i) => (
        <a
          key={i} href={s.url} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            fontSize: "0.71rem", color: "var(--nawab-ink-60)",
            textDecoration: "none", padding: "4px 0",
            borderBottom: i < sources.length - 1 ? `1px solid ${cityColor}12` : "none",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = cityColor)}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--nawab-ink-60)")}
        >
          <span style={{ flexShrink: 0, opacity: 0.5, fontSize: "0.65rem", marginTop: 1 }}>{i + 1}.</span>
          <span style={{ flex: 1, lineHeight: 1.45, wordBreak: "break-word" }}>
            {s.title || s.url}
          </span>
        </a>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CITY COLORS
═══════════════════════════════════════════════════════════ */
/**
 * Card accents need the raw hex because they do alpha math on it
 * (`${cityColor}30`), which a CSS custom property can't provide — so this map
 * has to mirror the `--city-color` values in globals.css `[data-city]`.
 *
 * ponytail: duplicated on purpose; `__tests__/city-colors.test.ts` fails if the
 * two drift. Collapse to CSS-only if the ~40 `${cityColor}NN` sites are ever
 * rewritten to color-mix().
 */
export const CITY_COLORS: Record<string, string> = {
  lucknow:  "#C8782E",
  varanasi: "#D96020",
  kanpur:   "#1A80C0",
  noida:    "#8840CC",
};

/* ═══════════════════════════════════════════════════════════
   renderToolCall — dispatches tool name → card component
   args === null  → streaming skeleton
   args !== null  → resolved card
═══════════════════════════════════════════════════════════ */
export function renderToolCall(
  toolName: string,
  args: Record<string, unknown> | null,
  cityColor: string,
): React.ReactNode {
  switch (toolName) {
    case "showPlaces": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Curating places…" color={cityColor} />
          <HScrollRow>{[0,1,2].map((i) => <PlaceSkeleton key={i} />)}</HScrollRow>
        </div>
      );
      const places: Place[] = ((args.places as Place[]) ?? []).filter(p => p && typeof p === "object");
      if (!places.length) return null;
      const placesTitle = args.title as string | undefined;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          {placesTitle && <SectionHeader title={placesTitle} color={cityColor} />}
          <HScrollRow>{places.map((p, i) => <PlaceCard key={i} place={p} />)}</HScrollRow>
        </div>
      );
    }
    case "showNews": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Reading the news…" color={cityColor} />
          <HScrollRow>{[0,1,2].map((i) => <NewsSkeleton key={i} />)}</HScrollRow>
        </div>
      );
      const articles: NewsArticle[] = (args.articles as NewsArticle[]) ?? [];
      if (!articles.length) return null;
      const newsTitle = args.title as string | undefined;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          {newsTitle && <SectionHeader title={newsTitle} color={cityColor} />}
          <HScrollRow>{articles.map((a, i) => <NewsCard key={i} article={a} cityColor={cityColor} />)}</HScrollRow>
        </div>
      );
    }
    case "showVideos": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Finding videos…" color={cityColor} />
          <HScrollRow>{[0,1,2].map((i) => <VideoSkeleton key={i} />)}</HScrollRow>
        </div>
      );
      const videos: VideoItem[] = (args.videos as VideoItem[]) ?? [];
      if (!videos.length) return null;
      const videosTitle = args.title as string | undefined;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          {videosTitle && <SectionHeader title={videosTitle} color={cityColor} />}
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin" }}>
            {videos.map((v, i) => <VideoCard key={i} video={v} cityColor={cityColor} />)}
          </div>
        </div>
      );
    }
    case "showMapResults": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Finding places nearby…" color={cityColor} />
          <HScrollRow>{[0,1,2].map((i) => <MapSkeleton key={i} />)}</HScrollRow>
        </div>
      );
      const places: MapPlace[] = (args.places as MapPlace[]) ?? [];
      if (!places.length) return null;
      const mapsTitle = args.title as string | undefined;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          {mapsTitle && <SectionHeader title={mapsTitle} color={cityColor} />}
          <HScrollRow>{places.map((p, i) => <MapPlaceCard key={i} place={p} cityColor={cityColor} />)}</HScrollRow>
        </div>
      );
    }
    case "showImages": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Fetching images…" color={cityColor} />
          <HScrollRow>{[0,1,2,3].map((i) => <ImageSkeleton key={i} />)}</HScrollRow>
        </div>
      );
      const images: ImageItem[] = (args.images as ImageItem[]) ?? [];
      if (!images.length) return null;
      const imagesTitle = args.title as string | undefined;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          {imagesTitle && <SectionHeader title={imagesTitle} color={cityColor} />}
          <HScrollRow>{images.map((img, i) => <ImageCard key={i} image={img} cityColor={cityColor} />)}</HScrollRow>
        </div>
      );
    }
    case "showFact": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Surfacing a gem…" color={cityColor} />
          <div style={{ borderRadius: 14, border: "1px solid var(--nawab-border)", padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: 8 }}>
            <Shimmer style={{ height: 9, width: "25%" }} />
            <Shimmer style={{ height: 16, width: "70%" }} />
            <Shimmer style={{ height: 11, width: "95%" }} />
            <Shimmer style={{ height: 11, width: "80%" }} />
          </div>
        </div>
      );
      if (!args.title || !args.content) return null;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          <FactCard fact={{ title: args.title as string, content: args.content as string, category: args.category as string | undefined }} cityColor={cityColor} />
        </div>
      );
    }
    case "showMetroRoute": {
      if (!args) return (
        <div style={{ padding: "4px 0 8px" }}>
          <SectionLoading label="Planning your metro route…" color={cityColor} />
        </div>
      );
      if (args.same_station || !args.origin_station || !args.destination_station) return null;
      return (
        <div style={{ padding: "4px 0 8px" }}>
          <MetroRouteCard route={args as unknown as MetroRouteData} cityColor={cityColor} />
        </div>
      );
    }
    case "showSources": {
      if (!args?.sources) return null;
      const sources = args.sources as { title?: string; url: string }[];
      if (!sources.length) return null;
      return <SourcesCard sources={sources} cityColor={cityColor} />;
    }
    default:
      return null;
  }
}
