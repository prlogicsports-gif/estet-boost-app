import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BlockTimeDrawer } from "@/components/agenda/block-time-drawer";
import { NewAppointmentDrawer } from "@/components/agenda/new-appointment-drawer";
import { Calendar } from "@/components/eb/calendar";
import { Icon } from "@/components/eb/icon";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { appointmentsDb, blocksDb } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { addDays, formatWeekday, todayISO } from "@/lib/dates";
import { byDateTime, eventsFrom } from "@/lib/view";
import {
  approveCancel,
  approveRequest,
  approveReschedule,
  declineRequest,
  declineReschedule,
} from "@/services/appointments.service";
import { useClinicAppointments } from "@/lib/use-clinic";

export const Route = createFileRoute("/_gestor/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — EstetBoost." },
      {
        name: "description",
        content: "Organize horários, confirmações e retornos das suas clientes.",
      },
      { property: "og:title", content: "Agenda — EstetBoost." },
      {
        property: "og:description",
        content: "Organize horários, confirmações e retornos das suas clientes.",
      },
    ],
  }),
  component: AgendaPage,
});

type View = "day" | "week" | "month";

/** Segunda-feira da semana de uma data. */
const weekStart = (iso: string) => {
  const offset = (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
  return addDays(iso, -offset);
};

function AgendaPage() {
  const pro = usePro();
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(todayISO());
  const [cursor, setCursor] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockEdit, setBlockEdit] = useState<string | null>(null);
  const allBlocks = blocksDb.use();
  const [toast, setToast] = useState<{ message: string; detail?: string } | null>(null);
  const all = useClinicAppointments();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const live = useMemo(
    () => all.filter((item) => item.status !== "cancelled" || item.date === date),
    [all, date],
  );
  const events = useMemo(() => {
    const full = eventsFrom(live);
    if (view === "month") return full;
    const days =
      view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));
    return Object.fromEntries(days.map((day) => [day, full[day] ?? []]));
  }, [live, view, date]);

  const day = all.filter((item) => item.date === date).sort(byDateTime);
  const requests = all
    .filter(
      (item) =>
        item.status === "pending" && (item.request || item.reschedule || item.cancelRequest),
    )
    .sort(byDateTime);

  const navigateMonth = (step: -1 | 1) =>
    setCursor((current) => {
      const next = new Date(current.year, current.month + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const pick = (iso: string) => {
    setDate(iso);
    const parsed = new Date(`${iso}T12:00:00`);
    setCursor({ year: parsed.getFullYear(), month: parsed.getMonth() });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <TopBar
        title="Agenda"
        context={`${new Date(cursor.year, cursor.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Icon name="Plus" size={15} /> Novo agendamento
          </Button>
        }
      />
      <SegmentedTabs<View>
        active={view}
        onSelect={setView}
        tabs={[
          { id: "day", label: "Dia" },
          { id: "week", label: "Semana" },
          { id: "month", label: "Mês" },
        ]}
      />
      <Calendar
        view={view}
        year={cursor.year}
        month={cursor.month}
        selected={date}
        events={events}
        onNavigate={navigateMonth}
        onSelectDate={(iso) => pick(iso)}
        onSelectEvent={(event) => {
          const found = all.find(
            (item) =>
              item.date === date && item.time === event.time && item.client === event.client,
          );
          if (found)
            navigate({ to: "/atendimentos/$appointmentId", params: { appointmentId: found.id } });
        }}
        slots={["09:00", "11:00", "17:30"]}
      />

      {requests.length ? (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            Pedidos das clientes · {requests.length}
          </span>
          {requests.map((item) => {
            const title = item.request
              ? "Solicitação de horário"
              : item.reschedule
                ? "Pedido de remarcação"
                : "Pedido de cancelamento";
            const detail = item.request
              ? `${item.client} · ${formatWeekday(item.date)} · ${item.time}`
              : item.reschedule
                ? `${item.client} quer ${item.proposedDate ? formatWeekday(item.proposedDate) : ""} · ${item.proposedTime ?? ""}`
                : `${item.client} · ${formatWeekday(item.date)} · ${item.time}`;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--eb-teal-a24)] bg-[var(--eb-teal-a12)] p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    name={item.request ? "CalendarPlus" : "CalendarClock"}
                    size={16}
                    color="var(--eb-teal-500)"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{title}</div>
                    <div className="text-[12.5px] text-[var(--text-secondary)]">{detail}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="tech"
                    onClick={() => {
                      if (item.request) approveRequest(item.id);
                      else if (item.reschedule) approveReschedule(item.id);
                      else approveCancel(item.id);
                      setToast({
                        message: item.cancelRequest ? "Cancelamento aprovado" : "Aprovado",
                        detail: `${item.client} foi avisada`,
                      });
                    }}
                  >
                    <Icon name="Check" size={15} /> Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (item.request) declineRequest(item.id);
                      else if (item.reschedule) declineReschedule(item.id);
                      else
                        appointmentsDb.set((list) =>
                          list.map((x) => (x.id === item.id ? { ...x, cancelRequest: false } : x)),
                        );
                      setToast({
                        message: "Pedido recusado",
                        detail: `${item.client} foi avisada`,
                      });
                    }}
                  >
                    Recusar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate({
                        to: "/atendimentos/$appointmentId",
                        params: { appointmentId: item.id },
                      })
                    }
                  >
                    Detalhes
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          {formatWeekday(date)}
        </span>
        {day.length ? (
          day.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                navigate({ to: "/atendimentos/$appointmentId", params: { appointmentId: item.id } })
              }
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3 text-left"
            >
              <span className="w-[46px] font-mono text-[var(--nude-sand)]">{item.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.client}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.procedure}
                </span>
              </span>
              <StatusBadge
                tone={item.status}
                size="sm"
                {...(item.done ? { icon: "CheckCheck" } : {})}
              >
                {item.done ? "Concluído" : undefined}
              </StatusBadge>
            </button>
          ))
        ) : (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-5 text-[13px] text-muted-foreground">
            Nenhum atendimento neste dia.{" "}
            <button
              type="button"
              className="text-[var(--teal)] underline-offset-4 hover:underline"
              onClick={() => setOpen(true)}
            >
              Agendar um horário
            </button>
          </div>
        )}
        {allBlocks
          .filter((item) => item.date === date)
          .sort((x, y) => x.start.localeCompare(y.start))
          .map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => {
                setBlockEdit(block.id);
                setBlockOpen(true);
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-3.5 py-2.5 text-left"
            >
              <Icon name="Lock" size={16} color="var(--eb-nude-300)" />
              <span className="font-mono text-[13px] text-[var(--text-secondary)]">
                {block.start <= "00:00" && block.end >= "23:59"
                  ? "Dia todo"
                  : `${block.start}–${block.end}`}
              </span>
              <span className="min-w-0 flex-1 break-words text-[13.5px]">
                {block.reason || "Bloqueado"}
              </span>
              <Icon name="PencilLine" size={15} color="var(--eb-nude-300)" />
            </button>
          ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            setBlockEdit(null);
            setBlockOpen(true);
          }}
        >
          <Icon name="Lock" size={15} /> Bloquear horários
        </Button>
      </section>

      <ToastHost toast={toast} />

      <BlockTimeDrawer
        open={blockOpen}
        initialDate={date}
        editId={blockEdit}
        onClose={(message) => {
          setBlockOpen(false);
          setBlockEdit(null);
          if (message) setToast({ message });
        }}
      />

      <NewAppointmentDrawer
        open={open}
        date={date}
        onClose={() => setOpen(false)}
        onCreated={(rec) => {
          setOpen(false);
          pick(rec.date);
          setToast({ message: "Agendamento criado", detail: `${rec.client} · ${rec.time}` });
        }}
      />
    </div>
  );
}
