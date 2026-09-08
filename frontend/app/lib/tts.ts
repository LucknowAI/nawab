/**
 * Frontend TTS client.
 *
 * Playback talks to this interface only so the backend provider can be swapped
 * without changing the voice UI. No browser speechSynthesis fallback.
 */

export interface TTSClient {
  synthesize(text: string, signal?: AbortSignal): Promise<Blob>;
}

/** Safari is picky about MIME; normalize synthesize blobs to audio/wav. */
export function asWavBlob(blob: Blob): Blob {
  const type = (blob.type || "").toLowerCase();
  if (type === "audio/wav" || type === "audio/wave" || type === "audio/x-wav") {
    return blob;
  }
  return new Blob([blob], { type: "audio/wav" });
}

function errorDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as {
    detail?: unknown;
    error?: string;
    message?: unknown;
    success?: boolean;
  };
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.error === "string") return body.error;
  // Monorepo fail() envelope: { success: false, message: "..." }
  if (typeof body.message === "string") return body.message;
  return fallback;
}

export function createTTSClient(
  endpoint = "/api/v1/voice/synthesize",
): TTSClient {
  return {
    async synthesize(text: string, signal?: AbortSignal): Promise<Blob> {
      const started = performance.now();
      console.info("[tts] synthesize start chars=%s", text.length);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
        credentials: "include",
      });
      if (!response.ok) {
        let detail = `TTS request failed (${response.status})`;
        try {
          detail = errorDetail(await response.json(), detail);
        } catch {
          // non-JSON error body
        }
        console.error("[tts] synthesize error: %s", detail);
        throw new Error(detail);
      }
      const blob = asWavBlob(await response.blob());
      console.info(
        "[tts] synthesize done chars=%s bytes=%s latency_ms=%s",
        text.length,
        blob.size,
        Math.round(performance.now() - started),
      );
      return blob;
    },
  };
}

export const ttsClient: TTSClient = createTTSClient();
