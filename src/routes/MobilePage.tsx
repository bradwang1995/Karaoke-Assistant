import {
  ArrowUpToLine,
  Check,
  ListMusic,
  LoaderCircle,
  Music2,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusMessage } from "../components/StatusMessage";
import { useRoomSocket, type SocketStatus } from "../hooks/useRoomSocket";
import {
  ApiClientError,
  SearchRequestTimeoutError,
  searchVideosViaApi,
} from "../lib/apiClient";
import { searchMockVideos } from "../lib/mockSearch";
import { formatRelativeQuotaReset } from "../lib/quotaReset";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import { visibleRoomDisplayName } from "../lib/roomName";
import {
  addSongToRoom,
  playerEnded,
  promoteSong,
  removeSong,
  restartCurrentSong,
  useRoomSnapshot,
} from "../lib/roomState";
import {
  enforceYouTubePreviewStart,
  hasYouTubePreviewReachedStart,
  startYouTubePreview,
  youtubeThumbnailUrl,
  youtubePreviewPlayerVars,
} from "../lib/youtube";
import {
  loadYouTubeIframeApi,
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayer,
  type YouTubePlayerErrorEvent,
  type YouTubePlayerEvent,
  type YouTubePlayerStateChangeEvent,
} from "../lib/youtubeIframeApi";
import { useMobileUiStore } from "../stores/mobileUiStore";
import type { QueueItem } from "../types/room";
import type { ClientToServerMessage } from "../types/websocket";
import type { SearchResponse, SearchType, VideoSearchResult } from "../types/youtube";

const SEARCH_RESULT_PAGE_SIZE = 10;
const SEARCH_FETCH_LIMIT = 50;
const RECOMMENDATION_FETCH_LIMIT = 200;
const PREVIEW_LOAD_TIMEOUT_MS = 10_000;
const SEARCH_STATE_TTL_MS = 1000 * 60 * 60 * 24;
type MobileTab = "search" | "queue";

export default function MobilePage() {
  const { roomId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomSocket = useRoomSocket({ roomId, role: "mobile" });
  const snapshot = useRoomSnapshot(roomId);
  const currentItem = getCurrentItem(snapshot);
  const queuedItems = getQueuedItems(snapshot);
  const roomDisplayName = visibleRoomDisplayName(snapshot.room.displayName, roomId);
  const queueTargetRef = useRef<HTMLDivElement | null>(null);
  const storedActiveTab = useMobileUiStore((state) => state.activeTab);
  const setStoredActiveTab = useMobileUiStore((state) => state.setActiveTab);
  const activeTab = parseMobileTab(searchParams.get("tab"));
  const existingItems = useMemo(
    () => (currentItem ? [currentItem, ...queuedItems] : queuedItems),
    [currentItem, queuedItems],
  );

  useEffect(() => {
    if (storedActiveTab !== activeTab) {
      setStoredActiveTab(activeTab);
    }
  }, [activeTab, setStoredActiveTab, storedActiveTab]);

  const setActiveTab = (tab: MobileTab) => {
    setStoredActiveTab(tab);
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (tab === "queue") {
          nextParams.set("tab", "queue");
        } else {
          nextParams.delete("tab");
        }

        return nextParams;
      },
      { replace: true },
    );
  };

  return (
    <main className="app-no-select h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden border-x border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <header className="mobile-safe-header relative z-[60] shrink-0 overflow-hidden border-b border-white/10 bg-slate-950 px-4 pb-3 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(20,184,166,0.2),transparent_42%),radial-gradient(circle_at_88%_80%,rgba(251,113,133,0.13),transparent_38%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-normal">K歌助手</h1>
              <p className="mt-0.5 text-sm text-slate-300">{roomDisplayName}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                ref={queueTargetRef}
                className="rounded-xl border border-teal-200/20 bg-teal-300/10 px-3 py-2 text-right"
              >
                <p className="text-xs text-teal-200">即将播放</p>
                <p className="text-base font-semibold text-white">{queuedItems.length} 首</p>
              </div>
              <ConnectionBadge
                status={roomSocket.status}
                canUseLocalFallback={roomSocket.canUseLocalFallback}
              />
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-2 rounded-xl bg-white/10 p-1">
            <TabButton
              active={activeTab === "search"}
              icon={<Music2 size={17} />}
              label="点歌"
              onClick={() => setActiveTab("search")}
            />
            <TabButton
              active={activeTab === "queue"}
              icon={<ListMusic size={17} />}
              label="歌单"
              onClick={() => setActiveTab("queue")}
            />
          </div>
        </header>

        {activeTab === "search" ? (
          <SearchTab
            roomId={roomId}
            existingItems={existingItems}
            isSocketConnected={roomSocket.status === "connected"}
            canUseLocalFallback={roomSocket.canUseLocalFallback}
            sendRoomMessage={roomSocket.send}
            queueTargetRef={queueTargetRef}
          />
        ) : (
          <QueueTab
            roomId={roomId}
            currentItem={currentItem}
            queuedItems={queuedItems}
            isSocketConnected={roomSocket.status === "connected"}
            canUseLocalFallback={roomSocket.canUseLocalFallback}
            sendRoomMessage={roomSocket.send}
          />
        )}
      </div>
    </main>
  );
}

function parseMobileTab(value: string | null): MobileTab {
  return value === "queue" ? "queue" : "search";
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition ${
        active
          ? "bg-teal-300 text-slate-950 shadow-lg shadow-black/20"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SearchTab({
  roomId,
  existingItems,
  isSocketConnected,
  canUseLocalFallback,
  sendRoomMessage,
  queueTargetRef,
}: {
  roomId: string;
  existingItems: QueueItem[];
  isSocketConnected: boolean;
  canUseLocalFallback: boolean;
  sendRoomMessage: (message: ClientToServerMessage) => boolean;
  queueTargetRef: RefObject<HTMLElement>;
}) {
  const [initialSearchState] = useState(() => readPersistedSearchState(roomId));
  const [query, setQuery] = useState(initialSearchState?.query ?? "");
  const [searchType, setSearchType] = useState<SearchType>(
    initialSearchState?.searchType ?? "song",
  );
  const [includeOriginalVocal, setIncludeOriginalVocal] = useState(
    initialSearchState?.includeOriginalVocal ?? false,
  );
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(
    initialSearchState?.response ?? null,
  );
  const [visibleResultCount, setVisibleResultCount] = useState(
    clampVisibleResultCount(initialSearchState?.visibleResultCount),
  );
  const [selected, setSelected] = useState<VideoSearchResult | null>(() =>
    findPersistedResult(initialSearchState?.response, initialSearchState?.selectedVideoId),
  );
  const [toast, setToast] = useState<MobileToastState | null>(null);
  const [addTrail, setAddTrail] = useState<AddToQueueTrailState | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<VideoSearchResult | null>(null);
  const [activePreviewVideoId, setActivePreviewVideoId] = useState(
    findPersistedResult(initialSearchState?.response, initialSearchState?.activePreviewVideoId)
      ?.videoId ?? null,
  );
  const [pendingPreviewVideoId, setPendingPreviewVideoId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [scrollY, setScrollY] = useState(initialSearchState?.scrollY ?? 0);
  const resultCardRefs = useRef(new Map<string, HTMLElement>());
  const resultsGridRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const addTrailTimeoutRef = useRef<number | null>(null);
  const previewDebounceTimeoutRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);
  const latestSearchRequestRef = useRef(0);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2_300);

    toastTimeoutRef.current = timeoutId;

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      if (addTrailTimeoutRef.current !== null) {
        window.clearTimeout(addTrailTimeoutRef.current);
      }

      if (previewDebounceTimeoutRef.current !== null) {
        window.clearTimeout(previewDebounceTimeoutRef.current);
      }
    },
    [],
  );

  const recommendationsQuery = useQuery({
    queryKey: ["search-recommendations", roomId],
    queryFn: async () => {
      try {
        return await searchVideosViaApi(roomId, "", RECOMMENDATION_FETCH_LIMIT, {
          cacheFill: false,
        });
      } catch (error) {
        if (canUseLocalFallback) {
          return searchMockVideos("经典 KTV", RECOMMENDATION_FETCH_LIMIT);
        }

        throw error;
      }
    },
    enabled: roomId.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const searchMutation = useMutation({
    mutationFn: async ({
      query: nextQuery,
      searchType: nextSearchType,
      includeOriginalVocal: nextIncludeOriginalVocal,
      requestId,
    }: {
      query: string;
      searchType: SearchType;
      includeOriginalVocal: boolean;
      requestId: number;
    }) => {
      try {
        return await searchVideosViaApi(roomId, nextQuery.trim(), SEARCH_FETCH_LIMIT, {
          searchType: nextSearchType,
          includeOriginalVocal: nextIncludeOriginalVocal,
        });
      } catch (error) {
        if (canUseLocalFallback) {
          return searchMockVideos(nextQuery, SEARCH_FETCH_LIMIT, {
            searchType: nextSearchType,
            includeOriginalVocal: nextIncludeOriginalVocal,
          });
        }

        throw error;
      }
    },
    onSuccess: (response, request) => {
      if (request.requestId !== latestSearchRequestRef.current) {
        return;
      }

      const partialWithoutResults =
        response.results.length === 0 &&
        (response.cacheMeta?.timedOut ||
          response.cacheMeta?.providerRateLimited ||
          response.cacheMeta?.throttled ||
          response.cacheMeta?.quota?.exhausted);

      if (partialWithoutResults && searchResponse?.results.length) {
        setToast({
          id: Date.now(),
          tone: "warning",
          message: searchPartialMessage(response),
        });
        return;
      }

      setSearchResponse(response);
      setVisibleResultCount(SEARCH_RESULT_PAGE_SIZE);
      setActivePreviewVideoId(null);
      setPendingPreviewVideoId(null);
      setSelected(response.results[0] ?? null);

      if (
        response.cacheMeta?.timedOut ||
        response.cacheMeta?.providerRateLimited ||
        response.cacheMeta?.throttled ||
        response.cacheMeta?.quota?.exhausted
      ) {
        setToast({
          id: Date.now(),
          tone: "warning",
          message: searchPartialMessage(response),
        });
      }
    },
  });

  const isSearching = searchMutation.isPending;
  const showingRecommendations = !searchResponse && !searchMutation.isError;
  const activeResults = useMemo(
    () =>
      searchResponse?.results ??
      (showingRecommendations ? recommendationsQuery.data?.results : []) ??
      [],
    [
      recommendationsQuery.data?.results,
      searchResponse?.results,
      showingRecommendations,
    ],
  );
  const visibleResults = useMemo(
    () =>
      activeResults.slice(0, Math.min(visibleResultCount, activeResults.length)),
    [activeResults, visibleResultCount],
  );
  const canLoadMore =
    visibleResults.length < activeResults.length;
  const resultSignature = useMemo(
    () => activeResults.map((result) => result.videoId).join(","),
    [activeResults],
  );

  useEffect(() => {
    setSelected((current) => {
      if (current && activeResults.some((result) => result.videoId === current.videoId)) {
        return current;
      }

      return activeResults[0] ?? null;
    });
    setActivePreviewVideoId((current) =>
      current && activeResults.some((result) => result.videoId === current) ? current : null,
    );
    setPendingPreviewVideoId((current) =>
      current && activeResults.some((result) => result.videoId === current) ? current : null,
    );
  }, [activeResults, resultSignature]);

  const loadMoreResults = useCallback(() => {
    if (!canLoadMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisibleResultCount((current) =>
        Math.min(current + SEARCH_RESULT_PAGE_SIZE, activeResults.length),
      );
      setIsLoadingMore(false);
    }, 120);
  }, [activeResults.length, canLoadMore, isLoadingMore]);

  useEffect(() => {
    if (!canLoadMore || isLoadingMore) {
      return;
    }

    const node = loadMoreRef.current;

    if (!node || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreResults();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "240px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [canLoadMore, isLoadingMore, loadMoreResults]);

  useEffect(() => {
    if (
      !initialSearchState?.scrollY ||
      restoredScrollRef.current ||
      activeResults.length === 0
    ) {
      return;
    }

    restoredScrollRef.current = true;
    window.requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: initialSearchState.scrollY });
    });
  }, [activeResults.length, initialSearchState]);

  useEffect(() => {
    let frameId: number | null = null;

    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setScrollY(scrollContainer.scrollTop);
      });
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!activePreviewVideoId && !pendingPreviewVideoId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && resultsGridRef.current?.contains(target)) {
        return;
      }

      setActivePreviewVideoId(null);
      setPendingPreviewVideoId(null);
      if (previewDebounceTimeoutRef.current !== null) {
        window.clearTimeout(previewDebounceTimeoutRef.current);
        previewDebounceTimeoutRef.current = null;
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activePreviewVideoId, pendingPreviewVideoId]);

  useEffect(() => {
    writePersistedSearchState(roomId, {
      query,
      searchType,
      includeOriginalVocal,
      response: searchResponse,
      visibleResultCount,
      selectedVideoId: selected?.videoId ?? null,
      activePreviewVideoId,
      scrollY,
    });
  }, [
    activePreviewVideoId,
    includeOriginalVocal,
    query,
    roomId,
    scrollY,
    searchResponse,
    searchType,
    selected?.videoId,
    visibleResultCount,
  ]);

  const showToast = (nextToast: Omit<MobileToastState, "id">) => {
    setToast({ ...nextToast, id: Date.now() });
  };

  const cancelPendingPreview = () => {
    if (previewDebounceTimeoutRef.current !== null) {
      window.clearTimeout(previewDebounceTimeoutRef.current);
      previewDebounceTimeoutRef.current = null;
    }

    setPendingPreviewVideoId(null);
  };

  const schedulePreview = (result: VideoSearchResult) => {
    setSelected(result);
    cancelPendingPreview();
    setActivePreviewVideoId(result.videoId);
  };

  const registerCardRef = (videoId: string, node: HTMLElement | null) => {
    if (node) {
      resultCardRefs.current.set(videoId, node);
      return;
    }

    resultCardRefs.current.delete(videoId);
  };

  const startAddTrail = (videoId: string) => {
    const source = resultCardRefs.current.get(videoId);
    const target = queueTargetRef.current;

    if (!source || !target) {
      return;
    }

    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const from = {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    };
    const to = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };

    if (addTrailTimeoutRef.current !== null) {
      window.clearTimeout(addTrailTimeoutRef.current);
    }

    setAddTrail({ id: Date.now(), from, to });
    addTrailTimeoutRef.current = window.setTimeout(() => {
      setAddTrail(null);
      addTrailTimeoutRef.current = null;
    }, 900);
  };

  const runSearch = (
    nextQuery: string,
    nextSearchType: SearchType,
    nextIncludeOriginalVocal: boolean,
  ) => {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      return;
    }

    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;
    setToast(null);
    setDuplicateCandidate(null);
    setIsLoadingMore(false);
    searchMutation.mutate({
      query: trimmedQuery,
      searchType: nextSearchType,
      includeOriginalVocal: nextIncludeOriginalVocal,
      requestId,
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();

    if (searchMutation.isPending) {
      return;
    }

    runSearch(query, searchType, includeOriginalVocal);
  };

  const addSelectedSong = () => {
    if (!selected) return;

    const duplicate = existingItems.find((item) => item.videoId === selected.videoId);

    if (duplicate) {
      setDuplicateCandidate(selected);
      return;
    }

    submitSelectedSong(selected);
  };

  const submitSelectedSong = (result: VideoSearchResult) => {
    const payload = {
      videoId: result.videoId,
      title: result.title,
      channelTitle: result.channelTitle,
      thumbnailUrl: result.thumbnailUrl,
    };

    if (isSocketConnected) {
      const sent = sendRoomMessage({
        type: "ADD_QUEUE_ITEM",
        payload,
      });

      if (!sent) {
        showToast({ tone: "warning", message: "房间连接正在恢复，请稍后再试。" });
        return;
      }
    } else if (canUseLocalFallback) {
      addSongToRoom(roomId, payload);
    } else {
      showToast({ tone: "warning", message: "房间连接正在恢复，请稍后再点歌。" });
      return;
    }

    showToast({ tone: "success", message: `已点歌成功：${result.title}` });
    startAddTrail(result.videoId);
    setDuplicateCandidate(null);
  };

  const isLoadingRecommendations =
    showingRecommendations && recommendationsQuery.isPending;
  const resultHeading = isSearching
    ? "正在搜索"
    : showingRecommendations
      ? "缓存推荐"
      : "搜索结果";
  const resultCountLabel = isSearching
    ? "搜索中"
    : isLoadingRecommendations
      ? "加载中"
    : `${visibleResults.length}/${activeResults.length} 首`;

  return (
    <section className="relative isolate z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950">
      <MobileToast toast={toast} />
      <AddToQueueTrail trail={addTrail} />

      <div className="z-50 isolate shrink-0 overflow-hidden border-b border-white/10 bg-slate-900 px-4 pb-2.5 pt-3 shadow-lg shadow-slate-950/15">
        <form onSubmit={submitSearch}>
          <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5rem_3.25rem] gap-1.5 sm:grid-cols-[5.25rem_minmax(0,1fr)_5.25rem_3.5rem] sm:gap-2">
            <label className="sr-only" htmlFor="search-type">
              搜索类型
            </label>
            <select
              id="search-type"
              value={searchType}
              onChange={(event) => setSearchType(event.target.value as SearchType)}
              className="h-12 rounded-lg border border-white/15 bg-slate-800 px-2 text-base font-semibold text-white outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-300/15"
            >
              <option value="song">歌名</option>
              <option value="artist">歌手</option>
            </select>
            <label className="sr-only" htmlFor="song-search">
              搜索歌曲
            </label>
            <input
              id="song-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchType === "artist" ? "歌手名" : "歌名"}
              enterKeyHint="search"
              className="h-12 min-w-0 rounded-lg border border-white/15 bg-slate-800 px-3 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:ring-4 focus:ring-teal-300/15"
            />
            <PillToggle
              label="原唱"
              checked={includeOriginalVocal}
              onChange={setIncludeOriginalVocal}
            />
            <button
              type="submit"
              aria-label="搜索"
              title="搜索"
              disabled={!query.trim() || searchMutation.isPending}
              className="inline-flex h-12 w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-teal-300 text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 sm:w-14"
            >
              {isSearching ? (
                <>
                  <LoaderCircle className="animate-spin" size={21} />
                  <span className="sr-only">正在搜索</span>
                </>
              ) : (
                <Search size={21} />
              )}
            </button>
          </div>
        </form>
        <div className="mt-2 flex h-6 items-center justify-between gap-3">
          <h2 className="text-base font-semibold leading-6 text-slate-100">{resultHeading}</h2>
          <span className="shrink-0 rounded-md bg-white/10 px-2 text-sm leading-6 text-slate-300">
            {resultCountLabel}
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        aria-busy={isSearching}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_18%_8%,rgba(20,184,166,0.10),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(251,113,133,0.08),transparent_32%)] px-4 pb-3 scrollbar-soft-dark"
      >
        {searchMutation.isError ? (
          <StatusMessage
            tone={searchMutation.error instanceof SearchRequestTimeoutError ? "warning" : "error"}
            title={
              searchMutation.error instanceof SearchRequestTimeoutError
                ? "已停止搜索"
                : "搜索失败"
            }
            appearance="dark"
            className="mt-4"
          >
            {searchErrorMessage(searchMutation.error)}
          </StatusMessage>
        ) : null}

        {recommendationsQuery.isError && showingRecommendations ? (
          <StatusMessage tone="warning" title="推荐加载失败" appearance="dark" className="mt-4">
            {searchErrorMessage(recommendationsQuery.error)}
          </StatusMessage>
        ) : null}

        {isSearching && activeResults.length === 0 ? (
          <div
            className="grid min-h-64 place-items-center py-12 text-center"
            role="status"
            aria-live="polite"
          >
            <div>
              <LoaderCircle className="mx-auto animate-spin text-teal-300" size={36} />
              <p className="mt-4 text-base font-semibold text-slate-100">正在搜索歌曲…</p>
              <p className="mt-1 text-sm text-slate-400">最多等待 2 秒，到时立即返回</p>
            </div>
          </div>
        ) : null}

        {isSearching && activeResults.length > 0 ? (
          <StatusMessage tone="loading" appearance="dark" className="mt-4">
            正在搜索，最多等待 2 秒；当前结果继续可用。
          </StatusMessage>
        ) : null}

        {isLoadingRecommendations ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: SEARCH_RESULT_PAGE_SIZE }, (_, item) => (
              <div key={item} className="aspect-[16/11] animate-pulse rounded-xl bg-slate-800" />
            ))}
          </div>
        ) : null}

        {!isSearching &&
        !isLoadingRecommendations &&
        searchResponse?.cacheMeta?.quota?.exhausted &&
        activeResults.length === 0 ? (
          <StatusMessage tone="warning" title="今日搜索额度已用完" appearance="dark" className="mt-5">
            {quotaResetMessage(searchResponse.cacheMeta.quota.resetAt)}；已缓存的相同搜索仍可使用。
          </StatusMessage>
        ) : null}

        {!isSearching &&
        !isLoadingRecommendations &&
        searchResponse &&
        !searchResponse.cacheMeta?.quota?.exhausted &&
        activeResults.length === 0 ? (
          <StatusMessage tone="info" appearance="dark" className="mt-5">
            没有找到合适的视频。
          </StatusMessage>
        ) : null}

        {!isSearching && !isLoadingRecommendations && showingRecommendations && activeResults.length === 0 ? (
          <StatusMessage tone="info" appearance="dark" className="mt-5">
            暂无推荐内容。
          </StatusMessage>
        ) : null}

        {!isLoadingRecommendations && activeResults.length > 0 ? (
          <>
          <div
            ref={resultsGridRef}
            className="relative z-0 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visibleResults.map((result, index) => (
              <CandidateVideoCard
                key={`${result.videoId}-${index}`}
                cardRef={(node) => registerCardRef(result.videoId, node)}
                result={result}
                selected={selected?.videoId === result.videoId}
                previewActive={activePreviewVideoId === result.videoId}
                previewPending={pendingPreviewVideoId === result.videoId}
                duplicate={existingItems.some((item) => item.videoId === result.videoId)}
                onSelect={() => schedulePreview(result)}
              />
            ))}
          </div>
          <div ref={loadMoreRef} className="mt-4 min-h-12">
            {isLoadingMore ? (
              <StatusMessage tone="loading" appearance="dark">正在加载更多缓存结果</StatusMessage>
            ) : canLoadMore ? (
              <button
                type="button"
                onClick={loadMoreResults}
                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-4 py-3 text-base font-semibold text-slate-100 transition hover:bg-white/10"
              >
                加载更多
              </button>
            ) : (
              <p className="py-3 text-center text-sm text-slate-400">已经显示全部缓存结果</p>
            )}
          </div>
          </>
        ) : null}
      </div>

      <footer className="mobile-safe-footer z-20 shrink-0 border-t border-white/10 bg-slate-950 px-4 pt-3 shadow-[0_-12px_30px_rgba(2,6,23,0.5)]">
        <button
          type="button"
          onClick={addSelectedSong}
          disabled={!selected}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-lg font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Check size={21} />
          点歌
        </button>
        <p className="mt-2 text-center text-xs leading-4 text-slate-400">
          搜索使用 YouTube Data API，视频仅通过 YouTube 嵌入播放器播放。
        </p>
      </footer>

      <ConfirmDialog
        open={duplicateCandidate !== null}
        title="歌单里已经有这首歌"
        body={duplicateCandidate?.title}
        confirmLabel="继续点歌"
        appearance="dark"
        onCancel={() => setDuplicateCandidate(null)}
        onConfirm={() => {
          if (duplicateCandidate) {
            submitSelectedSong(duplicateCandidate);
          }
        }}
      />
    </section>
  );
}

interface MobileToastState {
  id: number;
  tone: "success" | "warning";
  message: string;
}

interface AddToQueueTrailState {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function PillToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border px-2 text-base font-semibold transition focus:outline-none focus:ring-4 focus:ring-teal-300/15 ${
        checked
          ? "border-teal-300 bg-teal-300 text-slate-950"
          : "border-white/15 bg-slate-800 text-slate-300"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={`relative h-5 w-8 rounded-full transition ${
          checked ? "bg-teal-900/30" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function MobileToast({ toast }: { toast: MobileToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div
        key={toast.id}
        className={`rounded-full px-4 py-2 text-center text-sm font-semibold shadow-lg mobile-toast-enter ${
          toast.tone === "success"
            ? "bg-emerald-500 text-emerald-950"
            : "bg-amber-400 text-amber-950"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

function AddToQueueTrail({ trail }: { trail: AddToQueueTrailState | null }) {
  if (!trail) {
    return null;
  }

  const style = {
    left: `${trail.from.x}px`,
    top: `${trail.from.y}px`,
    "--trail-x": `${trail.to.x - trail.from.x}px`,
    "--trail-y": `${trail.to.y - trail.from.y}px`,
  } as CSSProperties;

  return (
    <div
      key={trail.id}
      className="pointer-events-none fixed z-50 grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-400 bg-emerald-300/25 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.65)] add-to-queue-trail"
      style={style}
    >
      <Check size={20} />
    </div>
  );
}

function CandidateVideoCard({
  cardRef,
  result,
  selected,
  previewActive,
  previewPending,
  duplicate,
  onSelect,
}: {
  cardRef: (node: HTMLElement | null) => void;
  result: VideoSearchResult;
  selected: boolean;
  previewActive: boolean;
  previewPending: boolean;
  duplicate: boolean;
  onSelect: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelect();
  };

  return (
    <article
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`选择 ${result.title}`}
      onPointerDownCapture={onSelect}
      onKeyDown={handleKeyDown}
      className={`relative isolate z-0 cursor-pointer overflow-hidden rounded-xl border bg-slate-900 text-left shadow-lg shadow-black/20 transition focus:outline-none focus:ring-4 ${
        selected
          ? "border-teal-300 ring-2 ring-teal-300/35"
          : "border-white/10 hover:border-white/25 focus:border-teal-300 focus:ring-teal-300/25"
      }`}
    >
      <div className="aspect-video overflow-hidden">
        <CandidatePreview
          result={result}
          active={previewActive}
          pending={previewPending}
        />
      </div>
      <div className="min-h-[3.5rem] border-t border-white/10 bg-slate-900/95 px-2.5 py-2">
        <h3 className="line-clamp-2 text-base font-semibold leading-5 text-slate-100">
          {result.title}
        </h3>
      </div>
      {duplicate || selected ? (
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-[1] flex max-w-[calc(100%-0.75rem)] flex-col items-end gap-1">
          {duplicate ? (
            <span className="max-w-full truncate rounded-md bg-amber-100 px-1.5 py-1 text-[11px] font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200">
              已在歌单
            </span>
          ) : null}
          {selected ? (
            <span className="max-w-full truncate rounded-md bg-teal-100 px-1.5 py-1 text-[11px] font-semibold text-teal-800 shadow-sm ring-1 ring-teal-200">
              已选中
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CandidatePreview({
  result,
  active,
  pending,
}: {
  result: VideoSearchResult;
  active: boolean;
  pending: boolean;
}) {
  const playerShellRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playRetryTimeoutsRef = useRef<number[]>([]);
  const playingRef = useRef(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );
  const [verifiedStartTime, setVerifiedStartTime] = useState<number | null>(null);

  useEffect(() => {
    const shell = playerShellRef.current;
    let cancelled = false;

    const clearPlayRetries = () => {
      for (const timeoutId of playRetryTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }

      playRetryTimeoutsRef.current = [];
    };

    const destroyPlayer = () => {
      clearPlayRetries();
      playerRef.current?.destroy?.();
      playerRef.current = null;
      shell?.replaceChildren();
    };

    if (!active) {
      playingRef.current = false;
      destroyPlayer();
      setLoadStatus("idle");
      setVerifiedStartTime(null);
      return;
    }

    if (!shell) {
      setLoadStatus("error");
      return;
    }

    playingRef.current = false;
    destroyPlayer();
    setLoadStatus("loading");
    setVerifiedStartTime(null);
    const timeoutId = window.setTimeout(() => {
      setLoadStatus((current) => (current === "loading" ? "error" : current));
    }, PREVIEW_LOAD_TIMEOUT_MS);
    const host = document.createElement("div");
    host.className = "h-full w-full";
    shell.appendChild(host);

    loadYouTubeIframeApi()
      .then((api) => {
        if (cancelled) {
          return;
        }

        playerRef.current = new api.Player(host, {
          width: "100%",
          height: "100%",
          videoId: result.videoId,
          playerVars: youtubePreviewPlayerVars(window.location.origin),
          events: {
            onReady: handleReady,
            onStateChange: handleStateChange,
            onError: handleError,
            onAutoplayBlocked: handleAutoplayBlocked,
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      playingRef.current = false;
      destroyPlayer();
    };

    function handleReady(event: YouTubePlayerEvent) {
      const iframe = event.target.getIframe?.() ?? shell?.querySelector("iframe");

      iframe?.setAttribute(
        "allow",
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
      );
      startYouTubePreview(event.target, result.videoId);

      for (const delay of [250, 900]) {
        const retryId = window.setTimeout(() => {
          if (!playingRef.current && enforceYouTubePreviewStart(event.target)) {
            markPreviewPlaying(event.target);
          }
        }, delay);

        playRetryTimeoutsRef.current.push(retryId);
      }
    }

    function handleStateChange(event: YouTubePlayerStateChangeEvent) {
      if (event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
        if (!hasYouTubePreviewReachedStart(event.target)) {
          enforceYouTubePreviewStart(event.target);
          return;
        }

        markPreviewPlaying(event.target);
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.CUED) {
        enforceYouTubePreviewStart(event.target);
      }
    }

    function handleError(_event: YouTubePlayerErrorEvent) {
      clearPlayRetries();
      setLoadStatus("error");
    }

    function handleAutoplayBlocked() {
      clearPlayRetries();
      setLoadStatus("error");
    }

    function markPreviewPlaying(player: YouTubePlayer) {
      const currentTime = player.getCurrentTime?.();

      playingRef.current = true;
      clearPlayRetries();
      setVerifiedStartTime(
        typeof currentTime === "number" && Number.isFinite(currentTime)
          ? Math.round(currentTime * 1_000) / 1_000
          : null,
      );
      setLoadStatus("loaded");
    }
  }, [active, result.videoId]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-950"
      data-preview-current-time={verifiedStartTime ?? undefined}
    >
      <img
        src={result.thumbnailUrl ?? youtubeThumbnailUrl(result.videoId)}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-full w-full object-cover"
      />
      <div
        ref={playerShellRef}
        className={`pointer-events-none absolute inset-0 h-full w-full [&_iframe]:h-full [&_iframe]:w-full ${
          active && loadStatus !== "error" ? "" : "invisible"
        }`}
        aria-hidden="true"
      />
      {pending || loadStatus === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/80 text-white">
          <LoaderCircle className="animate-spin" size={22} />
          <span className="sr-only">预览加载中</span>
        </div>
      ) : null}
      {loadStatus === "error" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950 px-2 text-center text-xs font-semibold text-white">
          预览加载较慢，点一下重试
        </div>
      ) : null}
    </div>
  );
}

function QueueTab({
  roomId,
  currentItem,
  queuedItems,
  isSocketConnected,
  canUseLocalFallback,
  sendRoomMessage,
}: {
  roomId: string;
  currentItem: QueueItem | null;
  queuedItems: QueueItem[];
  isSocketConnected: boolean;
  canUseLocalFallback: boolean;
  sendRoomMessage: (message: ClientToServerMessage) => boolean;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: "remove"; item: QueueItem }
    | { type: "restart"; item: QueueItem }
    | { type: "skip"; item: QueueItem }
    | null
  >(null);

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return "";
    if (confirmAction.type === "remove") return "确定要删除这首歌吗？";
    if (confirmAction.type === "restart") return "确定要重唱当前歌曲吗？";
    return "确定要切到下一首吗？";
  }, [confirmAction]);

  const handleConfirm = () => {
    if (!confirmAction) return;

    const sentOrFallback =
      confirmAction.type === "remove"
        ? runQueueAction({
            roomId,
            action: confirmAction,
            isSocketConnected,
            canUseLocalFallback,
            sendRoomMessage,
          })
        : runPlaybackControl({
            roomId,
            action: confirmAction.type,
            item: confirmAction.item,
            isSocketConnected,
            canUseLocalFallback,
            sendRoomMessage,
          });

    if (!sentOrFallback) {
      setActionError("房间连接正在恢复，请稍后再操作歌单。");
      return;
    }

    setActionError(null);
    setConfirmAction(null);
  };

  const handlePlaybackControl = (action: "skip" | "restart") => {
    if (!currentItem) {
      setActionError("当前没有正在播放的歌曲。");
      return;
    }

    setConfirmAction({ type: action, item: currentItem });
  };

  const handlePromote = (item: QueueItem) => {
    const sentOrFallback = runQueueAction({
      roomId,
      action: { type: "promote", item },
      isSocketConnected,
      canUseLocalFallback,
      sendRoomMessage,
    });

    if (!sentOrFallback) {
      setActionError("房间连接正在恢复，请稍后再操作歌单。");
      return;
    }

    setActionError(null);
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_16%_6%,rgba(20,184,166,0.10),transparent_32%),linear-gradient(#020617,#0f172a)] px-4 py-4 text-white scrollbar-soft-dark">
      {actionError ? (
        <StatusMessage tone="warning" title="操作未完成" appearance="dark" className="mb-4">
          {actionError}
        </StatusMessage>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 shadow-lg shadow-black/20">
        <p className="text-base font-semibold text-teal-300">正在播放</p>
        {currentItem ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              {currentItem.thumbnailUrl ? (
                <img
                  src={currentItem.thumbnailUrl}
                  alt=""
                  draggable={false}
                  className="h-16 w-24 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-base font-semibold text-white">{currentItem.title}</h2>
                <p className="mt-1 truncate text-sm text-slate-400">
                  {currentItem.channelTitle ?? "未知频道"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePlaybackControl("restart")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2.5 text-base font-semibold text-slate-100 transition hover:bg-white/10"
              >
                <RotateCcw size={16} />
                重唱
              </button>
              <button
                type="button"
                onClick={() => handlePlaybackControl("skip")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2.5 text-base font-semibold text-slate-100 transition hover:bg-white/10"
              >
                <SkipForward size={16} />
                切歌
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-base text-slate-400">当前没有视频播放</p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">即将播放</h2>
        <span className="text-sm text-slate-400">
          {queuedItems.length} 首
        </span>
      </div>

      {queuedItems.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/[0.04] px-4 py-10 text-center">
          <ListMusic className="mx-auto text-slate-400" size={30} />
          <p className="mt-2 text-base text-slate-400">歌单还是空的，去点第一首吧。</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {queuedItems.map((item, index) => (
            <QueueItemCard
              key={item.id}
              item={item}
              index={index}
              onPromote={() => handlePromote(item)}
              onRemove={() => setConfirmAction({ type: "remove", item })}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        body={confirmAction?.item.title}
        destructive={confirmAction?.type === "remove"}
        appearance="dark"
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
      />
    </section>
  );
}

function QueueItemCard({
  item,
  index,
  onPromote,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  onPromote: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-lg shadow-black/20">
      <div className="flex gap-3">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" draggable={false} className="h-20 w-28 rounded-md object-cover" />
        ) : (
          <div className="grid h-20 w-28 place-items-center rounded-md bg-slate-800 text-slate-400">
            <Music2 size={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-rose-300">第 {index + 1} 首</p>
          <h3 className="line-clamp-2 text-base font-semibold leading-5 text-white">
            {item.title}
          </h3>
          <p className="mt-1 truncate text-sm text-slate-400">{item.channelTitle ?? "未知频道"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPromote}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-base font-semibold text-slate-200 transition hover:bg-white/10"
        >
          <ArrowUpToLine size={16} />
          置顶
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300/25 px-3 py-2.5 text-base font-semibold text-rose-200 transition hover:bg-rose-300/10"
        >
          <Trash2 size={16} />
          删歌
        </button>
      </div>
    </article>
  );
}

function ConnectionBadge({
  status,
  canUseLocalFallback,
}: {
  status: SocketStatus;
  canUseLocalFallback: boolean;
}) {
  const connected = status === "connected";
  const label = connectionLabel(status, canUseLocalFallback);
  const Icon = connected ? Wifi : WifiOff;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
        connected
          ? "bg-emerald-300/15 text-emerald-200"
          : canUseLocalFallback
            ? "bg-white/10 text-slate-300"
            : "bg-amber-300/15 text-amber-200"
      }`}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

function connectionLabel(status: SocketStatus, canUseLocalFallback: boolean) {
  if (canUseLocalFallback) return "本地模式";
  if (status === "connected") return "实时已连接";
  if (status === "connecting") return "正在连接";
  if (status === "reconnecting") return "正在重连";
  return "连接不可用";
}

function runQueueAction({
  roomId,
  action,
  isSocketConnected,
  canUseLocalFallback,
  sendRoomMessage,
}: {
  roomId: string;
  action: { type: "promote"; item: QueueItem } | { type: "remove"; item: QueueItem };
  isSocketConnected: boolean;
  canUseLocalFallback: boolean;
  sendRoomMessage: (message: ClientToServerMessage) => boolean;
}) {
  if (action.type === "promote") {
    if (isSocketConnected) {
      return sendRoomMessage({
        type: "PROMOTE_QUEUE_ITEM",
        payload: {
          queueItemId: action.item.id,
        },
      });
    }

    if (canUseLocalFallback) {
      promoteSong(roomId, action.item.id);
      return true;
    }

    return false;
  }

  if (isSocketConnected) {
    return sendRoomMessage({
      type: "REMOVE_QUEUE_ITEM",
      payload: {
        queueItemId: action.item.id,
      },
    });
  }

  if (canUseLocalFallback) {
    removeSong(roomId, action.item.id);
    return true;
  }

  return false;
}

function runPlaybackControl({
  roomId,
  action,
  item,
  isSocketConnected,
  canUseLocalFallback,
  sendRoomMessage,
}: {
  roomId: string;
  action: "skip" | "restart";
  item: QueueItem;
  isSocketConnected: boolean;
  canUseLocalFallback: boolean;
  sendRoomMessage: (message: ClientToServerMessage) => boolean;
}) {
  if (isSocketConnected) {
    return sendRoomMessage({
      type: action === "skip" ? "PLAYER_ENDED" : "RESTART_CURRENT_ITEM",
      payload: {
        queueItemId: item.id,
        videoId: item.videoId,
      },
    });
  }

  if (canUseLocalFallback) {
    if (action === "skip") {
      playerEnded(roomId, item.id, item.videoId);
    } else {
      restartCurrentSong(roomId, item.id, item.videoId);
    }

    return true;
  }

  return false;
}

function searchErrorMessage(error: unknown) {
  if (error instanceof SearchRequestTimeoutError) {
    return error.message;
  }

  if (error instanceof ApiClientError && error.status === 429) {
    return "搜索太频繁，当前结果已保留，请稍等一下再试。";
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "请稍后再试。";
}

function searchPartialMessage(response: SearchResponse) {
  if (response.cacheMeta?.quota?.exhausted) {
    return `今日搜索额度已用完，${quotaResetMessage(response.cacheMeta.quota.resetAt)}；当前结果已保留。`;
  }

  if (response.cacheMeta?.throttled) {
    return "搜索太频繁，已保留当前结果，请稍等一下再试。";
  }

  if (response.cacheMeta?.providerRateLimited) {
    return response.results.length > 0
      ? "YouTube 暂时限流，已返回当前找到的结果。"
      : "YouTube 暂时限流，已保留当前结果。";
  }

  return response.results.length > 0
    ? "已在 2 秒内返回当前找到的结果。"
    : "搜索已在 2 秒停止，已保留当前结果。";
}

function quotaResetMessage(resetAt?: string) {
  return resetAt ? formatRelativeQuotaReset(resetAt) : "本地重置时间暂不可用";
}

interface PersistedSearchState {
  savedAt: number;
  query: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  response: SearchResponse | null;
  visibleResultCount: number;
  selectedVideoId: string | null;
  activePreviewVideoId: string | null;
  scrollY: number;
}

function readPersistedSearchState(roomId: string): PersistedSearchState | null {
  if (!roomId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(searchStateStorageKey(roomId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSearchState>;

    if (!parsed.savedAt || Date.now() - parsed.savedAt > SEARCH_STATE_TTL_MS) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      query: typeof parsed.query === "string" ? parsed.query : "",
      searchType: parsed.searchType === "artist" ? "artist" : "song",
      includeOriginalVocal: parsed.includeOriginalVocal === true,
      response: isSearchResponse(parsed.response) ? parsed.response : null,
      visibleResultCount: clampVisibleResultCount(parsed.visibleResultCount),
      selectedVideoId:
        typeof parsed.selectedVideoId === "string" ? parsed.selectedVideoId : null,
      activePreviewVideoId:
        typeof parsed.activePreviewVideoId === "string" ? parsed.activePreviewVideoId : null,
      scrollY:
        typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY)
          ? Math.max(parsed.scrollY, 0)
          : 0,
    };
  } catch {
    return null;
  }
}

function writePersistedSearchState(
  roomId: string,
  state: Omit<PersistedSearchState, "savedAt">,
) {
  if (!roomId) {
    return;
  }

  try {
    window.localStorage.setItem(
      searchStateStorageKey(roomId),
      JSON.stringify({
        ...state,
        visibleResultCount: clampVisibleResultCount(state.visibleResultCount),
        savedAt: Date.now(),
      } satisfies PersistedSearchState),
    );
  } catch {
    // localStorage may be unavailable in private browsing or full-quota states.
  }
}

function searchStateStorageKey(roomId: string) {
  return `ktv-assistant:mobile-search:${roomId}`;
}

function clampVisibleResultCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return SEARCH_RESULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.floor(value), SEARCH_RESULT_PAGE_SIZE), SEARCH_FETCH_LIMIT);
}

function findPersistedResult(response: SearchResponse | null | undefined, videoId: unknown) {
  if (!response || typeof videoId !== "string") {
    return null;
  }

  return response.results.find((result) => result.videoId === videoId) ?? null;
}

function isSearchResponse(value: unknown): value is SearchResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof (value as { query?: unknown }).query === "string" &&
    "results" in value &&
    Array.isArray((value as { results?: unknown }).results)
  );
}
