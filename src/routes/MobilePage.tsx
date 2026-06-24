import {
  ArrowUpToLine,
  Check,
  ListMusic,
  Music2,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import { addSongToRoom, promoteSong, removeSong, useRoomSnapshot } from "../lib/roomState";
import { searchMockVideos } from "../lib/mockSearch";
import { youtubeEmbedUrl } from "../lib/youtube";
import { useMobileUiStore } from "../stores/mobileUiStore";
import type { QueueItem } from "../types/room";
import type { VideoSearchResult } from "../types/youtube";

export default function MobilePage() {
  const { roomId = "" } = useParams();
  useRoomSocket({ roomId, role: "mobile" });
  const snapshot = useRoomSnapshot(roomId);
  const currentItem = getCurrentItem(snapshot);
  const queuedItems = getQueuedItems(snapshot);
  const activeTab = useMobileUiStore((state) => state.activeTab);
  const setActiveTab = useMobileUiStore((state) => state.setActiveTab);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-white shadow-sm">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-normal">K歌助手</h1>
              <p className="text-xs text-slate-500">房间 {roomId}</p>
            </div>
            <div className="rounded-lg bg-teal-50 px-3 py-2 text-right">
              <p className="text-[11px] text-teal-700">即将播放</p>
              <p className="text-sm font-semibold text-teal-950">{queuedItems.length} 首</p>
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
          <SearchTab roomId={roomId} />
        ) : (
          <QueueTab
            roomId={roomId}
            currentItem={currentItem}
            queuedItems={queuedItems}
          />
        )}
      </div>
    </main>
  );
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

function SearchTab({ roomId }: { roomId: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VideoSearchResult | null>(null);
  const setActiveTab = useMobileUiStore((state) => state.setActiveTab);

  const searchMutation = useMutation({
    mutationFn: (nextQuery: string) => searchMockVideos(nextQuery, 4),
    onSuccess: (response) => {
      setSelected(response.results[0] ?? null);
    },
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    searchMutation.mutate(query);
  };

  const addSelectedSong = () => {
    if (!selected) return;

    addSongToRoom(roomId, {
      videoId: selected.videoId,
      title: selected.title,
      channelTitle: selected.channelTitle,
      thumbnailUrl: selected.thumbnailUrl,
    });
    setActiveTab("queue");
  };

  const results = searchMutation.data?.results ?? [];

  return (
    <section className="flex-1 px-4 py-4">
      <form onSubmit={submitSearch} className="flex gap-2">
        <label className="sr-only" htmlFor="song-search">
          搜索歌曲
        </label>
        <input
          id="song-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="请输入歌名"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={!query.trim() || searchMutation.isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Search size={18} />
          搜索
        </button>
      </form>

      {searchMutation.isError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          搜索失败，请稍后再试
        </p>
      ) : null}

      {searchMutation.isPending ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-52 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!searchMutation.isPending && searchMutation.data && results.length === 0 ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          没有找到合适的视频
        </p>
      ) : null}

      {results.length > 0 ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {results.map((result) => (
              <CandidateVideoCard
                key={result.videoId}
                result={result}
                selected={selected?.videoId === result.videoId}
                onSelect={() => setSelected(result)}
              />
            ))}
          </div>
          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
            <button
              type="button"
              onClick={addSelectedSong}
              disabled={!selected}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              <Check size={20} />
              点歌
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function CandidateVideoCard({
  result,
  selected,
  onSelect,
}: {
  result: VideoSearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-lg border bg-white text-left transition ${
        selected
          ? "border-teal-500 ring-4 ring-teal-100"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="aspect-video bg-slate-950">
        <iframe
          className="h-full w-full"
          title={result.title}
          src={youtubeEmbedUrl(result.videoId, { start: 30, muted: true })}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-700">
            <Play size={15} />
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
              {result.title}
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">{result.channelTitle}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function QueueTab({
  roomId,
  currentItem,
  queuedItems,
}: {
  roomId: string;
  currentItem: QueueItem | null;
  queuedItems: QueueItem[];
}) {
  const [confirmAction, setConfirmAction] = useState<
    | { type: "promote"; item: QueueItem }
    | { type: "remove"; item: QueueItem }
    | null
  >(null);

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return "";
    return confirmAction.type === "promote"
      ? "确定要置顶这首歌吗？"
      : "确定要删除这首歌吗？";
  }, [confirmAction]);

  const handleConfirm = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "promote") {
      promoteSong(roomId, confirmAction.item.id);
    } else {
      removeSong(roomId, confirmAction.item.id);
    }

    setConfirmAction(null);
  };

  return (
    <section className="flex-1 overflow-y-auto px-4 py-4 scrollbar-soft">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-teal-700">正在播放</p>
        {currentItem ? (
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
        ) : (
          <p className="mt-2 text-sm text-slate-500">当前没有视频播放</p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-normal">即将播放</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
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
              onPromote={() => setConfirmAction({ type: "promote", item })}
              onRemove={() => setConfirmAction({ type: "remove", item })}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        body={confirmAction?.item.title ?? ""}
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

function ConfirmDialog({
  open,
  title,
  body,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
