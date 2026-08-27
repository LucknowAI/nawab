"use client";
import { useEffect, type RefObject } from "react";

/**
 * Grow a textarea to fit its content, up to `maxHeight`.
 *
 * Assumes the textarea has no vertical padding of its own (all inset lives on a
 * wrapper) — measuring `scrollHeight` against a padded element overshoots by the
 * padding on every keystroke.
 */
export function useAutosize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight = 120,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [ref, value, maxHeight]);
}
