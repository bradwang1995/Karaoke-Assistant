const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

export const YOUTUBE_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YouTubePlayerState =
  (typeof YOUTUBE_PLAYER_STATE)[keyof typeof YOUTUBE_PLAYER_STATE];

export interface YouTubePlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
  loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
  getAvailableQualityLevels?: () => string[];
  getPlaybackQuality?: () => string;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  destroy?: () => void;
  getIframe?: () => HTMLIFrameElement;
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

export interface YouTubePlayerStateChangeEvent extends YouTubePlayerEvent {
  data: YouTubePlayerState;
}

export interface YouTubePlayerErrorEvent extends YouTubePlayerEvent {
  data: number;
}

export interface YouTubePlayerQualityChangeEvent extends YouTubePlayerEvent {
  data: string;
}

export interface YouTubePlayerOptions {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
    onError?: (event: YouTubePlayerErrorEvent) => void;
    onPlaybackQualityChange?: (event: YouTubePlayerQualityChangeEvent) => void;
    onAutoplayBlocked?: (event: YouTubePlayerEvent) => void;
  };
}

export interface YouTubeIframeApi {
  Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayer;
  PlayerState: typeof YOUTUBE_PLAYER_STATE;
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeIframeApi> | null = null;

export function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API is only available in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  apiPromise ??= new Promise<YouTubeIframeApi>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();

      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube IFrame API loaded without YT.Player."));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_IFRAME_API_SRC}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        reject(new Error("Failed to load YouTube IFrame API."));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = YOUTUBE_IFRAME_API_SRC;
    script.async = true;
    script.addEventListener("error", () => {
      reject(new Error("Failed to load YouTube IFrame API."));
    });
    document.head.appendChild(script);
  });

  return apiPromise;
}
