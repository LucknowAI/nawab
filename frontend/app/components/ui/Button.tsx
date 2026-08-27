"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { silkTransition } from "@/app/lib/motion";

/**
 * Token-driven button with the hover/tap scale the app uses everywhere.
 *
 * Colours come from the CSS custom properties in globals.css, so the per-city
 * `[data-city]` overrides apply automatically — the login page used to hardcode
 * `#C8782E` and `#1C1525`, which left it Lucknow-orange whichever city was
 * selected.
 */
export function Button({
  variant = "primary",
  full,
  style,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost";
  full?: boolean;
} & HTMLMotionProps<"button">) {
  const active = !rest.disabled;

  const palette: Record<string, React.CSSProperties> = {
    primary: {
      background: active ? "var(--nawab-gold)" : "rgba(184,134,78,0.15)",
      color: active ? "#fff" : "var(--nawab-ink-60)",
      border: "none",
    },
    secondary: {
      background: "var(--nawab-parchment)",
      color: "var(--nawab-ink)",
      border: "1px solid var(--nawab-border)",
    },
    ghost: {
      background: "transparent",
      color: "var(--nawab-gold)",
      border: "1px solid color-mix(in srgb, var(--nawab-gold) 40%, transparent)",
    },
  };

  return (
    <motion.button
      {...rest}
      whileHover={active ? { scale: 1.02 } : {}}
      whileTap={active ? { scale: 0.97 } : {}}
      transition={silkTransition}
      style={{
        width: full ? "100%" : undefined,
        padding: "0.65rem 1rem",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "0.9rem",
        fontWeight: 500,
        borderRadius: 6,
        cursor: active ? "pointer" : "not-allowed",
        transition: "background 0.2s",
        ...palette[variant],
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}
