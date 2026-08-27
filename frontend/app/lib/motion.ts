import type { Variants, Transition } from "framer-motion";

// ── Reusable ease arrays ─────────────────────────────────────────────────────
// Reusable ease arrays — reference these instead of inlining
const SILK_EASE = [0.22, 1, 0.36, 1] as const;
const SILK_EXPO_EASE = [0.16, 1, 0.3, 1] as const;

// ── Shared transition (Silk & Flow) ──────────────────────────────────────────
// ease-out-quint: confident deceleration, never bounces
export const silkTransition: Transition = {
  duration: 0.35,
  ease: SILK_EASE,
};

// Faster exit (75% of entrance)
export const silkExitTransition: Transition = {
  duration: 0.26,
  ease: SILK_EASE,
};

// ── Variants ─────────────────────────────────────────────────────────────────

/** Fade in + slide up 16px. Primary entrance for messages, cards, panels. */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: silkTransition,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: silkExitTransition,
  },
};

/** Fade in + slide in from the right 20px. For user messages. */
export const fadeSlideFromRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: silkTransition,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: silkExitTransition,
  },
};

/** Scale from 0.96 + fade. For login card, modal-like entrances. */
export const scaleEntrance: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: SILK_EASE },
  },
};

/** Slide in from left (x: -100%). For sidebar. */
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: "-100%" },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: SILK_EXPO_EASE },
  },
  exit: {
    opacity: 0,
    x: "-100%",
    transition: { duration: 0.24, ease: SILK_EASE },
  },
};

/** Parent that staggers children 80ms apart. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

/**
 * Child variant — pair with staggerContainer.
 * Identical motion to fadeSlideUp; separate export so parent/child
 * variant names stay independent.
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: silkTransition,
  },
};

/**
 * Landing box exit — silks away upward before chat enters.
 * NOTE: No `visible` key — this element starts fully visible.
 * Consumers must use initial={false} or animate="hidden" (not animate="visible").
 */
export const landingExit: Variants = {
  hidden: { opacity: 1, scale: 1, y: 0 },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -12,
    transition: { duration: 0.28, ease: SILK_EASE },
  },
};

/** Slide down from above — for status pills, toasts. */
export const slideDownIn: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: silkTransition,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: silkExitTransition,
  },
};
