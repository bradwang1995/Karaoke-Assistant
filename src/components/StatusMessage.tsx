import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type StatusTone = "info" | "success" | "warning" | "error" | "loading";

interface StatusMessageProps {
  tone?: StatusTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<StatusTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  loading: "border-slate-200 bg-slate-50 text-slate-700",
};

const iconClasses: Record<StatusTone, string> = {
  info: "text-sky-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-rose-600",
  loading: "text-slate-500",
};

export function StatusMessage({
  tone = "info",
  title,
  children,
  className = "",
}: StatusMessageProps) {
  const Icon = getIcon(tone);

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[tone]} ${className}`}>
      <div className="flex gap-2">
        <Icon
          size={17}
          className={`mt-0.5 shrink-0 ${tone === "loading" ? "animate-spin" : ""} ${
            iconClasses[tone]
          }`}
        />
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={title ? "mt-0.5" : ""}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function getIcon(tone: StatusTone) {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning" || tone === "error") return AlertTriangle;
  if (tone === "loading") return Loader2;
  return Info;
}
