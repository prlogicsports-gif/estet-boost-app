import type { ReactNode } from "react";

import { Icon } from "@/components/eb/icon";

export function EmptyState({
  icon = "Inbox",
  title,
  description,
  action,
  compact,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] text-center"
      style={{ padding: compact ? "24px 18px" : "44px 24px" }}
    >
      <span className="grid size-[46px] place-items-center rounded-full bg-[var(--eb-nude-a08)] text-[var(--eb-nude-500)]">
        <Icon name={icon} size={21} />
      </span>
      <h3 className="text-[17px] font-medium">{title}</h3>
      {description ? (
        <p className="max-w-[34ch] text-[13.5px] text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
