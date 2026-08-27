"use client";
import { useEffect, useRef } from "react";
import { RemoteImg } from "./RemoteImg";

/**
 * Full-size view of one image, built on the native <dialog>.
 *
 * `showModal()` is what gives us the backdrop, the focus trap, the inert page
 * behind it, and Esc-to-close — none of which is worth hand-rolling. The
 * element is mounted only while open, so the effect fires once per opening and
 * the browser's own `close` event is the single path back to the caller.
 */
export function Lightbox({
  src,
  fallbackSrc,
  alt = "",
  caption,
  link,
  onClose,
}: {
  src?: string;
  /** Tried if `src` fails — pass the origin URL when `src` is a thumbnail. */
  fallbackSrc?: string;
  alt?: string;
  caption?: string;
  /** Source page for the image, opened in a new tab. */
  link?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="nawab-lightbox"
      onClose={onClose}
      // Click-outside: a modal dialog's backdrop is painted by the dialog box
      // itself, so a click that lands on the element and not on its content is
      // a click on the backdrop.
      onClick={e => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="nawab-lightbox__inner">
        <button
          type="button"
          className="nawab-lightbox__close"
          aria-label="Close image"
          onClick={() => ref.current?.close()}
        >
          ✕
        </button>

        <RemoteImg
          src={src}
          fallbackSrc={fallbackSrc}
          alt={alt}
          className="nawab-lightbox__img"
          fallback={<p className="nawab-lightbox__missing">🖼️ This image could not be loaded.</p>}
        />

        {(caption || link) && (
          <div className="nawab-lightbox__bar">
            {caption && <p className="nawab-lightbox__caption">{caption}</p>}
            {link && (
              <a
                className="nawab-lightbox__source"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source ↗
              </a>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
