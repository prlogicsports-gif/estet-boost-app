import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Icon } from "@/components/eb/icon";
import { NOTIFICATION_KINDS } from "@/components/eb/notification-center";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { defaultPrefs, prefsDb } from "@/data/db";
import { relativeDay, timeAgo, toISO } from "@/lib/dates";
import type { Audience, NotificationPrefs, NotificationRec } from "@/lib/models";
import { markAllRead, markRead, setPrefs } from "@/services/notify";
import { pushStatus, registerPush } from "@/services/push.service";
import { cn } from "@/lib/utils";

type Filter = "todas" | "novas";

const PREF_ROWS: Record<
  Audience,
  { key: keyof NotificationPrefs; title: string; detail: string }[]
> = {
  gestor: [
    {
      key: "appointments",
      title: "Atendimentos",
      detail: "Quem não confirmou e o próximo da fila",
    },
    {
      key: "payments",
      title: "Contas e cobranças",
      detail: "Todo dia, de 3 dias antes até o vencimento",
    },
    { key: "stock", title: "Estoque", detail: "Produto abaixo do mínimo" },
    {
      key: "push",
      title: "Notificações no aparelho",
      detail: "Push, quando o app estiver instalado",
    },
  ],
  cliente: [
    { key: "appointments", title: "Lembretes de atendimento", detail: "24 horas antes e no dia" },
    {
      key: "recommendations",
      title: "Produtos e cuidados",
      detail: "No horário que a esteticista indicou",
    },
    { key: "payments", title: "Pagamentos", detail: "Todo dia, de 3 dias antes até o vencimento" },
    {
      key: "push",
      title: "Notificações no aparelho",
      detail: "Push, quando o app estiver instalado",
    },
    { key: "whatsapp", title: "Avisos por WhatsApp", detail: "Confirmações e mudanças de horário" },
  ],
};

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative h-7 w-12 flex-none rounded-full border border-[var(--border-card)] transition-colors"
      style={{ background: checked ? "var(--eb-teal-500)" : "var(--eb-ivory-a10)" }}
    >
      <span
        className="absolute left-0.5 top-0.5 size-[22px] rounded-full bg-[var(--eb-ivory-100)] transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "none" }}
      />
    </button>
  );
}

/** Preferências de aviso: guardadas no aparelho; o banco depois só troca onde elas ficam. */
export function NotificationPrefsEditor({ audience }: { audience: Audience }) {
  const prefs = { ...defaultPrefs, ...prefsDb.use()[audience] };
  return (
    <div className="flex flex-col gap-2">
      {PREF_ROWS[audience].map((row) => (
        <div
          key={row.key}
          className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{row.title}</span>
            <span className="block text-[11.5px] text-muted-foreground">{row.detail}</span>
          </span>
          <Switch
            checked={prefs[row.key]}
            onChange={async () => {
              const next = !prefs[row.key];
              setPrefs(audience, { [row.key]: next });
              if (row.key === "push" && next && pushStatus() === "default") await registerPush();
            }}
            label={row.title}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Central de notificações: filtro por não lidas, agrupada por dia, com leitura item a
 * item e atalho para a tela de cada aviso. Pensada para o celular (alvos de 44px) e
 * igual no desktop.
 */
export function NotificationsPanel({
  items,
  audience,
  clientId,
  onOpen,
}: {
  items: NotificationRec[];
  audience: Audience;
  clientId?: string | undefined;
  onOpen: (href: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [showPrefs, setShowPrefs] = useState(false);
  const unread = items.filter((item) => !item.read).length;
  const visible = filter === "novas" ? items.filter((item) => !item.read) : items;

  const groups = useMemo(() => {
    const map = new Map<string, NotificationRec[]>();
    for (const item of visible) {
      const label = relativeDay(toISO(new Date(item.createdAt)));
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <SegmentedTabs<Filter>
          size="sm"
          active={filter}
          onSelect={setFilter}
          tabs={[
            { id: "todas", label: "Todas" },
            { id: "novas", label: unread ? `Não lidas · ${unread}` : "Não lidas" },
          ]}
          className="flex-1"
        />
        <button
          type="button"
          disabled={!unread}
          onClick={() => markAllRead(audience, clientId)}
          className="min-h-11 flex-none whitespace-nowrap px-1 text-[12.5px] text-[var(--teal)] disabled:text-muted-foreground"
        >
          Marcar tudo como lido
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-5 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-[var(--eb-nude-a08)] text-[var(--eb-nude-500)]">
            <Icon name="Bell" size={20} />
          </span>
          <div className="text-[15px] font-medium">
            {filter === "novas" ? "Tudo em dia" : "Nada por aqui ainda"}
          </div>
          <p className="max-w-[30ch] text-[13px] text-[var(--text-secondary)]">
            {filter === "novas"
              ? "Você leu todos os avisos."
              : "Lembretes, confirmações e avisos aparecem aqui."}
          </p>
        </div>
      ) : (
        groups.map(([label, list]) => (
          <section key={label} className="flex flex-col gap-1.5">
            <span className="px-0.5 text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            {list.map((item) => {
              const kind = NOTIFICATION_KINDS[item.kind] ?? NOTIFICATION_KINDS.reminder;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markRead(item.id);
                    if (item.href) onOpen(item.href);
                  }}
                  className={cn(
                    "flex min-h-[68px] w-full items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors active:bg-[var(--eb-ivory-a10)]",
                    item.read
                      ? "border-[var(--border-hairline)] bg-transparent"
                      : "border-[var(--border-card)] bg-[var(--eb-ivory-a06)]",
                  )}
                >
                  <span
                    className="grid size-10 flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)]"
                    style={{ color: kind.fg }}
                  >
                    <Icon name={kind.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[14px] leading-[1.3]"
                      style={{ fontWeight: item.read ? 400 : 500 }}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-[1.4] text-[var(--text-secondary)]">
                      {item.body}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1.5">
                    <span className="text-[11.5px] text-muted-foreground">
                      {timeAgo(item.createdAt)}
                    </span>
                    {item.read ? null : (
                      <span
                        className="size-2 rounded-full bg-[var(--eb-teal-500)]"
                        aria-label="Não lida"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </section>
        ))
      )}

      <div className="border-t border-[var(--border-hairline)] pt-3">
        <button
          type="button"
          onClick={() => setShowPrefs((value) => !value)}
          aria-expanded={showPrefs}
          className="flex min-h-12 w-full items-center gap-2.5 text-left"
        >
          <Icon name="Settings" size={17} color="var(--eb-nude-300)" />
          <span className="flex-1 text-sm">Preferências de aviso</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              showPrefs && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {showPrefs ? (
          <div className="mt-2">
            <NotificationPrefsEditor audience={audience} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
