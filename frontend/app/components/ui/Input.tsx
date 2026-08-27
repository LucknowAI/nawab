"use client";
import { forwardRef } from "react";

/**
 * Single-line text input. Same token-driven rationale as Button — the login
 * page previously inlined its own style object with hardcoded colours.
 */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ style, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        style={{
          width: "100%",
          padding: "0.65rem 0.85rem",
          fontFamily: "var(--font-sans, 'Google Sans', sans-serif)",
          fontSize: "0.9rem",
          color: "var(--nawab-ink)",
          background: "rgba(255,255,255,0.7)",
          border: "1px solid var(--nawab-border)",
          borderRadius: 8,
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          ...style,
        }}
      />
    );
  },
);
