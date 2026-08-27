"use client";
import { useState } from "react";

/**
 * An <img> for URLs we do not control.
 *
 * Every remote image in the app routes through here — the eight tool-call card
 * types and markdown-embedded images alike — so the three things that make a
 * third-party image load reliably live in exactly one place:
 *
 *  1. `src` prefers Google's CDN copy (`thumbnailUrl`) over the origin host
 *     (`imageUrl`). Serper's Images API returns both; `imageUrl` points at the
 *     arbitrary site that hosts the picture — upload.wikimedia.org and friends —
 *     which may hotlink-block, 404, be plain http://, or simply be slow. The
 *     Google-hosted thumbnail effectively always resolves. On error we fall
 *     *back* to the origin URL before giving up, so a missing thumbnail still
 *     has a chance.
 *  2. `referrerPolicy="no-referrer"`, which is what gets past hosts that reject
 *     cross-origin hotlinks by Referer.
 *  3. A caller-supplied fallback node when both URLs fail.
 */
export function RemoteImg({
  src,
  fallbackSrc,
  alt = "",
  fallback = null,
  style,
  className,
}: {
  src?: string;
  /** Tried if `src` fails — pass the origin URL when `src` is a thumbnail. */
  fallbackSrc?: string;
  alt?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const current = stage === 0 ? src : stage === 1 ? fallbackSrc : undefined;

  if (!current) return <>{fallback}</>;

  return (
    // next/image would need images.remotePatterns, but these hosts are unknown
    // until runtime — the model picks them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setStage(s => (s === 0 && fallbackSrc ? 1 : 2))}
    />
  );
}
