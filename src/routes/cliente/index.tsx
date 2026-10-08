import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { Icon } from "@/components/eb/icon";
import { MetricCard } from "@/components/eb/metric-card";
import { StatusBadge } from "@/components/eb/status-badge";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { client, next, proName, recommendations } from "@/data/cliente-mock";

export const Route = createFileRoute("/cliente/")({
  head: () => ({
    meta: [
      { title: "Sua área — EstetBoost." },
      {
        name: "description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
      { property: "og:title", content: "Sua área — EstetBoost." },
      {
        property: "og:description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();

  return (
    <div className="flex flex-col gap-[18px]">
      <TopBar
        title={`Olá, ${client.first}`}
        context="Seu cuidado, organizado."
        notifications={unread}
        user={client}
        onNotifications={openNotifications}
      />

      <section
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] p-[18px]"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Próximo atendimento
        </span>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="min-w-[180px] flex-1">
            <div className="text-xl font-medium tracking-[-0.01em]">{next.procedure}</div>
            <div className="mt-[3px] text-[13.5px] text-[var(--text-secondary)]">
              {next.date} · {next.time} · com {proName}
            </div>
          </div>
          <StatusBadge tone={next.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="info" icon="Layers">
            Sessão {next.session}
          </StatusBadge>
          <StatusBadge tone="info" icon="MapPin">
            Estúdio Fernanda Costa
          </StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button type="button" variant="tech">
            <Icon name="Check" size={18} /> Confirmar presença
          </Button>
          <Button type="button" variant="secondary">
            <Icon name="CalendarClock" size={18} /> Pedir remarcação
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricCard
          label="Sessões restantes"
          value="2"
          hint="de 4 no pacote"
          icon="Layers"
          tone="tech"
        />
        <MetricCard label="Último atendimento" value="04 ago" hint="há 28 dias" icon="History" />
        <MetricCard label="Retorno sugerido" value="15 set" icon="Sparkles" tone="tech" />
      </div>

      <section className="flex flex-col gap-2.5">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Recomendações recentes
        </span>
        {recommendations.map((item) => (
          <AlertCard
            key={item.title}
            tone="info"
            icon={item.icon}
            title={item.title}
            description={item.detail}
          />
        ))}
      </section>

      <Button type="button" className="w-full" onClick={() => navigate({ to: "/cliente/agenda" })}>
        <Icon name="CalendarPlus" size={18} /> Solicitar novo horário
      </Button>
    </div>
  );
}
