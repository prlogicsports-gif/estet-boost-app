import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/eb/icon";

/** Status nunca depende só da cor: cada tom leva ícone e palavra. */
export type StatusTone = "confirmed" | "pending" | "cancelled" | "neutral" | "info";

const tones: Record<StatusTone, { fg: string; bg: string; icon: string; label: string }> = {
  confirmed: {
    fg: "var(--status-confirmed)",
    bg: "var(--status-confirmed-bg)",
    icon: "Check",
    label: "Confirmado",
  },
  pending: {
    fg: "var(--status-pending)",
    bg: "var(--status-pending-bg)",
    icon: "Clock",
    label: "Aguardando",
  },
  cancelled: {
    fg: "var(--status-cancelled)",
    bg: "var(--status-cancelled-bg)",
    icon: "X",
    label: "Cancelado",
  },
  neutral: {
    fg: "var(--text-secondary)",
    bg: "var(--status-neutral-bg)",
    icon: "Minus",
    label: "Livre",
  },
  info: { fg: "var(--eb-nude-500)", bg: "var(--eb-nude-a16)", icon: "Info", label: "Informação" },
};

export function StatusBadge({
  tone = "neutral",
  children,
  size = "md",
  icon,
  style,
}: {
  tone?: StatusTone;
  children?: ReactNode;
  size?: "sm" | "md";
  icon?: string;
  style?: CSSProperties;
}) {
  const t = tones[tone] ?? tones.neutral;
  const sm = size === "sm";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full font-medium tracking-[0.01em]"
      style={{
        gap: sm ? 4 : 6,
        height: sm ? 22 : 28,
        padding: sm ? "0 8px" : "0 11px",
        fontSize: sm ? 11 : 12.5,
        background: t.bg,
        color: t.fg,
        ...style,
      }}
    >
      <Icon name={icon ?? t.icon} size={sm ? 11 : 13} strokeWidth={2} />
      {children ?? t.label}
    </span>
  );
}
