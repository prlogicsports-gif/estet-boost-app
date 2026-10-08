import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { NewAppointmentDrawer } from "@/components/agenda/new-appointment-drawer";
import { AlertCard } from "@/components/eb/alert-card";
import { AnamnesisStepper } from "@/components/eb/anamnesis-stepper";
import { ClientTimeline } from "@/components/eb/client-timeline";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { PhotoVault } from "@/components/eb/photo-vault";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { FaceMapPanel } from "@/components/facemap/face-map-panel";
import { Button } from "@/components/ui/button";
import { appointmentsDb, clientsDb, ledgerDb } from "@/data/db";
import { faceSeed } from "@/data/face-seed";
import { timeline } from "@/data/gestor-mock";
import { formatWeekday, todayISO } from "@/lib/dates";
import { brl, byDateTime } from "@/lib/view";
import { receivePayment } from "@/services/finance.service";

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

function ClientePage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("resumo");
  const [scheduling, setScheduling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const client = clientsDb.use().find((item) => item.id === clientId);
  const appointments = appointmentsDb.use().filter((item) => item.clientId === clientId);
  const ledger = ledgerDb
    .use()
    .filter((entry) => entry.label === client?.name && entry.kind !== "saidas");

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

  const today = todayISO();
  const upcoming = appointments
    .filter((item) => !item.done && item.status !== "cancelled" && item.date >= today)
    .sort(byDateTime);
  const nextOne = upcoming[0];
  const open = ledger.filter((entry) => entry.kind === "receber");
  const history = timeline.filter(() => client.id === "c1");

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
            {[client.age ? `${client.age} anos` : null, client.phone, client.email]
              .filter(Boolean)
              .join(" · ") || "Sem dados de contato"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton icon="MessageCircle" label="Enviar WhatsApp" tone="outline" />
          <IconButton icon="Phone" label="Ligar" tone="outline" />
          <Button type="button" variant="secondary" onClick={() => setScheduling(true)}>
            <Icon name="CalendarPlus" size={18} /> Agendar
          </Button>
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
            <InfoRow
              label="Próximo horário"
              value={
                nextOne ? `${formatWeekday(nextOne.date)} · ${nextOne.time}` : client.nextReturn
              }
            />
          </section>
          <div className="flex flex-col gap-2.5">
            {client.note ? (
              <AlertCard
                tone="warn"
                icon="AlertTriangle"
                title="Observação importante"
                description={client.note}
              />
            ) : null}
            {open[0] ? (
              <AlertCard
                tone="danger"
                icon="Wallet"
                title="Pagamento pendente"
                description={`${open[0].origin} · ${brl(open[0].value)} em aberto`}
                actionLabel="Registrar"
                onAction={() => setTab("financeiro")}
              />
            ) : null}
            {nextOne ? (
              <AlertCard
                tone="info"
                icon="Sparkles"
                title="Próximo horário"
                description={`${nextOne.procedure} · ${formatWeekday(nextOne.date)} · ${nextOne.time}`}
                actionLabel="Ver"
                onAction={() =>
                  navigate({
                    to: "/atendimentos/$appointmentId",
                    params: { appointmentId: nextOne.id },
                  })
                }
              />
            ) : (
              <AlertCard
                tone="info"
                icon="Sparkles"
                title="Sem horário marcado"
                description="Agende o próximo atendimento desta cliente."
                actionLabel="Agendar"
                onAction={() => setScheduling(true)}
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "historico" ? (
        history.length ? (
          <ClientTimeline entries={history} />
        ) : (
          <EmptyState
            icon="History"
            title="Nenhum atendimento registrado"
            description="Os atendimentos concluídos aparecem aqui, com região, produto e observações."
            compact
          />
        )
      ) : null}

      {tab === "anamnese" ? (
        <div className="flex flex-col gap-4">
          <AnamnesisStepper
            current={client.id === "c1" ? 5 : 0}
            steps={[
              { label: "Objetivo e queixa" },
              { label: "Histórico de saúde" },
              { label: "Alergias e medicamentos" },
              { label: "Hábitos e rotina" },
              { label: "Procedimentos anteriores" },
              { label: "Avaliação e consentimentos" },
            ]}
          />
          {client.id === "c1" ? (
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
          ) : (
            <EmptyState
              icon="ClipboardList"
              title="Anamnese ainda não iniciada"
              description="Criar agora leva cerca de 4 minutos."
              compact
            />
          )}
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="secondary">
              <Icon name="PencilLine" size={18} />{" "}
              {client.id === "c1" ? "Atualizar anamnese" : "Criar anamnese"}
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
          {ledger.length ? (
            [...ledger]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
                >
                  <span className="w-14 font-mono text-xs text-muted-foreground">
                    {new Date(`${entry.date}T12:00:00`)
                      .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                      .replace(".", "")}
                  </span>
                  <span className="min-w-[140px] flex-1 text-[13.5px]">{entry.origin}</span>
                  <span className="font-mono text-sm font-medium">{brl(entry.value)}</span>
                  <StatusBadge tone={entry.kind === "receber" ? "pending" : "confirmed"} size="sm">
                    {entry.kind === "receber" ? "Em aberto" : "Pago"}
                  </StatusBadge>
                  {entry.kind === "receber" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="tech"
                      onClick={() => {
                        receivePayment(entry.id, "Pix");
                        setToast(`Pagamento de ${brl(entry.value)} registrado`);
                        window.setTimeout(() => setToast(null), 2600);
                      }}
                    >
                      Registrar pagamento
                    </Button>
                  ) : null}
                </div>
              ))
          ) : (
            <EmptyState
              icon="Wallet"
              title="Sem lançamentos"
              description="Pagamentos desta cliente aparecem aqui quando um atendimento é fechado."
              compact
            />
          )}
        </div>
      ) : null}

      <ToastHost toast={toast ? { message: toast } : null} />
      <NewAppointmentDrawer
        open={scheduling}
        date={today}
        clientId={client.id}
        onClose={() => setScheduling(false)}
        onCreated={(rec) => {
          setScheduling(false);
          setToast(`Horário marcado para ${formatWeekday(rec.date)} · ${rec.time}`);
          window.setTimeout(() => setToast(null), 2600);
        }}
      />
    </div>
  );
}
