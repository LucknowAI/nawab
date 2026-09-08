import { describe, it, expect } from "vitest";
import { asWavBlob } from "@/app/lib/tts";

describe("tts helpers", () => {
  it("asWavBlob preserves wav MIME", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
    expect(asWavBlob(blob).type).toBe("audio/wav");
  });

  it("asWavBlob normalizes non-wav MIME to audio/wav", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" });
    expect(asWavBlob(blob).type).toBe("audio/wav");
  });
});
