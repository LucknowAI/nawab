// Lucknow architectural motif — Rumi Darwaza inspired banner image
import type { CSSProperties } from "react";
import Image from "next/image";

export default function LucknowMotif({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ width: "100%", lineHeight: 0, ...style }}
      aria-hidden="true"
    >
      <Image
        src="/lucknow-motif.svg"
        alt=""
        width={4544}
        height={928}
        style={{ width: "100%", height: "auto", display: "block" }}
        priority
        unoptimized
      />
    </div>
  );
}
