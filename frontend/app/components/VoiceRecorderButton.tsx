"use client";

import React, { useState, useRef, useEffect } from "react";

export type VoiceUiPhase = "ready" | "listening" | "thinking" | "speaking";

interface VoiceRecorderButtonProps {
  color: string;
  disabled?: boolean;
  /** Visual/UX phase — does not change recording mechanics. */
  uiPhase?: VoiceUiPhase;
  onTranscriptionStart: () => void;
  onTranscriptionComplete: (text: string) => void;
  onVoiceStateChange: (state: "idle" | "listening" | "transcribing") => void;
  onInterrupt?: () => void;
}

export default function VoiceRecorderButton({
  color,
  disabled = false,
  uiPhase = "ready",
  onTranscriptionStart,
  onTranscriptionComplete,
  onVoiceStateChange,
  onInterrupt,
}: VoiceRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingIdRef = useRef(0);
  const startedAtRef = useRef(0);
  const heardSpeechRef = useRef(false);

  const teardownVadAndStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsRecording(false);
    onVoiceStateChange("transcribing");
  };

  const startRecording = async () => {
    if (onInterrupt) {
      onInterrupt();
    }

    recordingIdRef.current += 1;
    const thisRecordingId = recordingIdRef.current;
    const previous = mediaRecorderRef.current;
    if (previous) {
      previous.ondataavailable = null;
      previous.onstop = null;
      if (previous.state !== "inactive") {
        try {
          previous.stop();
        } catch {
          // already stopped
        }
      }
      mediaRecorderRef.current = null;
    }
    teardownVadAndStream();
    audioChunksRef.current = [];
    heardSpeechRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (thisRecordingId !== recordingIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (thisRecordingId !== recordingIdRef.current) return;
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        teardownVadAndStream();
        if (thisRecordingId !== recordingIdRef.current) return;

        const elapsedMs = Date.now() - startedAtRef.current;
        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size === 0 || elapsedMs < 400 || !heardSpeechRef.current) {
          onTranscriptionComplete("");
          onVoiceStateChange("idle");
          return;
        }

        onTranscriptionStart();
        const formData = new FormData();
        const extension = mimeType.includes("webm") ? "webm" : "mp4";
        formData.append("file", audioBlob, `recording.${extension}`);

        try {
          const response = await fetch("/api/v1/voice/transcribe", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
          }

          const data = await response.json();
          // Monorepo ok() envelope: { success, status_code, message: { text, ... } }
          const payload =
            data && typeof data === "object" && "success" in data && "message" in data
              ? (data as { message: { text?: string } }).message
              : data;
          const raw = ((payload && (payload as { text?: string }).text) || "").trim();
          const lower = raw.toLowerCase();
          const isHallucination =
            !raw ||
            raw.length < 2 ||
            lower === "thanks for watching" ||
            lower === "thank you for watching" ||
            lower.startsWith("thanks for watching") ||
            lower.startsWith("thank you for watching");
          const text = isHallucination ? "" : raw;
          onTranscriptionComplete(text);
          if (!text.trim()) {
            onVoiceStateChange("idle");
          }
        } catch (err) {
          console.error("Transcription error:", err);
          onTranscriptionComplete("");
          onVoiceStateChange("idle");
        }
      };

      mediaRecorder.start();
      startedAtRef.current = Date.now();
      setIsRecording(true);
      onVoiceStateChange("listening");

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();
      const threshold = 15;

      const checkAudio = () => {
        if (thisRecordingId !== recordingIdRef.current) return;
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        if (average > threshold) {
          heardSpeechRef.current = true;
          silenceStart = Date.now();
        } else if (heardSpeechRef.current && Date.now() - silenceStart > 2500) {
          stopRecording();
          return;
        }
        animationFrameRef.current = requestAnimationFrame(checkAudio);
      };

      animationFrameRef.current = requestAnimationFrame(checkAudio);
    } catch (err) {
      console.error("Failed to access microphone:", err);
      alert("Microphone permission denied or not found.");
      onVoiceStateChange("idle");
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      recordingIdRef.current += 1;
      const rec = mediaRecorderRef.current;
      if (rec) {
        rec.ondataavailable = null;
        rec.onstop = null;
        if (rec.state !== "inactive") {
          try {
            rec.stop();
          } catch {
            // ignore
          }
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const phase: VoiceUiPhase = isRecording ? "listening" : uiPhase;
  const isThinking = phase === "thinking";
  const isSpeakingPhase = phase === "speaking";
  const buttonDisabled = (disabled || isThinking) && !isRecording;

  return (
    <button
      type="button"
      className={`nawab-voice-btn${isThinking ? " is-thinking" : ""}${isSpeakingPhase ? " is-speaking" : ""}`}
      style={{
        background: isRecording
          ? "#ea4335"
          : isSpeakingPhase
          ? `${color}14`
          : "transparent",
        color: isRecording
          ? "#ffffff"
          : isSpeakingPhase
          ? color
          : isThinking
          ? "var(--nawab-ink-40)"
          : "var(--nawab-ink-60)",
        borderColor: isRecording
          ? "#ea4335"
          : isSpeakingPhase
          ? color
          : "var(--nawab-border)",
        boxShadow: isRecording
          ? "0 0 12px rgba(234,67,53,0.5)"
          : isSpeakingPhase
          ? `0 0 10px ${color}33`
          : "none",
        opacity: isThinking ? 0.65 : 1,
        cursor: buttonDisabled ? "not-allowed" : "pointer",
      }}
      onClick={toggleRecording}
      disabled={buttonDisabled}
      title={
        isRecording
          ? "Stop listening"
          : isThinking
          ? "Nawab is thinking…"
          : isSpeakingPhase
          ? "Tap to interrupt"
          : "Ask by speaking"
      }
      aria-busy={isThinking}
    >
      {isRecording ? (
        <span className="nawab-voice-recording-dot" />
      ) : isThinking ? (
        <span className="nawab-voice-thinking-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}
