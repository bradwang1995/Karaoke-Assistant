import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackDecision } from "../types/youtube";
import { privacyConsent } from "../lib/privacyConsent";

const CHECK_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 1_200;

async function fetchPlaybackDecision(videoId: string, signal: AbortSignal): Promise<PlaybackDecision | null> {
  if (!privacyConsent.accepted()) throw new Error("Consent required");
  const response = await fetch(`/api/youtube/playback/${encodeURIComponent(videoId)}`, {
    method: "POST", headers: { accept: "application/json" }, signal,
  });
  if (!response.ok && response.status < 500) return null;
  if (!response.ok) throw new Error("Playback check unavailable");
  return await response.json() as PlaybackDecision;
}
export function validDecision(decision: PlaybackDecision | null, videoId: string) {
  return decision?.videoId === videoId && decision.allowed && decision.reason === "allowed" &&
    typeof decision.expiresAt === "string" && Date.parse(decision.expiresAt) > Date.now();
}
export function usePlaybackDecision(videoId: string | null) {
  const [result, setResult] = useState<{ attempt: number; decision: PlaybackDecision } | null>(null);
  const startedDecision = useRef<PlaybackDecision | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const decision = result?.attempt === attempt && result.decision.videoId === videoId ? result.decision : null;

  useEffect(() => {
    setResult(null);
    startedDecision.current = null;
    if (!videoId) return;

    let cancelled = false;
    let controller: AbortController | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const check = async (canRetry: boolean) => {
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), CHECK_TIMEOUT_MS);
      const unknown: PlaybackDecision = { videoId, allowed: false, reason: "unknown" };
      let value: PlaybackDecision | null;
      try {
        value = await fetchPlaybackDecision(videoId, request.signal);
      } catch {
        value = unknown;
      } finally {
        clearTimeout(timeout);
      }
      if (cancelled) return;
      if (value && (value.videoId !== videoId || (value.allowed && !validDecision(value, videoId)))) value = unknown;
      if (canRetry && value?.reason === "unknown" && privacyConsent.accepted()) {
        retryTimer = setTimeout(() => void check(false), RETRY_DELAY_MS);
      } else {
        setResult({ attempt, decision: value ?? unknown });
      }
    };

    void check(true);
    return () => {
      cancelled = true;
      controller?.abort();
      clearTimeout(retryTimer);
    };
  }, [videoId, attempt]);

  useEffect(() => {
    // Expiry controls admission. An already-started iframe can finish the same video.
    if (!decision?.allowed || !decision.expiresAt) return;
    const expiryTimer = setTimeout(() => {
      if (startedDecision.current !== decision) retry();
    }, Math.max(0, Date.parse(decision.expiresAt) - Date.now()));
    return () => clearTimeout(expiryTimer);
  }, [decision, retry]);

  return {
    decision,
    denied: decision?.reason === "made-for-kids" || decision?.reason === "unavailable",
    allowed: decision !== null && (decision === startedDecision.current || validDecision(decision, videoId ?? "")),
    markStarted() {
      if (decision && validDecision(decision, videoId ?? "")) startedDecision.current = decision;
    },
    retry,
  };
}
