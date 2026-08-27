"use client";

/**
 * Loading skeleton block. The CSS lives in `.nawab-shimmer` (globals.css) so the
 * markup-side and stylesheet-side skeletons share one gradient and one timing —
 * there were four hand-copied variants, each with a slightly different mid-stop.
 */
export function Shimmer({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return <div className={className ? `nawab-shimmer ${className}` : "nawab-shimmer"} style={style} />;
}
