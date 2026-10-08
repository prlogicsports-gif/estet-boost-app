import type { ReactNode } from "react";

import { IconButton } from "@/components/eb/icon-button";

export function TopBar({
  title,
  context,
  actions,
  notifications = 0,
  user,
  onNotifications,
}: {
  title: string;
  context?: string;
  actions?: ReactNode;
  notifications?: number;
  user?: { name: string; initials: string };
  onNotifications?: () => void;
}) {
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-4 py-3">
      <div className="min-w-0 flex-[1_1_200px]">
        <h1 className="truncate text-[26px] font-medium leading-[1.2] tracking-[-0.015em]">
          {title}
        </h1>
        {context ? <p className="mt-0.5 text-[13px] text-muted-foreground">{context}</p> : null}
      </div>
      <div className="flex flex-none items-center gap-2">
        {actions}
        {onNotifications ? (
          <IconButton
            icon="Bell"
            label="Notificações"
            badge={notifications || undefined}
            onClick={onNotifications}
          />
        ) : null}
        {user ? (
          <span
            title={user.name}
            className="grid size-[38px] place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[13px] font-medium text-foreground"
          >
            {user.initials}
          </span>
        ) : null}
      </div>
    </header>
  );
}
