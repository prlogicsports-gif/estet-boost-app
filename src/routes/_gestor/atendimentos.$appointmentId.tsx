import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Modal } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import { appointments } from "@/data/gestor-mock";

export const Route = createFileRoute("/_gestor/atendimentos/$appointmentId")({
  head: () => ({ meta: [{ title: "Atendimento — EstetBoost." }] }),
  component: AtendimentoPage,
});

function AtendimentoPage() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const appointment = appointments.find((item) => item.id === appointmentId);

  if (!appointment) {
    return (
      <EmptyState
        icon="CalendarClock"
        title="Atendimento não encontrado"
        description="Ele pode ter sido remarcado ou cancelado."
        action={
          <Button asChild>
            <Link to="/hoje">Voltar para hoje</Link>
          </Button>
        }
      />
    );
  }

  const first = appointment.kind === "primeira";
  const facts: [string, string][] = [
    ["Objetivo da cliente", "Reduzir oleosidade e cravos na zona T"],
    ["Último procedimento", "Limpeza de pele profunda"],
    ["Última data", "04 de agosto · há 28 dias"],
    ["Alergias", "Ácido salicílico"],
    ["Medicamentos", "Nenhum de uso contínuo"],
    ["Sensibilidades anteriores", "Bochecha direita — leve ardência"],
    ["Informações faltantes", first ? "Anamnese não iniciada" : "Rotina de casa não atualizada"],
    ["Pagamentos pendentes", "R$ 180 da sessão 2"],
  ];
  const start = () =>
    navigate({ to: "/atendimento/$sessionId", params: { sessionId: appointment.id } });

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        <IconButton icon="ArrowLeft" label="Voltar" onClick={() => navigate({ to: "/hoje" })} />
        <span className="text-[13px] text-muted-foreground">Atendimento</span>
      </div>

      <header className="flex flex-wrap items-center gap-3.5">
        <span className="grid size-14 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-lg font-medium">
          {appointment.initials}
        </span>
        <div className="min-w-40 flex-1">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.015em]">
            {appointment.client}
          </h1>
          <p className="text-[13.5px] text-[var(--text-secondary)]">
            {appointment.procedure} · hoje às {appointment.time}
          </p>
        </div>
        <StatusBadge tone={appointment.status} />
      </header>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="info" icon={first ? "Sparkles" : "RotateCcw"}>
          {first ? "Primeira consulta" : "Retorno"}
        </StatusBadge>
        {appointment.session && appointment.sessionsTotal ? (
          <StatusBadge tone="info" icon="Layers">
            Sessão {appointment.session} de {appointment.sessionsTotal} · restam{" "}
            {appointment.sessionsTotal - appointment.session}
          </StatusBadge>
        ) : null}
        <StatusBadge tone="info" icon="Wallet">
          {appointment.price}
        </StatusBadge>
      </div>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] px-[18px] py-4"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        <h2 className="mb-3 text-xl font-medium tracking-[-0.01em]">O que você precisa saber</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-0.5">
          {facts.map(([key, value]) => (
            <div key={key} className="border-b border-[var(--border-hairline)] py-[9px]">
              <div className="text-[11.5px] text-muted-foreground">{key}</div>
              <div className="mt-0.5 text-[13.5px]">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {first ? (
        <AlertCard
          tone="warn"
          icon="ClipboardList"
          title="Esta cliente ainda não possui anamnese."
          description="Criar agora leva cerca de 4 minutos."
          actionLabel="Criar anamnese"
        />
      ) : (
        <AlertCard
          tone="info"
          icon="History"
          title="Último atendimento há 28 dias."
          description="Compare as fotografias antes de começar."
          actionLabel="Ver evolução"
          onAction={() =>
            navigate({ to: "/clientes/$clientId", params: { clientId: appointment.clientId } })
          }
        />
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="tech" onClick={start}>
          <Icon name="Play" size={18} /> Iniciar atendimento
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            navigate({ to: "/clientes/$clientId", params: { clientId: appointment.clientId } })
          }
        >
          <Icon name="FileText" size={18} /> Abrir prontuário
        </Button>
        <Button type="button" variant="secondary">
          <Icon name="MessageCircle" size={18} /> Enviar mensagem
        </Button>
        <Button type="button" variant="ghost">
          <Icon name="CalendarClock" size={18} /> Remarcar
        </Button>
        <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
          <Icon name="X" size={18} /> Cancelar
        </Button>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="danger"
        title="Cancelar este atendimento?"
        subtitle={`${appointment.client} será avisada por mensagem. A sessão volta para o pacote.`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button type="button" variant="danger" onClick={() => setConfirm(false)}>
              Cancelar atendimento
            </Button>
          </>
        }
      />
    </div>
  );
}
