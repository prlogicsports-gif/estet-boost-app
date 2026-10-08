import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { AnamnesisStepper } from "@/components/eb/anamnesis-stepper";
import { ClientTimeline } from "@/components/eb/client-timeline";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { PhotoVault } from "@/components/eb/photo-vault";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { StatusBadge, type StatusTone } from "@/components/eb/status-badge";
import { FaceMapPanel } from "@/components/facemap/face-map-panel";
import { Button } from "@/components/ui/button";
import { faceSeed } from "@/data/face-seed";
import { clients, timeline } from "@/data/gestor-mock";

export const Route = createFileRoute("/_gestor/clientes/$clientId")({
  head: () => ({ meta: [{ title: "Cliente — EstetBoost." }] }),
  component: ClientePage,
});

type Tab = "resumo" | "historico" | "anamnese" | "evolucao" | "financeiro";

function InfoRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex gap-3 border-b border-[var(--border-hairline)] py-2.5">
      <span className="w-[150px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[13.5px]" style={{ color: warn ? "var(--eb-amber-500)" : undefined }}>
        {value}
      </span>
    </div>
  );
}

const panel =
  "rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 pb-3 pt-1";
const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

const payments: [string, string, string, StatusTone][] = [
  ["04 ago", "Limpeza de pele · sessão 2", "R$ 180", "pending"],
  ["07 jul", "Limpeza de pele · sessão 1", "R$ 180", "confirmed"],
  ["02 jun", "Avaliação inicial", "Cortesia", "confirmed"],
];

function ClientePage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("resumo");
  const client = clients.find((item) => item.id === clientId);

  if (!client) {
    return (
      <EmptyState
        icon="UserSearch"
        title="Cliente não encontrada"
        description="Ela pode ter sido removida da sua carteira."
        action={
          <Button asChild>
            <Link to="/clientes">Voltar para clientes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        <IconButton icon="ArrowLeft" label="Voltar" onClick={() => navigate({ to: "/clientes" })} />
        <span className="text-[13px] text-muted-foreground">Clientes</span>
      </div>

      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-[68px] place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[22px] font-medium">
          {client.initials}
        </span>
        <div className="min-w-[180px] flex-1">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.015em]">
            {client.name}
          </h1>
          <p className="mt-[3px] text-[13px] text-[var(--text-secondary)]">
            {client.age} anos · {client.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton icon="MessageCircle" label="Enviar WhatsApp" tone="outline" />
          <IconButton icon="Phone" label="Ligar" tone="outline" />
          <Button
            type="button"
            onClick={() =>
              navigate({
                to: "/atendimento/$sessionId",
                params: { sessionId: "livre" },
                search: { cliente: client.id, procedimento: "Limpeza de pele profunda" },
              })
            }
          >
            <Icon name="Plus" size={18} /> Novo atendimento
          </Button>
        </div>
      </header>

      <SegmentedTabs<Tab>
        scroll
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "resumo", label: "Resumo" },
          { id: "historico", label: "Histórico" },
          { id: "anamnese", label: "Anamnese" },
          { id: "evolucao", label: "Evolução" },
          { id: "financeiro", label: "Financeiro" },
        ]}
      />

      {tab === "resumo" ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-4">
          <section className={panel}>
            <InfoRow label="Objetivo" value={client.goal ?? "—"} />
            <InfoRow
              label="Alergias"
              value={client.allergies ?? "Nenhuma registrada"}
              warn={Boolean(client.allergies)}
            />
            <InfoRow
              label="Contraindicações"
              value={client.contra ?? "Nenhuma registrada"}
              warn={Boolean(client.contra)}
            />
            <InfoRow label="Em andamento" value={client.mainProcedure} />
            <InfoRow
              label="Sessões restantes"
              value={client.session ? `${client.session} — restam 2` : "—"}
            />
            <InfoRow label="Último atendimento" value={client.lastVisit} />
            <InfoRow label="Próximo retorno" value={client.nextReturn} />
          </section>
          <div className="flex flex-col gap-2.5">
            <AlertCard
              tone="warn"
              icon="AlertTriangle"
              title="Observação importante"
              description={client.note ?? "Sem observações."}
            />
            <AlertCard
              tone="danger"
              icon="Wallet"
              title="Pagamento pendente"
              description="Sessão 2 · R$ 180 em aberto"
              actionLabel="Registrar"
            />
            <AlertCard
              tone="info"
              icon="Sparkles"
              title="Retorno recomendado"
              description="12 de setembro · 14 dias após a última sessão"
              actionLabel="Agendar"
            />
          </div>
        </div>
      ) : null}

      {tab === "historico" ? <ClientTimeline entries={timeline} /> : null}

      {tab === "anamnese" ? (
        <div className="flex flex-col gap-4">
          <AnamnesisStepper
            current={5}
            steps={[
              { label: "Objetivo e queixa" },
              { label: "Histórico de saúde" },
              { label: "Alergias e medicamentos" },
              { label: "Hábitos e rotina" },
              { label: "Procedimentos anteriores" },
              { label: "Avaliação e consentimentos" },
            ]}
          />
          <div className={panel}>
            <InfoRow label="Queixa principal" value="Oleosidade e cravos na zona T" />
            <InfoRow label="Saúde" value="Sem doenças crônicas relatadas" />
            <InfoRow label="Medicamentos" value="Nenhum de uso contínuo" />
            <InfoRow label="Alergias" value="Ácido salicílico" warn />
            <InfoRow
              label="Rotina de cuidados"
              value="Sabonete facial 2x/dia, protetor solar irregular"
            />
            <InfoRow label="Consentimento de imagem" value="Autorizado para uso interno" />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="secondary">
              <Icon name="PencilLine" size={18} /> Atualizar anamnese
            </Button>
            <Button type="button" variant="ghost">
              <Icon name="FileDown" size={18} /> Exportar prontuário
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "evolucao" ? (
        <div className="flex flex-col gap-7">
          <span className={label}>Mapa facial</span>
          <FaceMapPanel
            clientId={client.id}
            seed={faceSeed[client.id]}
            showGeneralActions={false}
          />
          <PhotoVault clientId={client.id} />
        </div>
      ) : null}

      {tab === "financeiro" ? (
        <div className="flex flex-col gap-2.5">
          {payments.map(([date, what, value, tone]) => (
            <div
              key={`${date}-${what}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <span className="w-14 font-mono text-xs text-muted-foreground">{date}</span>
              <span className="flex-1 text-[13.5px]">{what}</span>
              <span className="font-mono text-sm font-medium">{value}</span>
              <StatusBadge tone={tone} size="sm">
                {tone === "pending" ? "Em aberto" : "Pago"}
              </StatusBadge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
