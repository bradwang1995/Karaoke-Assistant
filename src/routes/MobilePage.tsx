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
import { ApiClientError, searchVideosViaApi } from "../lib/apiClient";
import { searchMockVideos } from "../lib/mockSearch";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import {
  addSongToRoom,
  playerEnded,
  promoteSong,
  removeSong,
  restartCurrentSong,
  useRoomSnapshot,
} from "../lib/roomState";
import { youtubePreviewEmbedUrl, youtubeThumbnailUrl } from "../lib/youtube";
import { useMobileUiStore } from "../stores/mobileUiStore";
import type { QueueItem } from "../types/room";
import type { ClientToServerMessage } from "../types/websocket";
import type { SearchResponse, SearchType, VideoSearchResult } from "../types/youtube";

const SEARCH_RESULT_PAGE_SIZE = 10;
const SEARCH_FETCH_LIMIT = 50;
const RECOMMENDATION_FETCH_LIMIT = 200;
const PREVIEW_DEBOUNCE_MS = 600;
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
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-white shadow-sm [--mobile-header-height:10.25rem]">
        <header className="sticky top-0 z-[60] h-[var(--mobile-header-height)] shrink-0 overflow-hidden border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-normal">K歌助手</h1>
              <p className="text-xs text-slate-500">房间 {roomId}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div ref={queueTargetRef} className="rounded-lg bg-teal-50 px-3 py-2 text-right">
                <p className="text-[11px] text-teal-700">即将播放</p>
                <p className="text-sm font-semibold text-teal-950">{queuedItems.length} 首</p>
              </div>
              <ConnectionBadge
                status={roomSocket.status}
                canUseLocalFallback={roomSocket.canUseLocalFallback}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
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
      className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
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

      setSearchResponse(response);
      setVisibleResultCount(SEARCH_RESULT_PAGE_SIZE);
      setActivePreviewVideoId(null);
      setPendingPreviewVideoId(null);
      setSelected(response.results[0] ?? null);
    },
  });

  const activeResults = useMemo(
    () => searchResponse?.results ?? recommendationsQuery.data?.results ?? [],
    [recommendationsQuery.data?.results, searchResponse?.results],
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
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [canLoadMore, isLoadingMore, loadMoreResults]);

  useEffect(() => {
    if (!initialSearchState?.scrollY || restoredScrollRef.current || !searchResponse) {
      return;
    }

    restoredScrollRef.current = true;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: initialSearchState.scrollY });
    });
  }, [initialSearchState, searchResponse]);

  useEffect(() => {
    let frameId: number | null = null;

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setScrollY(window.scrollY);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", handleScroll);
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
    setActivePreviewVideoId(null);
    cancelPendingPreview();
    setPendingPreviewVideoId(result.videoId);
    previewDebounceTimeoutRef.current = window.setTimeout(() => {
      setPendingPreviewVideoId(null);
      setActivePreviewVideoId(result.videoId);
      previewDebounceTimeoutRef.current = null;
    }, PREVIEW_DEBOUNCE_MS);
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
    setSearchResponse(null);
    setVisibleResultCount(SEARCH_RESULT_PAGE_SIZE);
    setSelected(null);
    setActivePreviewVideoId(null);
    cancelPendingPreview();
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

  const showingRecommendations = !searchResponse;
  const isLoadingResults =
    searchMutation.isPending || (showingRecommendations && recommendationsQuery.isPending);
  const resultHeading = showingRecommendations ? "缓存推荐" : "搜索结果";
  const resultCountLabel = isLoadingResults
    ? "加载中"
    : showingRecommendations
      ? `${visibleResults.length}/${activeResults.length} 首`
      : `${visibleResults.length}/${activeResults.length} 首`;

  return (
    <section className="relative isolate z-0 flex-1 px-4 pb-24">
      <MobileToast toast={toast} />
      <AddToQueueTrail trail={addTrail} />

      <div className="sticky top-[var(--mobile-header-height)] z-50 isolate -mx-4 overflow-hidden border-b border-slate-200 bg-white px-4 pb-2 pt-3 shadow-sm">
        <form onSubmit={submitSearch}>
          <div className="grid grid-cols-[4.65rem_minmax(0,1fr)_4.25rem_2.5rem] gap-1.5 sm:grid-cols-[5.25rem_minmax(0,1fr)_4.75rem_2.75rem] sm:gap-2">
            <label className="sr-only" htmlFor="search-type">
              搜索类型
            </label>
            <select
              id="search-type"
              value={searchType}
              onChange={(event) => {
                const nextSearchType = event.target.value as SearchType;
                setSearchType(nextSearchType);

                if (query.trim() && searchResponse) {
                  runSearch(query, nextSearchType, includeOriginalVocal);
                }
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
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
              onChange={(event) => {
                setQuery(event.target.value);

                if (!event.target.value.trim()) {
                  latestSearchRequestRef.current += 1;
                  searchMutation.reset();
                  setSearchResponse(null);
                  setVisibleResultCount(SEARCH_RESULT_PAGE_SIZE);
                  setSelected(null);
                  setActivePreviewVideoId(null);
                  cancelPendingPreview();
                }
              }}
              placeholder={searchType === "artist" ? "歌手名" : "歌名"}
              enterKeyHint="search"
              className="h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
            <PillToggle
              label="原唱"
              checked={includeOriginalVocal}
              onChange={(checked) => {
                setIncludeOriginalVocal(checked);

                if (query.trim() && searchResponse) {
                  runSearch(query, searchType, checked);
                }
              }}
            />
            <button
              type="submit"
              aria-label="搜索"
              title="搜索"
              disabled={!query.trim() || searchMutation.isPending}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-11"
            >
              <Search size={18} />
            </button>
          </div>
        </form>
        <div className="mt-1.5 flex h-5 items-center justify-between gap-3">
          <h2 className="text-sm font-semibold leading-5 text-slate-700">{resultHeading}</h2>
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 text-xs leading-5 text-slate-600">
            {resultCountLabel}
          </span>
        </div>
      </div>

      {searchMutation.isError ? (
        <StatusMessage tone="error" title="搜索失败" className="mt-4">
          {searchErrorMessage(searchMutation.error)}
        </StatusMessage>
      ) : null}

      {recommendationsQuery.isError && showingRecommendations ? (
        <StatusMessage tone="warning" title="推荐加载失败" className="mt-4">
          {searchErrorMessage(recommendationsQuery.error)}
        </StatusMessage>
      ) : null}

      {isLoadingResults ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: SEARCH_RESULT_PAGE_SIZE }, (_, item) => (
            <div key={item} className="aspect-video animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!isLoadingResults && searchResponse && activeResults.length === 0 ? (
        <StatusMessage tone="info" className="mt-5">
          没有找到合适的视频。
        </StatusMessage>
      ) : null}

      {!isLoadingResults && showingRecommendations && activeResults.length === 0 ? (
        <StatusMessage tone="info" className="mt-5">
          暂无推荐内容。
        </StatusMessage>
      ) : null}

      {!isLoadingResults && activeResults.length > 0 ? (
        <>
          <div
            ref={resultsGridRef}
            className="relative z-0 mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
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
              <StatusMessage tone="loading">正在加载更多缓存结果</StatusMessage>
            ) : canLoadMore ? (
              <button
                type="button"
                onClick={loadMoreResults}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                加载更多
              </button>
            ) : (
              <p className="py-3 text-center text-xs text-slate-500">已经显示全部缓存结果</p>
            )}
          </div>
          <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={addSelectedSong}
              disabled={!selected}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              <Check size={20} />
              点歌
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
              搜索使用 YouTube Data API，视频仅通过 YouTube 嵌入播放器播放。
            </p>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={duplicateCandidate !== null}
        title="歌单里已经有这首歌"
        body={duplicateCandidate?.title}
        confirmLabel="继续点歌"
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
      className={`inline-flex h-10 items-center justify-center gap-1 rounded-full border px-1.5 text-[11px] font-semibold transition focus:outline-none focus:ring-4 focus:ring-teal-100 ${
        checked
          ? "border-teal-400 bg-teal-500 text-teal-950"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={`relative h-5 w-8 rounded-full transition ${
          checked ? "bg-teal-700/30" : "bg-slate-300"
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
      className={`relative isolate z-0 aspect-video cursor-pointer overflow-hidden rounded-lg border bg-white text-left transition focus:outline-none focus:ring-4 ${
        selected
          ? "border-teal-500 ring-4 ring-teal-100"
          : "border-slate-200 hover:border-slate-300 focus:border-teal-500 focus:ring-teal-100"
      }`}
    >
      <CandidatePreview
        result={result}
        active={previewActive}
        pending={previewPending}
      />
      {duplicate || selected ? (
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-[1] flex max-w-[calc(100%-0.75rem)] flex-col items-end gap-1">
          {duplicate ? (
            <span className="max-w-full truncate rounded-md bg-amber-100 px-1.5 py-1 text-[10px] font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200">
              已在歌单
            </span>
          ) : null}
          {selected ? (
            <span className="max-w-full truncate rounded-md bg-teal-100 px-1.5 py-1 text-[10px] font-semibold text-teal-800 shadow-sm ring-1 ring-teal-200">
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
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!active) {
      setLoadStatus("idle");
      return;
    }

    setLoadStatus("loading");
    const timeoutId = window.setTimeout(() => {
      setLoadStatus((current) => (current === "loading" ? "error" : current));
    }, PREVIEW_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [active, result.videoId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <img
        src={result.thumbnailUrl ?? youtubeThumbnailUrl(result.videoId)}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {active ? (
        <iframe
          className="pointer-events-none absolute inset-0 h-full w-full"
          title="视频预览"
          src={youtubePreviewEmbedUrl(result.videoId)}
          loading="eager"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => setLoadStatus("loaded")}
          onError={() => setLoadStatus("error")}
        />
      ) : null}
      {pending || loadStatus === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/80 text-white">
          <LoaderCircle className="animate-spin" size={22} />
          <span className="sr-only">预览加载中</span>
        </div>
      ) : null}
      {loadStatus === "error" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950 px-2 text-center text-[11px] font-semibold text-white">
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
    <section className="flex-1 overflow-y-auto px-4 py-4 scrollbar-soft">
      {actionError ? (
        <StatusMessage tone="warning" title="操作未完成" className="mb-4">
          {actionError}
        </StatusMessage>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-teal-700">正在播放</p>
        {currentItem ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              {currentItem.thumbnailUrl ? (
                <img
                  src={currentItem.thumbnailUrl}
                  alt=""
                  className="h-16 w-24 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <h2 className="line-clamp-2 font-semibold text-slate-950">{currentItem.title}</h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {currentItem.channelTitle ?? "未知频道"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePlaybackControl("restart")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw size={16} />
                重唱
              </button>
              <button
                type="button"
                onClick={() => handlePlaybackControl("skip")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <SkipForward size={16} />
                切歌
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">当前没有视频播放</p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-normal">即将播放</h2>
        <span className="text-xs text-slate-500">
          {queuedItems.length} 首
        </span>
      </div>

      {queuedItems.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
          <ListMusic className="mx-auto text-slate-400" size={30} />
          <p className="mt-2 text-sm text-slate-500">歌单还是空的，去点第一首吧。</p>
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
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="h-20 w-28 rounded-md object-cover" />
        ) : (
          <div className="grid h-20 w-28 place-items-center rounded-md bg-slate-100 text-slate-400">
            <Music2 size={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-rose-700">第 {index + 1} 首</p>
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
            {item.title}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">{item.channelTitle ?? "未知频道"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPromote}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowUpToLine size={16} />
          置顶
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
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
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
        connected
          ? "bg-emerald-50 text-emerald-700"
          : canUseLocalFallback
            ? "bg-slate-100 text-slate-600"
            : "bg-amber-50 text-amber-700"
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
  if (error instanceof ApiClientError && error.status === 429) {
    return "搜索太频繁了，请稍等一下再试。";
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "请稍后再试。";
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
