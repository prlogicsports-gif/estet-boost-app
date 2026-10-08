import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { Calendar, type CalendarEvents } from "@/components/eb/calendar";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { events as seedEvents, pro } from "@/data/gestor-mock";

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

const longDate = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

function AgendaPage() {
  const { openNotifications, unread } = useShell();
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState("2026-09-01");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [events, setEvents] = useState<CalendarEvents>(seedEvents);
  const day = events[date] ?? [];

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const create = () => {
    setEvents((current) => ({
      ...current,
      [date]: [
        ...(current[date] ?? []),
        { time: "11:00", client: "Paula Andrade", status: "pending" },
      ],
    }));
    setOpen(false);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <TopBar
        title="Agenda"
        context="Setembro de 2026 · semana 36"
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Icon name="Plus" size={15} /> Novo agendamento
          </Button>
        }
      />
      <SegmentedTabs
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
        year={2026}
        month={8}
        selected={date}
        events={events}
        onSelectDate={(iso) => setDate(iso)}
        slots={["09:00", "11:00", "17:30"]}
      />

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          {longDate(date)}
        </span>
        {day.length ? (
          day.map((event, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <span className="w-[46px] font-mono text-[var(--nude-sand)]">{event.time}</span>
              <span className="flex-1">{event.client}</span>
              <StatusBadge tone={event.status} size="sm" />
            </div>
          ))
        ) : (
          <div className="py-2.5 text-[13px] text-muted-foreground">
            Nenhum atendimento neste dia. Horários livres: 09:00, 11:00, 17:30.
          </div>
        )}
        <AlertCard
          tone="tech"
          icon="CalendarPlus"
          title="1 solicitação de cliente"
          description="Paula Andrade pediu quinta, 15h"
          actionLabel="Revisar"
        />
        <AlertCard
          tone="info"
          icon="Lock"
          title="Bloqueio pessoal"
          description="Sexta, 04 set · 10:30–12:00"
          actionLabel="Editar"
        />
      </section>

      <ToastHost
        toast={saved ? { message: "Agendamento criado", detail: "Paula Andrade · 11:00" } : null}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Novo agendamento"
        subtitle={longDate(date)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="tech" className="flex-1" onClick={create}>
              <Icon name="Check" size={18} /> Confirmar agendamento
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Input
            label="Cliente"
            icon="Search"
            placeholder="Buscar ou criar cliente"
            defaultValue="Paula Andrade"
          />
          <Input label="Procedimento" defaultValue="Limpeza de pele profunda" />
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Data" type="date" defaultValue={date} />
            <Input label="Horário" type="time" defaultValue="11:00" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Duração" trailing="min" defaultValue="60" />
            <Input label="Valor" trailing="R$" defaultValue="180" />
          </div>
          <Input label="Forma de pagamento prevista" defaultValue="Pix" />
          <Input
            label="Observação"
            multiline
            rows={3}
            placeholder="Algo que você precisa lembrar?"
          />
          <label className="flex min-h-11 items-center gap-2.5 text-[13.5px] text-[var(--text-secondary)]">
            <input type="checkbox" defaultChecked className="size-[18px] accent-[var(--teal)]" />
            Enviar confirmação para a cliente
          </label>
        </div>
      </Drawer>
    </div>
  );
}
