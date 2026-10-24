import { translate as t, useLanguage } from "../i18n";
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  appearance?: "light" | "dark";
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = t("确定"),
  cancelLabel = t("取消"),
  destructive = false,
  appearance = "light",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useLanguage();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4">
      <div
        className={`w-full max-w-sm rounded-xl border p-4 shadow-xl ${
          appearance === "dark"
            ? "border-white/10 bg-slate-900 text-white"
            : "border-transparent bg-white text-slate-950"
        }`}
      >
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        {body ? (
          <p
            className={`mt-2 line-clamp-3 text-sm ${
              appearance === "dark" ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {body}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
              appearance === "dark"
                ? "border-white/15 text-slate-200 hover:bg-white/10"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white transition ${
              destructive
                ? "bg-rose-600 hover:bg-rose-500"
                : appearance === "dark"
                  ? "bg-teal-400 text-slate-950 hover:bg-teal-300"
                  : "bg-slate-950 hover:bg-slate-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
