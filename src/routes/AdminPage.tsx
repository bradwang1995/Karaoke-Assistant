import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Music2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  adminSessionQueryKey,
  deleteAdminRepository,
  fetchAdminCleanupPreview,
  fetchAdminOverview,
  fetchAdminRepository,
  fetchAdminSearches,
  fetchAdminSession,
  fetchAdminStorage,
  loginAdmin,
  logoutAdmin,
  runAdminCleanup,
} from "../lib/adminApi";
import { ApiClientError } from "../lib/apiClient";
import type {
  AdminCleanupPreview,
  AdminOverview,
  AdminRange,
  AdminRepositoryItem,
  AdminResponseSource,
  AdminStorageResourceMetric,
  AdminStorageUsageSource,
} from "../types/admin";
import type { SearchType } from "../types/youtube";

const adminNav = [
  { path: "/admin", label: "总览", icon: LayoutDashboard },
  { path: "/admin/searches", label: "搜索记录", icon: Search },
  { path: "/admin/repository", label: "资料库", icon: Database },
] as const;

export default function AdminPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: adminSessionQueryKey,
    queryFn: fetchAdminSession,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (sessionQuery.isPending) {
    return <FullPageLoader />;
  }

  if (sessionQuery.isError) {
    return (
      <AdminLogin
        onAuthenticated={async () => {
          await queryClient.invalidateQueries({ queryKey: adminSessionQueryKey });
        }}
      />
    );
  }

  return <AdminShell />;
}

function AdminLogin({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const loginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: onAuthenticated,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password && !loginMutation.isPending) loginMutation.mutate(password);
  };

  return (
    <main className="admin-surface relative grid min-h-screen place-items-center overflow-hidden px-5 py-12 text-slate-100">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-teal-400/10 blur-[120px]" />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/75 p-7 shadow-2xl shadow-slate-950/60 backdrop-blur-xl sm:p-9"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-teal-300/15 bg-teal-300/10 text-teal-300">
            <Music2 aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-teal-300">K歌助手</p>
            <h1 className="text-2xl font-semibold tracking-tight">管理控制台</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-400">
          请输入管理员密码。登录状态仅保存在安全的 HttpOnly Cookie 中。
        </p>
        <label className="block text-sm font-medium text-slate-200" htmlFor="admin-password">
          管理员密码
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-900/80 px-4 focus-within:border-teal-300/60 focus-within:ring-2 focus-within:ring-teal-300/10">
          <LockKeyhole className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            id="admin-password"
            autoFocus
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
            placeholder="输入密码"
          />
        </div>
        {loginMutation.isError ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {errorMessage(loginMutation.error)}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!password || loginMutation.isPending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loginMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          登录
        </button>
      </form>
    </main>
  );
}

function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchingCount = useIsFetching({
    predicate: (query) => String(query.queryKey[0]).startsWith("admin-"),
  });
  const activeNav = adminNav.find((item) => item.path === location.pathname) ?? adminNav[0];
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("admin-") });
      navigate("/admin", { replace: true });
      await queryClient.invalidateQueries({ queryKey: adminSessionQueryKey });
    },
  });
  const refreshMutation = useMutation({
    mutationFn: () => fetchAdminStorage(true),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return (
            key === "admin-overview" ||
            key === "admin-searches" ||
            key.startsWith("admin-repository")
          );
        },
      });
    },
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.removeQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return key !== "admin-session" && key.startsWith("admin-");
        },
      });
      void queryClient.invalidateQueries({ queryKey: adminSessionQueryKey });
    };

    window.addEventListener("ktv-admin-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("ktv-admin-unauthorized", handleUnauthorized);
  }, [queryClient]);

  return (
    <div className="admin-surface min-h-screen text-slate-100 lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 bg-slate-950/65 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-teal-300/15 bg-teal-300/10 text-teal-300">
              <Music2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold tracking-tight">K歌助手</p>
              <p className="text-xs text-slate-500">管理控制台</p>
            </div>
          </div>
          <button
            type="button"
            title="退出登录"
            onClick={() => logoutMutation.mutate()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-4 grid grid-cols-3 gap-2 lg:mt-10 lg:block lg:space-y-2" aria-label="管理页面">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = item.path === activeNav.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition lg:justify-start ${
                  active
                    ? "border border-teal-300/15 bg-teal-300/10 text-teal-200"
                    : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          className="mt-auto hidden items-center gap-2 rounded-xl px-3 py-3 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-200 lg:flex"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          退出登录
        </button>
      </aside>

      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300/70">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {activeNav.path === "/admin" ? "管理控制台" : activeNav.label}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-teal-300/30 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${fetchingCount || refreshMutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
            刷新数据
          </button>
        </header>

        {activeNav.path === "/admin/searches" ? (
          <SearchRecordsPage />
        ) : activeNav.path === "/admin/repository" ? (
          <RepositoryPage />
        ) : (
          <OverviewPage />
        )}
      </main>
    </div>
  );
}

function OverviewPage() {
  const [range, setRange] = useState<AdminRange>("24h");
  const overviewQuery = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => fetchAdminOverview(range),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (overviewQuery.isPending) return <SectionLoader label="正在读取管理数据…" />;
  if (overviewQuery.isError && !overviewQuery.data) {
    return <ErrorPanel error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />;
  }

  const data = overviewQuery.data!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-full border border-teal-300/30 bg-teal-300/10 text-teal-300">
            {data.collectionStartedAt ? <Check className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              {data.collectionStartedAt ? "系统运行正常" : "数据采集中"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {data.collectionStartedAt
                ? "搜索记录与持久资料库均可用。"
                : "首批搜索发生后，这里会开始显示趋势与热门搜索。"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <RangeTabs value={range} onChange={setRange} />
          <DataFreshness
            updatedAt={data.updatedAt}
            fetching={overviewQuery.isFetching}
            error={overviewQuery.isError ? overviewQuery.error : null}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QuotaCard data={data} />
        <RepositorySummary data={data} />
      </div>

      <CatalogEfficiencySummary data={data} />

      <Panel className="min-h-[260px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">用户搜索趋势</h3>
            <p className="mt-1 text-xs text-slate-500">本地资料命中与外部 API 请求</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <LegendDot color="bg-teal-300" label="本地资料命中" />
            <LegendDot color="bg-violet-400" label="外部 API" />
          </div>
        </div>
        <div className="relative h-[175px]" role="img" aria-label="用户搜索趋势图">
          {data.searches.trend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.searches.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="repository-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5eead4" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#5eead4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="external-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={26} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,.18)",
                    borderRadius: 12,
                    color: "#e2e8f0",
                    boxShadow: "0 16px 40px rgba(2,6,23,.45)",
                  }}
                  labelStyle={{ color: "#94a3b8", marginBottom: 6 }}
                />
                <Area type="monotone" dataKey="repositoryHits" name="本地资料命中" stroke="#5eead4" fill="url(#repository-fill)" strokeWidth={2} />
                <Area type="monotone" dataKey="externalRequests" name="外部 API" stroke="#a78bfa" fill="url(#external-fill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <TopSearches data={data} />
        <SystemNotices data={data} />
      </div>
    </div>
  );
}

function QuotaCard({ data }: { data: AdminOverview }) {
  const usedPercentage = data.quota.dailyLimit
    ? Math.min((data.quota.used / data.quota.dailyLimit) * 100, 100)
    : 0;
  const countdown = useCountdown(data.quota.resetAt);

  return (
    <Panel>
      <p className="text-sm font-semibold">今日外部搜索</p>
      <p className="mt-1 text-xs text-slate-500">YouTube Data API 调用，本地耐久账本估算</p>
      <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 text-center">
        <div className="px-2">
          <p className="text-2xl font-semibold tabular-nums text-teal-300 sm:text-3xl">{formatNumber(data.quota.used)}</p>
          <p className="mt-1 text-xs text-slate-500">已使用</p>
        </div>
        <div className="px-2">
          <p className="text-2xl font-semibold tabular-nums text-teal-300 sm:text-3xl">{formatNumber(data.quota.remaining)}</p>
          <p className="mt-1 text-xs text-slate-500">剩余</p>
        </div>
        <div className="px-2">
          <p className="font-mono text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{countdown}</p>
          <p className="mt-1 text-xs text-slate-500">距重置</p>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-teal-300 transition-[width]" style={{ width: `${usedPercentage}%` }} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        每日上限 {formatNumber(data.quota.dailyLimit)}，于 {formatDateTime(data.quota.resetAt)} 重置（太平洋配额日）
      </p>
    </Panel>
  );
}

function RepositorySummary({ data }: { data: AdminOverview }) {
  const d1 = data.storage.d1;
  const kv = data.storage.kv;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">持久资料库</p>
          <p className="mt-1 text-xs text-slate-500">D1 精确查询结果，无自动过期</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-300">
          <Database className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-6 grid grid-cols-4 divide-x divide-white/10 text-center">
        <Metric label="查询" value={formatNumber(data.repository.totalQueries)} />
        <Metric label="结果" value={formatNumber(data.repository.totalResults)} />
        <Metric label="复用" value={formatNumber(data.repository.repositoryHits)} />
        <Metric
          label="D1 容量"
          value={
            d1.capacityPercentage === null
              ? "未知"
              : `${Math.round(d1.capacityPercentage)}%`
          }
        />
      </div>
      <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
        <StorageResourceRow metric={d1} />
        <StorageResourceRow metric={kv} />
      </div>
      <p className="mt-4 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-500">
        应用记录估算：
        {data.storage.repositoryEstimate.usedBytes === null
          ? "暂时无法获取"
          : formatBytes(data.storage.repositoryEstimate.usedBytes)}
        （仅搜索结果 payload，不是数据库体积） · 歌曲 {formatNumber(data.repository.uniqueSongs)} · 歌手 {formatNumber(data.repository.uniqueArtists)}
      </p>
    </Panel>
  );
}

function CatalogEfficiencySummary({ data }: { data: AdminOverview }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">候选目录与额度效率</p>
          <p className="mt-1 text-xs text-slate-500">
            原始可嵌入候选进入 D1 本地目录；用户只看到相关性过滤后的结果
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {data.catalog.lastUpdatedAt
            ? `目录更新于 ${formatDateTime(data.catalog.lastUpdatedAt)}`
            : "目录尚未开始采集"}
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-y-5 divide-white/10 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        <Metric label="目录视频" value={formatNumber(data.catalog.totalVideos)} />
        <Metric label="累计出现" value={formatNumber(data.catalog.totalAppearances)} />
        <Metric label="免外部调用" value={formatNumber(data.searches.externalCallsAvoided)} />
        <Metric label="本地复用率" value={formatPercentage(data.searches.localReuseRate)} />
        <Metric
          label="新增候选/额度"
          value={data.searches.usableVideosPerExternalCall.toFixed(1)}
        />
        <Metric
          label="过滤前/后"
          value={`${formatNumber(data.searches.candidateResults)}/${formatNumber(data.searches.filteredResults)}`}
        />
      </div>
      <p className="mt-5 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-500">
        当前范围内共调用 {formatNumber(data.searches.externalSearchCalls)} 次 search.list，
        新增 {formatNumber(data.searches.uniqueCatalogVideosAdded)} 个独立候选。新查询本地命中至少
        10 条时直接返回，不再消耗搜索额度。
      </p>
    </Panel>
  );
}

function StorageResourceRow({ metric }: { metric: AdminStorageResourceMetric }) {
  const value =
    metric.usedBytes === null
      ? "暂时无法获取"
      : metric.capacityBytes === null
        ? `${formatBytes(metric.usedBytes)} · 容量上限未配置`
        : `${formatBytes(metric.usedBytes)} / ${formatBytes(metric.capacityBytes)} · ${formatPercentage(metric.capacityPercentage)}`;
  const details = [
    storageUsageSourceLabel(metric.usageSource),
    metric.resource === "kv" && metric.keyCount !== null
      ? `${formatNumber(metric.keyCount)} 个键`
      : null,
    metric.measuredAt ? `测量于 ${formatDateTime(metric.measuredAt)}` : null,
    metric.stale ? "过期数据" : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
      <div>
        <p className="font-medium text-slate-300">{metric.name}</p>
        <p className="mt-1 text-slate-500">{details.join(" · ") || "暂时无法获取"}</p>
        {metric.error ? <p className="mt-1 text-amber-300/90">{metric.error.message}</p> : null}
      </div>
      <p className="tabular-nums text-slate-300">{value}</p>
    </div>
  );
}

function TopSearches({ data }: { data: AdminOverview }) {
  const hasSearches = data.searches.topSongs.length > 0 || data.searches.topArtists.length > 0;
  return (
    <Panel>
      <h3 className="font-semibold">热门搜索</h3>
      <p className="mt-1 text-xs text-slate-500">所选时间范围内的人工搜索</p>
      {!hasSearches ? (
        <EmptyState icon={<Search />} text="还没有可统计的搜索记录" />
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TopDimensionList title="歌曲" items={data.searches.topSongs} />
          <TopDimensionList title="歌手" items={data.searches.topArtists} />
        </div>
      )}
      <p className="mt-4 border-t border-white/[0.07] pt-3 text-xs text-slate-500">
        原唱分类：包含 {formatNumber(data.searches.originalPerformer.included)} · 不含 {formatNumber(data.searches.originalPerformer.excluded)} · 未知 {formatNumber(data.searches.originalPerformer.unknown)}
      </p>
    </Panel>
  );
}

function TopDimensionList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">暂无</p>
      ) : (
        <ol className="mt-2 divide-y divide-white/[0.07]">
          {items.slice(0, 3).map((item, index) => (
            <li key={item.label} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-4 text-slate-600">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{item.label}</span>
              <span className="tabular-nums text-teal-300">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SystemNotices({ data }: { data: AdminOverview }) {
  const d1 = data.storage.d1;
  const kv = data.storage.kv;
  const storageNotice =
    d1.health === "critical" || d1.health === "warning"
      ? {
        icon: AlertTriangle,
        color:
          d1.health === "critical"
            ? "text-rose-300 bg-rose-300/10"
            : "text-amber-300 bg-amber-300/10",
        title: d1.health === "critical" ? "D1 存储达到关键线" : "D1 存储达到预警线",
        body: `Cloudflare D1 API 当前报告 ${formatPercentage(d1.capacityPercentage)}。`,
      }
      : d1.health === "stale"
        ? {
            icon: AlertTriangle,
            color: "text-amber-300 bg-amber-300/10",
            title: "D1 指标已过期",
            body: `继续显示 ${d1.lastSuccessfulAt ? formatDateTime(d1.lastSuccessfulAt) : "最近一次"} 的成功数据。`,
          }
        : d1.health === "unavailable"
          ? {
              icon: AlertTriangle,
              color: "text-amber-300 bg-amber-300/10",
              title: "D1 指标暂时无法获取",
              body: d1.error?.message ?? "请检查 Cloudflare 只读指标配置。",
            }
          : {
              icon: CheckCircle2,
              color: "text-teal-300 bg-teal-300/10",
              title: "D1 存储指标正常",
              body:
                d1.capacityPercentage === null
                  ? `当前使用 ${formatBytes(d1.usedBytes ?? 0)}；容量上限未配置。`
                  : `当前 ${formatPercentage(d1.capacityPercentage)}，尚未触发存储预警。`,
            };
  const kvNotice =
    kv.health === "unavailable"
      ? {
          icon: AlertTriangle,
          color: "text-amber-300 bg-amber-300/10",
          title: "KV 指标暂时无法获取",
          body: kv.error?.message ?? "Cloudflare Analytics 尚未返回存储快照。",
        }
      : kv.health === "stale"
        ? {
            icon: AlertTriangle,
            color: "text-amber-300 bg-amber-300/10",
            title: "KV 指标已过期",
            body: `继续显示最近成功值 ${formatBytes(kv.usedBytes ?? 0)}。`,
          }
        : {
            icon: CheckCircle2,
            color: "text-sky-300 bg-sky-300/10",
            title: "KV 加速层指标可用",
            body: `Cloudflare Analytics 报告 ${formatBytes(kv.usedBytes ?? 0)}、${formatNumber(kv.keyCount ?? 0)} 个键。`,
          };
  const notices = [
    storageNotice,
    kvNotice,
    data.quota.exhausted
      ? {
          icon: AlertTriangle,
          color: "text-rose-300 bg-rose-300/10",
          title: "外部搜索配额已用尽",
          body: `将在 ${formatDateTime(data.quota.resetAt)} 重置。`,
        }
      : {
          icon: CheckCircle2,
          color: "text-teal-300 bg-teal-300/10",
          title: "外部搜索配额充足",
          body: `今日仍可使用 ${formatNumber(data.quota.remaining)} 次搜索调用。`,
        },
  ];

  return (
    <Panel>
      <h3 className="font-semibold">系统提醒</h3>
      <div className="mt-4 divide-y divide-white/[0.07]">
        {notices.map((notice) => {
          const Icon = notice.icon;
          return (
            <div key={notice.title} className="flex gap-3 py-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${notice.color}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-200">{notice.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{notice.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SearchRecordsPage() {
  const [range, setRange] = useState<AdminRange>("24h");
  const [page, setPage] = useState(1);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<AdminResponseSource | "">("");
  const recordsQuery = useQuery({
    queryKey: ["admin-searches", range, page, query, source],
    queryFn: () => fetchAdminSearches({ range, page, query: query || undefined, source: source || undefined }),
    refetchOnWindowFocus: true,
  });

  const submitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form onSubmit={submitFilter} className="flex min-w-0 flex-1 flex-wrap gap-2">
          <SearchField value={draftQuery} onChange={setDraftQuery} placeholder="搜索歌曲、歌手或关键词" />
          <select
            value={source}
            onChange={(event) => {
              setSource(event.target.value as AdminResponseSource | "");
              setPage(1);
            }}
            className="admin-select"
            aria-label="来源筛选"
          >
            <option value="">全部来源</option>
            <option value="repository">资料库</option>
            <option value="external">外部 API</option>
            <option value="mock">模拟数据</option>
            <option value="error">失败</option>
          </select>
          <button type="submit" className="admin-primary-button">筛选</button>
        </form>
        <RangeTabs value={range} onChange={(value) => { setRange(value); setPage(1); }} />
      </div>

      {recordsQuery.data ? (
        <DataFreshness
          updatedAt={recordsQuery.data.updatedAt}
          fetching={recordsQuery.isFetching}
          error={recordsQuery.isError ? recordsQuery.error : null}
        />
      ) : null}

      <Panel className="overflow-hidden p-0">
        {recordsQuery.isPending ? (
          <SectionLoader label="正在读取搜索记录…" />
        ) : recordsQuery.isError && !recordsQuery.data ? (
          <ErrorPanel error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />
        ) : recordsQuery.data!.items.length === 0 ? (
          <EmptyState icon={<Search />} text="没有符合条件的搜索记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[880px]">
              <thead>
                <tr>
                  <th>时间</th><th>搜索内容</th><th>类型</th><th>原唱</th><th>来源</th><th>结果</th><th>状态</th>
                </tr>
              </thead>
              <tbody>
                {recordsQuery.data!.items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap text-slate-500">{formatDateTime(item.createdAt)}</td>
                    <td>
                      <p className="font-medium text-slate-200">{item.query}</p>
                      {item.artist ? <p className="mt-1 text-xs text-slate-500">歌手：{item.artist}</p> : null}
                    </td>
                    <td>{item.searchType === "artist" ? "歌手" : "歌曲"}</td>
                    <td>{item.originalPerformerStatus === "true" ? "包含" : item.originalPerformerStatus === "false" ? "不含" : "未知"}</td>
                    <td><SourceBadge source={item.source} /></td>
                    <td className="tabular-nums">{formatNumber(item.resultCount)}</td>
                    <td>{item.success ? <span className="text-teal-300">成功</span> : <span className="text-rose-300">失败</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {recordsQuery.data ? <Pagination page={recordsQuery.data.page} totalPages={recordsQuery.data.totalPages} total={recordsQuery.data.total} onChange={setPage} /> : null}
    </div>
  );
}

function RepositoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType | "">("");
  const [sort, setSort] = useState<"recent" | "reuse" | "results" | "size">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const repositoryQuery = useQuery({
    queryKey: ["admin-repository", page, query, searchType, sort],
    queryFn: () => fetchAdminRepository({ page, query: query || undefined, searchType: searchType || undefined, sort }),
    refetchOnWindowFocus: true,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminRepository,
    onSuccess: async () => {
      setConfirmDelete(false);
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-repository"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
    },
  });
  const cleanupPreviewQuery = useQuery({
    queryKey: ["admin-repository-cleanup-preview"],
    queryFn: fetchAdminCleanupPreview,
    enabled: false,
    retry: false,
  });
  const cleanupMutation = useMutation({
    mutationFn: runAdminCleanup,
    onSuccess: async () => {
      setConfirmCleanup(false);
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-repository"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
      await cleanupPreviewQuery.refetch();
    },
  });

  useEffect(() => setSelected(new Set()), [page, query, searchType, sort]);

  const items = repositoryQuery.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const submitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  };
  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={submitFilter} className="flex min-w-0 flex-1 flex-wrap gap-2">
          <SearchField value={draftQuery} onChange={setDraftQuery} placeholder="搜索已保存的查询" />
          <select value={searchType} onChange={(event) => { setSearchType(event.target.value as SearchType | ""); setPage(1); }} className="admin-select" aria-label="类型筛选">
            <option value="">全部类型</option><option value="song">歌曲</option><option value="artist">歌手</option>
          </select>
          <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} className="admin-select" aria-label="排序">
            <option value="recent">最近使用</option><option value="reuse">复用次数</option><option value="results">结果数量</option><option value="size">占用空间</option>
          </select>
          <button type="submit" className="admin-primary-button">筛选</button>
        </form>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />删除所选{selected.size ? `（${selected.size}）` : ""}
        </button>
      </div>

      {deleteMutation.isError ? <p className="text-sm text-rose-300" role="alert">{errorMessage(deleteMutation.error)}</p> : null}
      {repositoryQuery.data ? (
        <DataFreshness
          updatedAt={repositoryQuery.data.updatedAt}
          fetching={repositoryQuery.isFetching}
          error={repositoryQuery.isError ? repositoryQuery.error : null}
        />
      ) : null}
      <StorageCleanupPanel
        preview={cleanupPreviewQuery.data}
        previewPending={cleanupPreviewQuery.isFetching}
        previewError={cleanupPreviewQuery.error}
        cleanupPending={cleanupMutation.isPending}
        cleanupError={cleanupMutation.error}
        cleanupMessage={cleanupMutation.data?.message}
        onPreview={() => cleanupPreviewQuery.refetch()}
        onCleanup={() => setConfirmCleanup(true)}
      />
      <Panel className="overflow-hidden p-0">
        {repositoryQuery.isPending ? (
          <SectionLoader label="正在读取资料库…" />
        ) : repositoryQuery.isError && !repositoryQuery.data ? (
          <ErrorPanel error={repositoryQuery.error} onRetry={() => repositoryQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Database />} text="资料库中还没有符合条件的记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th className="w-12">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))} aria-label="选择本页全部记录" />
                  </th>
                  <th>查询</th><th>类型</th><th>结果</th><th>复用</th><th>大小</th><th>最近使用</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <RepositoryRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {repositoryQuery.data ? <Pagination page={repositoryQuery.data.page} totalPages={repositoryQuery.data.totalPages} total={repositoryQuery.data.total} onChange={setPage} /> : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`删除 ${selected.size} 条资料？`}
        body="删除后，这些查询的持久结果与对应加速缓存都会移除；下一次搜索可能重新调用外部 API。"
        confirmLabel={deleteMutation.isPending ? "删除中…" : "确认删除"}
        appearance="dark"
        destructive
        onCancel={() => !deleteMutation.isPending && setConfirmDelete(false)}
        onConfirm={() => !deleteMutation.isPending && deleteMutation.mutate([...selected])}
      />
      <ConfirmDialog
        open={confirmCleanup}
        title={`执行本批存储清理？`}
        body={cleanupConfirmationBody(cleanupPreviewQuery.data)}
        confirmLabel={cleanupMutation.isPending ? "清理中…" : "确认执行"}
        appearance="dark"
        destructive
        onCancel={() => !cleanupMutation.isPending && setConfirmCleanup(false)}
        onConfirm={() => !cleanupMutation.isPending && cleanupMutation.mutate()}
      />
    </div>
  );
}

function RepositoryRow({ item, selected, onToggle }: { item: AdminRepositoryItem; selected: boolean; onToggle: () => void }) {
  return (
    <tr className={selected ? "bg-teal-300/[0.04]" : ""}>
      <td><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${item.query}`} /></td>
      <td className="max-w-md">
        <p className="truncate font-medium text-slate-200">{item.query}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{item.artist ? `${item.artist} · ` : ""}{item.normalizedQuery}</p>
        {item.previewResults.length > 0 ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-teal-300/80 hover:text-teal-200">查看结果预览</summary>
            <ul className="mt-2 space-y-1.5 text-slate-500">
              {item.previewResults.map((result) => (
                <li key={result.videoId} className="truncate">{result.title}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </td>
      <td>{item.searchType === "artist" ? "歌手" : "歌曲"}{item.includeOriginalVocal ? " · 含原唱" : ""}</td>
      <td className="tabular-nums">{formatNumber(item.resultCount)}</td>
      <td className="tabular-nums text-teal-300">{formatNumber(item.accessCount)}</td>
      <td className="tabular-nums">{formatBytes(item.approxBytes)}</td>
      <td className="whitespace-nowrap text-slate-500">{formatDateTime(item.lastAccessedAt)}</td>
    </tr>
  );
}

function StorageCleanupPanel({
  preview,
  previewPending,
  previewError,
  cleanupPending,
  cleanupError,
  cleanupMessage,
  onPreview,
  onCleanup,
}: {
  preview: AdminCleanupPreview | undefined;
  previewPending: boolean;
  previewError: unknown;
  cleanupPending: boolean;
  cleanupError: unknown;
  cleanupMessage: string | undefined;
  onPreview: () => void;
  onCleanup: () => void;
}) {
  return (
    <Panel className="border-amber-300/10 bg-amber-300/[0.025]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-100">存储压力清理</h2>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            仅在已配置容量且达到预警线时，按低复用、最久未用、最早创建的顺序生成有限批次；不会自动执行。
          </p>
        </div>
        <button
          type="button"
          disabled={previewPending || cleanupPending}
          onClick={onPreview}
          className="admin-secondary-button"
        >
          {previewPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {preview ? "重新预览" : "预览清理"}
        </button>
      </div>

      {previewError ? <p className="mt-4 text-sm text-rose-300" role="alert">{errorMessage(previewError)}</p> : null}
      {cleanupError ? <p className="mt-4 text-sm text-rose-300" role="alert">{errorMessage(cleanupError)}</p> : null}
      {cleanupMessage ? <p className="mt-4 text-sm text-teal-300" role="status">{cleanupMessage}</p> : null}

      {preview ? (
        <div className="mt-4 rounded-xl border border-white/8 bg-slate-950/35 p-4">
          <p className="text-xs leading-5 text-slate-400">{preview.policy}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            当前体积来源：{storageUsageSourceLabel(preview.usageSource)}
            {preview.measuredAt ? ` · ${formatDateTime(preview.measuredAt)}` : ""}
            {preview.stale ? " · 已过期" : ""}
            {" · "}
            容量来源：{preview.capacitySource === "operator-config" ? "运维配置" : "暂时无法获取"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="当前容量" value={preview.capacityPercentage === null ? "未知" : `${preview.capacityPercentage.toFixed(1)}%`} />
            <Metric label="预警线" value={preview.thresholdPercentage === null ? "未配置" : `${preview.thresholdPercentage}%`} />
            <Metric label="目标" value={preview.targetPercentage === null ? "未配置" : `${preview.targetPercentage}%`} />
            <Metric label="本批候选" value={formatNumber(preview.candidates.length)} />
          </div>

          {preview.actionNeeded ? (
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/8 pt-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-300">
                  预计移除 {formatBytes(preview.estimatedBytesToRemove)}；候选：
                  {preview.candidates.slice(0, 5).map((candidate) => candidate.query).join("、")}
                  {preview.candidates.length > 5 ? ` 等 ${preview.candidates.length} 条` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">预览不会删除数据；执行时服务端会重新验证管理员身份并持有短期清理锁。</p>
              </div>
              <button
                type="button"
                disabled={cleanupPending}
                onClick={onCleanup}
                className="rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cleanupPending ? "清理中…" : "执行本批清理"}
              </button>
            </div>
          ) : (
            <p className="mt-4 border-t border-white/8 pt-4 text-sm text-slate-400">
              {cleanupUnavailableMessage(preview)}
            </p>
          )}

          {preview.recentRuns.length > 0 ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-xs font-medium text-slate-400">最近清理记录</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-500">
                {preview.recentRuns.slice(0, 3).map((run) => (
                  <li key={run.id} className="flex flex-wrap justify-between gap-2">
                    <span>{cleanupRunLabel(run.result)} · {run.affectedCount} 条{run.message ? ` · ${run.message}` : ""}</span>
                    <time dateTime={run.createdAt}>{formatDateTime(run.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function cleanupUnavailableMessage(preview: AdminCleanupPreview) {
  return {
    capacity_unknown: "数据库总容量未知，系统不会显示虚假百分比，也不会执行清理。",
    measurement_unavailable: "Cloudflare D1 API 暂时无法提供实际体积，系统不会执行清理。",
    measurement_stale: "Cloudflare D1 实际体积已经过期；刷新成功前不会执行清理。",
    policy_incomplete: "请先在 Worker 配置容量、预警线和清理目标。",
    policy_invalid: "清理目标必须低于预警线，请修正部署配置。",
    below_threshold: "当前容量低于预警线，无需清理。",
    repository_empty: "持久资料库为空，无需清理。",
  }[preview.unavailableReason ?? "repository_empty"];
}

function cleanupConfirmationBody(preview: AdminCleanupPreview | undefined) {
  if (!preview || !preview.actionNeeded) {
    return "当前没有可执行的清理候选。";
  }

  return `系统将按已显示的保留策略删除本批 ${preview.candidates.length} 条低复用资料，并同步移除对应 KV 加速项。操作会写入审计记录；D1 物理容量统计可能延迟更新。`;
}

function cleanupRunLabel(result: AdminCleanupPreview["recentRuns"][number]["result"]) {
  return {
    success: "已达到目标",
    partial: "已完成本批",
    skipped: "未执行",
    failure: "执行失败",
  }[result];
}

function DataFreshness({
  updatedAt,
  fetching,
  error,
}: {
  updatedAt: string;
  fetching: boolean;
  error: unknown;
}) {
  if (error) {
    return (
      <p className="mt-2 text-xs text-amber-300" role="status">
        更新失败，继续显示 {formatDateTime(updatedAt)} 的最近成功数据。
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs text-slate-500" role="status">
      {fetching ? "正在更新…" : `更新于 ${formatDateTime(updatedAt)}`}
    </p>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-xl shadow-slate-950/10 ${className}`}>{children}</section>;
}

function RangeTabs({ value, onChange }: { value: AdminRange; onChange: (value: AdminRange) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-slate-950/50 p-1" aria-label="时间范围">
      {(["24h", "7d", "30d"] as const).map((range) => (
        <button key={range} type="button" onClick={() => onChange(range)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === range ? "bg-teal-300/15 text-teal-200" : "text-slate-500 hover:text-slate-300"}`}>
          {range === "24h" ? "24 小时" : range === "7d" ? "7 天" : "30 天"}
        </button>
      ))}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-[220px] flex-1 items-center rounded-xl border border-white/10 bg-slate-900/60 px-3 focus-within:border-teal-300/40">
      <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent px-2 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600" />
    </label>
  );
}

function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
      <span>共 {formatNumber(total)} 条</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="admin-page-button" aria-label="上一页"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-20 text-center tabular-nums">{page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="admin-page-button" aria-label="下一页"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: AdminResponseSource }) {
  const styles = {
    repository: "bg-teal-300/10 text-teal-200",
    external: "bg-violet-300/10 text-violet-200",
    mock: "bg-sky-300/10 text-sky-200",
    error: "bg-rose-300/10 text-rose-200",
  }[source];
  const label = { repository: "资料库", external: "外部 API", mock: "模拟", error: "错误" }[source];
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="px-2"><p className="text-lg font-semibold tabular-nums sm:text-xl">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>;
}

function EmptyChart() {
  return <div className="grid h-full place-items-center rounded-xl border border-dashed border-white/10 bg-slate-950/20 text-center"><div><Activity className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-2 text-sm text-slate-500">等待首批搜索数据</p></div></div>;
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="grid min-h-48 place-items-center p-6 text-center text-slate-500"><div><span className="mx-auto block w-fit [&>svg]:h-6 [&>svg]:w-6">{icon}</span><p className="mt-3 text-sm">{text}</p></div></div>;
}

function SectionLoader({ label }: { label: string }) {
  return <div className="grid min-h-48 place-items-center p-6 text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</span></div>;
}

function FullPageLoader() {
  return <main className="admin-surface grid min-h-screen place-items-center text-slate-400"><span className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-teal-300" />正在进入管理控制台…</span></main>;
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <div className="grid min-h-48 place-items-center p-6 text-center"><div><AlertTriangle className="mx-auto h-6 w-6 text-rose-300" /><p className="mt-3 text-sm text-slate-300">{errorMessage(error)}</p><button type="button" onClick={onRetry} className="mt-4 text-sm font-medium text-teal-300 hover:text-teal-200">重新加载</button></div></div>;
}

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    const remaining = Math.max(new Date(target).getTime() - now, 0);
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }, [now, target]);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Toronto", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    : "—";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatPercentage(value: number | null) {
  return value === null ? "未知" : `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function storageUsageSourceLabel(source: AdminStorageUsageSource) {
  return {
    "cloudflare-d1-api": "Cloudflare D1 API",
    "cloudflare-analytics": "Cloudflare Analytics",
    unavailable: "暂时无法获取",
  }[source];
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.status === 401 ? "登录已失效，请刷新页面后重新登录。" : error.message;
  }
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}
