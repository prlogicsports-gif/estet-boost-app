import { useEffect, useState } from "react";

import { AlertCard } from "@/components/eb/alert-card";
import { AnamnesisStepper } from "@/components/eb/anamnesis-stepper";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Modal } from "@/components/eb/overlays";
import { PhotoVault } from "@/components/eb/photo-vault";
import { SessionWrapUp } from "@/components/eb/session-wrap-up";
import { SkinScan, type ScanSuggestion } from "@/components/eb/skin-scan";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { FaceMapPanel } from "@/components/facemap/face-map-panel";
import { Button } from "@/components/ui/button";
import { faceSeed } from "@/data/face-seed";
import { appointmentsDb, clientsDb, stockDb } from "@/data/db";
import { completeAppointment } from "@/services/appointments.service";
import { PRICES } from "@/components/agenda/new-appointment-drawer";
import { Select } from "@/components/eb/select";
import { buildMarks, readFaceMap, writeFaceMap } from "@/lib/face-map-store";
import type { WrapUpResult } from "@/lib/session-care";

export type SessionAppointment = {
  id: string;
  clientId: string;
  client: string;
  initials: string;
  procedure: string;
  time: string;
  novo?: boolean;
};

const STEPS = [
  { label: "Atualização de saúde" },
  { label: "Avaliação atual" },
  { label: "Análise por câmera" },
  { label: "Mapa facial" },
  { label: "Procedimento" },
  { label: "Produtos" },
  { label: "Fotografias" },
  { label: "Recomendações" },
  { label: "Pagamento e retorno" },
];

const SCAN_SUGGESTIONS: ScanSuggestion[] = [
  {
    id: "s1",
    zoneId: "nariz",
    zoneLabel: "Nariz",
    observation: "Poros mais visíveis do que na sessão anterior.",
    product: "Ácido mandélico 5%",
    inStock: "2 frascos",
  },
  {
    id: "s2",
    zoneId: "glabela",
    zoneLabel: "Glabela",
    observation: "Brilho concentrado na zona T.",
    product: "Argila verde",
    inStock: "6 potes",
  },
  {
    id: "s3",
    zoneId: "bochecha-esq",
    zoneLabel: "Bochecha esquerda",
    observation: "Região com sensibilidade registrada em agosto.",
    product: "Máscara calmante",
  },
];

const quickActions = [
  ["Mic", "Registrar por voz"],
  ["MessageSquarePlus", "Observação"],
  ["Camera", "Tirar foto"],
  ["History", "Histórico"],
  ["ScanFace", "Marcar região"],
] as const;

/** Atendimento em andamento: do passo de saúde ao pagamento, com o fechamento no final. */
export function SessionScreen({
  appointment,
  onExit,
}: {
  appointment: SessionAppointment;
  onExit: () => void;
}) {
  const a = appointment;
  const [step, setStep] = useState(a.novo ? 0 : 2);
  const [toast, setToast] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<WrapUpResult | null>(null);
  const client = clientsDb.use().find((item) => item.id === a.clientId);
  const stock = stockDb.use();
  const known = appointmentsDb.use().find((item) => item.id === a.id);
  const [used, setUsed] = useState<string[]>(() =>
    stockDb
      .get()
      .filter((item) => item.name.includes("mandélico"))
      .map((item) => item.name),
  );
  const [price, setPrice] = useState(String(known?.price ?? PRICES[a.procedure] ?? 180));
  const [payment, setPayment] = useState(
    known?.payment && known.payment !== "A definir" ? known.payment : "Pix",
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const say = (message: string) => setToast(message);

  // Os pontos da análise por câmera entram no mapa da cliente como "planejados".
  const sendScanToMap = (list: ScanSuggestion[]) => {
    const current = readFaceMap(a.clientId) ?? faceSeed[a.clientId] ?? [];
    const made = list.flatMap((item) =>
      buildMarks(
        item.zoneId,
        { procedimento: item.product ?? "", produto: "", acao: "", observacao: item.observation },
        [],
        null,
        "planned",
      ),
    );
    writeFaceMap(a.clientId, [...current, ...made]);
    say(
      `${list.length} ponto${list.length > 1 ? "s" : ""} enviado${list.length > 1 ? "s" : ""} ao mapa facial`,
    );
    setStep(3);
  };

  if (closing) {
    const returnDate = summary?.retorno
      ? new Date(`${summary.retorno.data}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
        })
      : null;
    return (
      <>
        <SessionWrapUp
          clientName={a.client}
          procedure={a.procedure}
          anamnese={{
            alergias: client?.allergies,
            contraindicacoes: client?.contra,
            sensibilidade: client?.note && /sensibilidade/i.test(client.note) ? client.note : "",
            rotina: "Protetor solar irregular",
          }}
          onBack={() => setClosing(false)}
          onConfirm={(result) => {
            setSummary(result);
            completeAppointment(a, {
              price: Number(price.replace(",", ".")) || 0,
              payment,
              products: used,
              cuidados: result.cuidados,
              retorno: result.retorno,
            });
            setDone(true);
          }}
        />
        <Modal
          open={done}
          onClose={() => setDone(false)}
          title="Atendimento finalizado"
          subtitle={`Registro salvo no prontuário de ${a.client.split(" ")[0]}. ${
            summary?.retorno
              ? `Retorno pedido para ${returnDate} às ${summary.retorno.hora}, aguardando confirmação.`
              : `Sem reagendamento${summary?.semRetorno ? ` · ${summary.semRetorno.toLowerCase()}` : ""}.`
          } ${summary?.cuidados.length ?? 0} cuidados enviados para a cliente.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDone(false)}>
                Revisar
              </Button>
              <Button
                type="button"
                variant="tech"
                onClick={() => {
                  setDone(false);
                  onExit();
                }}
              >
                Concluir
              </Button>
            </>
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <IconButton icon="X" label="Sair do atendimento" onClick={onExit} />
        <div className="flex-1">
          <div className="text-[15px] font-medium">{a.client}</div>
          <div className="text-xs text-muted-foreground">{a.procedure} · em andamento</div>
        </div>
        <StatusBadge tone="confirmed" size="sm">
          Em atendimento
        </StatusBadge>
      </div>

      <AnamnesisStepper steps={STEPS} current={step} onSelect={setStep} />

      <div className="flex flex-wrap gap-2">
        {quickActions.map(([icon, text]) => (
          <Button
            key={text}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => say(`${text} — ação registrada`)}
          >
            <Icon name={icon} size={15} /> {text}
          </Button>
        ))}
      </div>

      {step === 0 ? (
        <div className="flex flex-col gap-3">
          <AlertCard
            tone="warn"
            icon="AlertTriangle"
            title="Alergia registrada: ácido salicílico"
            description="Confirme com a cliente antes de aplicar qualquer ativo."
          />
          <Input
            label="Algo mudou desde a última sessão?"
            multiline
            rows={3}
            placeholder="Medicamentos, gestação, procedimentos recentes…"
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <Input
            label="Avaliação da pele hoje"
            multiline
            rows={4}
            placeholder="Textura, hidratação, sensibilidade…"
          />
          <Input
            label="Queixa do dia"
            multiline
            rows={4}
            placeholder="O que a cliente trouxe hoje?"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <SkinScan
          clientName={a.client.split(" ")[0]}
          suggestions={SCAN_SUGGESTIONS}
          onOpenZone={() => setStep(3)}
          onConfirm={sendScanToMap}
        />
      ) : null}

      {step === 3 ? <FaceMapPanel clientId={a.clientId} seed={faceSeed[a.clientId]} /> : null}

      {step === 4 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <Input label="Procedimento realizado" defaultValue={a.procedure} />
          <Input label="Duração" trailing="min" defaultValue="60" />
          <Input label="Intercorrências" multiline rows={3} placeholder="Nenhuma" />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="flex flex-col gap-2.5">
          {stock.map((item) => (
            <label
              key={item.name}
              className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 text-[13.5px]"
            >
              <input
                type="checkbox"
                checked={used.includes(item.name)}
                onChange={() =>
                  setUsed((current) =>
                    current.includes(item.name)
                      ? current.filter((name) => name !== item.name)
                      : [...current, item.name],
                  )
                }
                className="size-[18px] accent-[var(--teal)]"
              />
              <span className="flex-1">{item.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {item.quantity} {item.unit} em estoque
              </span>
            </label>
          ))}
          <AlertCard
            tone="warn"
            icon="PackageMinus"
            title="Baixa automática no estoque"
            description={
              used.length
                ? `1 unidade de ${used.join(", ")} será descontada ao finalizar.`
                : "Nenhum produto marcado: o estoque não muda."
            }
          />
        </div>
      ) : null}

      {step === 6 ? <PhotoVault clientId={a.clientId} /> : null}

      {step === 7 ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Recomendações para casa"
            multiline
            rows={4}
            defaultValue="Protetor solar todas as manhãs. Evitar esfoliação por 5 dias."
          />
        </div>
      ) : null}

      {step === 8 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <Input
            label="Valor"
            trailing="R$"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <Select
            label="Forma de pagamento"
            options={["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência"]}
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2.5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          <Icon name="ChevronLeft" size={18} /> Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((current) => current + 1)}>
            Avançar <Icon name="ChevronRight" size={18} />
          </Button>
        ) : (
          <Button type="button" variant="tech" onClick={() => setClosing(true)}>
            <Icon name="Check" size={18} /> Finalizar atendimento
          </Button>
        )}
      </div>

      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
