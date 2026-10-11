import { completeActivityText } from "@/lib/activity-text";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { activityDb } from "@/data/db";
import { relativeDay } from "@/lib/dates";
import type { ActivityRec } from "@/lib/models";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { usePro } from "@/lib/use-pro";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_gestor/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de eventos — EstetBoost." },
      {
        name: "description",
        content: "Tudo o que as clientes e a equipe fizeram, do mais recente ao mais antigo.",
      },
    ],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const pro = usePro();
  const { openNotifications, unread } = useShell();
  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Histórico de eventos"
        context="O que aconteceu na clínica"
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
      />
      <ActivityList />
    </div>
  );
}

const ACTIVITY_FILTERS: { id: "todos" | ActivityRec["kind"]; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "horario", label: "Horários" },
  { id: "pagamento", label: "Pagamentos" },
  { id: "cadastro", label: "Cadastros" },
  { id: "atendimento", label: "Atendimentos" },
];
const ACTIVITY_ICON: Record<ActivityRec["kind"], string> = {
  horario: "CalendarClock",
  pagamento: "Wallet",
  cadastro: "UserPlus",
  atendimento: "Sparkles",
};

/** Tudo o que as clientes (e você) fizeram, do mais recente ao mais antigo. */
function ActivityList() {
  const session = useSession();
  const list = activityDb
    .use()
    .filter((item) => item.kind !== "pagamento" || can(session, "financeiro"));
  const [filter, setFilter] = useState<"todos" | ActivityRec["kind"]>("todos");
  const [who, setWho] = useState<"todos" | ActivityRec["by"]>("todos");
  const shown = list.filter(
    (item) => (filter === "todos" || item.kind === filter) && (who === "todos" || item.by === who),
  );
  const groups: { day: string; items: ActivityRec[] }[] = [];
  for (const item of shown) {
    const day = item.at.slice(0, 10);
    const group = groups.find((entry) => entry.day === day);
    if (group) group.items.push(item);
    else groups.push({ day, items: [item] });
  }
  const chip = (on: boolean) =>
    cn(
      "min-h-11 flex-none whitespace-nowrap rounded-full border px-[13px] text-[12.5px]",
      on
        ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
        : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {ACTIVITY_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={chip(filter === item.id)}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="mx-1 w-px flex-none bg-[var(--border-hairline)]" />
        {(["todos", "cliente", "gestor"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={chip(who === item)}
            onClick={() => setWho(item)}
          >
            {item === "todos"
              ? "Todos"
              : item === "cliente"
                ? "Feito pelas clientes"
                : "Feito por mim"}
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <div key={group.day} className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            {relativeDay(group.day)}
          </span>
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <span className="grid size-8 flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)] text-[var(--eb-nude-300)]">
                <Icon name={ACTIVITY_ICON[item.kind]} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px]">
                  <span className="font-medium">{item.client}</span> ·{" "}
                  {completeActivityText(item.text)}
                </div>
                <div className="font-mono text-[11.5px] text-muted-foreground">
                  {new Date(item.at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {item.by === "cliente" ? "pela cliente" : "por você"}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      {!shown.length ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-5 text-[13px] text-muted-foreground">
          Os pedidos de horário, confirmações, pagamentos informados, cadastros e atendimentos
          aparecem aqui conforme acontecem.
        </p>
      ) : null}
    </div>
  );
}
