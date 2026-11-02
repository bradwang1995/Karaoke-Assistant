import { useCallback, useEffect, useState } from "react";
import type { PlaybackDecision } from "../types/youtube";
import { privacyConsent } from "../lib/privacyConsent";

export async function fetchPlaybackDecision(videoId: string, signal?: AbortSignal): Promise<PlaybackDecision> {
  if (!privacyConsent.accepted()) throw new Error("Consent required");
  const response = await fetch(`/api/youtube/playback/${encodeURIComponent(videoId)}`, {
    method: "POST", headers: { accept: "application/json" }, signal,
  });
  if (!response.ok) throw new Error("Playback check unavailable");
  return await response.json() as PlaybackDecision;
}
export function validDecision(decision: PlaybackDecision | null, videoId: string) {
  return decision?.videoId === videoId && decision.allowed && decision.reason === "allowed" &&
    typeof decision.expiresAt === "string" && Date.parse(decision.expiresAt) > Date.now();
}
export function usePlaybackDecision(videoId: string | null) {
  const [decision, setDecision] = useState<PlaybackDecision | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    setDecision(null);
    if (!videoId) return;
    let cancelled = false;
    const controller = new AbortController();
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => controller.abort(), 2000);
    fetchPlaybackDecision(videoId, controller.signal).then((value) => {
      if (cancelled || controller.signal.aborted) return;
      setDecision(value);
      if (validDecision(value, videoId)) expiryTimer = setTimeout(() => setDecision({ videoId, allowed: false, reason: "unknown" }), Math.max(0, Date.parse(value.expiresAt!) - Date.now()));
    }).catch(() => { if (!cancelled) setDecision({ videoId, allowed: false, reason: "unknown" }); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); clearTimeout(expiryTimer); };
  }, [videoId, attempt]);
  return { decision, allowed: validDecision(decision, videoId ?? ""), retry };
}
