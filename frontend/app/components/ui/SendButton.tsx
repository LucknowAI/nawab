"use client";
import { motion } from "framer-motion";
import { forwardRef } from "react";
import { silkTransition } from "@/app/lib/motion";

/**
 * The circular send button shared by the landing composer and the chat composer.
 * Both rendered an identical arrow SVG and the same active/inactive background
 * rule; only their click behaviour differs, so that stays with the caller.
 */
export const SendButton = forwardRef<
  HTMLButtonElement,
  {
    active: boolean;
    color: string;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    style?: React.CSSProperties;
  }
>(function SendButton({ active, color, onClick, style }, ref) {
  return (
    <motion.button
      ref={ref}
      className="nawab-landing__send"
      style={{ background: active ? color : "var(--nawab-border)", ...style }}
      onClick={onClick}
      disabled={!active}
      whileHover={active ? { scale: 1.05 } : {}}
      whileTap={active ? { scale: 0.95 } : {}}
      transition={silkTransition}
      aria-label="Send message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </motion.button>
  );
});
