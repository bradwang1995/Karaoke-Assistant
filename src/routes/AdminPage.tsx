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
  fetchAdminOverview,
  fetchAdminRepository,
  fetchAdminSearches,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
} from "../lib/adminApi";
import { ApiClientError } from "../lib/apiClient";
import type {
  AdminOverview,
  AdminRange,
  AdminRepositoryItem,
  AdminResponseSource,
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

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0]);
        return key === "admin-overview" || key === "admin-searches" || key === "admin-repository";
      },
    });

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
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-teal-300/30 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${fetchingCount ? "animate-spin" : ""}`} aria-hidden="true" />
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
  if (overviewQuery.isError) {
    return <ErrorPanel error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />;
  }

  const data = overviewQuery.data;
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
          <p className="mt-2 text-xs text-slate-500">更新于 {formatDateTime(data.updatedAt)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QuotaCard data={data} />
        <RepositorySummary data={data} />
      </div>

      <Panel className="min-h-[260px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">用户搜索趋势</h3>
            <p className="mt-1 text-xs text-slate-500">资料库命中与外部 API 请求</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <LegendDot color="bg-teal-300" label="资料库命中" />
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
                <Area type="monotone" dataKey="repositoryHits" name="资料库命中" stroke="#5eead4" fill="url(#repository-fill)" strokeWidth={2} />
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
          label="容量状态"
          value={
            data.repository.capacityPercentage === null
              ? "未知"
              : `${Math.round(data.repository.capacityPercentage)}%`
          }
        />
      </div>
      <p className="mt-5 border-t border-white/10 pt-3 text-xs text-slate-500">
        {data.repository.databaseBytes === null
          ? "当前运行时未返回数据库实际体积。"
          : `数据库约 ${formatBytes(data.repository.databaseBytes)} · 歌曲 ${formatNumber(data.repository.uniqueSongs)} · 歌手 ${formatNumber(data.repository.uniqueArtists)}`}
      </p>
    </Panel>
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
  const storageNotice = data.repository.storagePressure
    ? {
        icon: AlertTriangle,
        color: "text-rose-300 bg-rose-300/10",
        title: "资料库达到容量预警线",
        body: `当前 ${Math.round(data.repository.capacityPercentage ?? 0)}%，预警线 ${data.repository.warningThresholdPercentage}%。`,
      }
    : data.repository.capacityPercentage !== null
      ? {
          icon: CheckCircle2,
          color: "text-teal-300 bg-teal-300/10",
          title: "资料库容量正常",
          body:
            data.repository.warningThresholdPercentage === null
              ? "已知容量，但尚未配置清理预警线。"
              : `当前 ${Math.round(data.repository.capacityPercentage)}%，低于 ${data.repository.warningThresholdPercentage}% 预警线。`,
        }
      : {
          icon: AlertTriangle,
          color: "text-amber-300 bg-amber-300/10",
          title: "资料库容量未知",
          body: "已显示数据库实际体积；容量上限需按 Cloudflare 计划单独配置。",
        };
  const notices = [
    storageNotice,
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
    {
      icon: HardDrive,
      color: "text-sky-300 bg-sky-300/10",
      title: "持久资料库已启用",
      body: `已保存 ${formatNumber(data.repository.totalQueries)} 个精确查询。`,
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

      <Panel className="overflow-hidden p-0">
        {recordsQuery.isPending ? (
          <SectionLoader label="正在读取搜索记录…" />
        ) : recordsQuery.isError ? (
          <ErrorPanel error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />
        ) : recordsQuery.data.items.length === 0 ? (
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
                {recordsQuery.data.items.map((item) => (
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
      <Panel className="overflow-hidden p-0">
        {repositoryQuery.isPending ? (
          <SectionLoader label="正在读取资料库…" />
        ) : repositoryQuery.isError ? (
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

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.status === 401 ? "登录已失效，请刷新页面后重新登录。" : error.message;
  }
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}
