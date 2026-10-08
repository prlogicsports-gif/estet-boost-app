import { Icon } from "@/components/eb/icon";

const tones = {
  success: { icon: "Check", color: "var(--eb-teal-500)" },
  error: { icon: "AlertTriangle", color: "var(--eb-coral-500)" },
  info: { icon: "Info", color: "var(--eb-nude-500)" },
} as const;

export function Toast({
  tone = "success",
  message,
  detail,
}: {
  tone?: keyof typeof tones;
  message: string;
  detail?: string;
}) {
  const t = tones[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-[260px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-3.5 py-3 backdrop-blur-[18px]"
      style={{
        boxShadow: "var(--glass-shadow), var(--glass-highlight)",
        animation: "fade-up 200ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      <Icon name={t.icon} size={17} color={t.color} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{message}</div>
        {detail ? <div className="text-xs text-[var(--text-secondary)]">{detail}</div> : null}
      </div>
    </div>
  );
}

/** Aviso fixo acima do dock, centralizado. */
export function ToastHost({
  toast,
}: {
  toast: { message: string; detail?: string; tone?: keyof typeof tones } | null;
}) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-28 left-1/2 z-[80] -translate-x-1/2">
      <Toast {...toast} />
    </div>
  );
}
