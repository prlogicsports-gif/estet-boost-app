import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { AppointmentCard } from "@/components/eb/appointment-card";
import { Icon } from "@/components/eb/icon";
import { MetricCard } from "@/components/eb/metric-card";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { appointments, pro, todayLabel } from "@/data/gestor-mock";

export const Route = createFileRoute("/_gestor/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — EstetBoost." },
      {
        name: "description",
        content: "Veja os atendimentos do dia e o que precisa da sua atenção agora.",
      },
      { property: "og:title", content: "Hoje — EstetBoost." },
      {
        property: "og:description",
        content: "Veja os atendimentos do dia e o que precisa da sua atenção agora.",
      },
    ],
  }),
  component: HojePage,
});

const sectionLabel =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

function HojePage() {
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const confirmed = appointments.filter((item) => item.status === "confirmed").length;
  const pending = appointments.length - confirmed;
  const next = appointments[0];
  const open = (id: string) =>
    navigate({ to: "/atendimentos/$appointmentId", params: { appointmentId: id } });
  const toGestao = () => navigate({ to: "/gestao" });

  return (
    <div className="flex flex-col gap-5">
      <TopBar
        title={`Bom dia, ${pro.name.split(" ")[0]}`}
        context={todayLabel}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/atendimento/novo" })}>
            <Icon name="Plus" size={15} /> Novo atendimento
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MetricCard
          label="Atendimentos"
          value={appointments.length}
          hint="hoje"
          icon="CalendarDays"
        />
        <MetricCard label="Confirmados" value={confirmed} icon="CheckCheck" tone="tech" />
        <MetricCard
          label="Aguardando"
          value={pending}
          icon="Clock"
          tone="warn"
          hint="enviar lembrete"
        />
        <MetricCard
          label="Previsto"
          value="R$ 640"
          icon="Wallet"
          tone="tech"
          hint="4 atendimentos"
        />
      </div>

      {next ? (
        <section className="flex flex-col gap-2.5">
          <span className={sectionLabel}>Próximo atendimento</span>
          <AppointmentCard variant="hero" {...next} onOpen={() => open(next.id)} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className={sectionLabel}>Atendimentos de hoje</span>
        {appointments.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item.id)}
            className="cursor-pointer text-left"
          >
            <AppointmentCard {...item} />
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <span className={sectionLabel}>Precisa da sua atenção</span>
        <AlertCard
          tone="warn"
          icon="Clock"
          title="2 clientes sem confirmação"
          description="Juliana às 16:30 e Camila às 18:00"
          actionLabel="Enviar lembrete"
        />
        <AlertCard
          tone="warn"
          icon="PackageMinus"
          title="Ácido mandélico acabando"
          description="2 frascos · mínimo 3"
          actionLabel="Ver estoque"
          onAction={toGestao}
        />
        <AlertCard
          tone="danger"
          icon="Receipt"
          title="Aluguel da sala vence em 4 dias"
          description="R$ 900 · 05 de setembro"
          actionLabel="Ver contas"
          onAction={toGestao}
        />
        <AlertCard
          tone="info"
          icon="Sparkles"
          title="Renata Dias está no período de retorno"
          description="96 dias sem atendimento"
          actionLabel="Convidar"
        />
      </section>
    </div>
  );
}
