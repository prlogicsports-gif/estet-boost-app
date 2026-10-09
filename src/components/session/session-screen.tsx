import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AlertCard } from "@/components/eb/alert-card";
import { AnamnesisStepper } from "@/components/eb/anamnesis-stepper";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Modal } from "@/components/eb/overlays";
import { PhotoComparator } from "@/components/eb/photo-comparator";
import { Select } from "@/components/eb/select";
import { SessionWrapUp } from "@/components/eb/session-wrap-up";
import { daysToExpire } from "@/components/eb/stock-item";
import { StatusBadge } from "@/components/eb/status-badge";
import { FaceMapPanel } from "@/components/facemap/face-map-panel";
import { NewProcedureForm } from "@/components/session/new-procedure-form";
import { SessionPhotoSlot } from "@/components/session/session-photo-slot";
import { Button } from "@/components/ui/button";
import { clientsDb, proceduresDb, sessionsDb, stockDb } from "@/data/db";
import { can } from "@/lib/permissions";
import { photoUrl } from "@/lib/photo-store";
import { useSession } from "@/lib/session";
import type { SessionRec } from "@/lib/models";
import { cn } from "@/lib/utils";
import {
  completeSession,
  MARGIN_ALERT,
  sessionTotals,
  updateSession,
} from "@/services/sessions.service";
import type { WrapUpResult } from "@/lib/session-care";

const STEPS = [
  { label: "Atualização de saúde" },
  { label: "Avaliação atual" },
  { label: "Foto inicial" },
  { label: "Mapa facial" },
  { label: "Procedimento realizado" },
  { label: "Produtos" },
  { label: "Antes e depois" },
  { label: "Recomendações" },
  { label: "Pagamento e retorno" },
];

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const card =
  "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4";

/** Atendimento em andamento: cada alteração é salva sozinha na hora, então dá para sair e retomar. */
export function SessionScreen({ session, onExit }: { session: SessionRec; onExit: () => void }) {
  const s = session;
  const set = (patch: Partial<Omit<SessionRec, "id">>) => updateSession(s.id, patch);
  const setNote = (key: string, value: string) => set({ notes: { ...s.notes, [key]: value } });
  const client = clientsDb.use().find((item) => item.id === s.clientId);
  const stock = stockDb.use();
  const catalog = proceduresDb.use();
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [saving, setSaving] = useState(false);
  const me = useSession();
  const fin = can(me, "financeiro");
  const [summary, setSummary] = useState<WrapUpResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [compare, setCompare] = useState<"slider" | "side">("slider");
  const [urls, setUrls] = useState<{ before?: string; after?: string }>({});
  const totals = sessionTotals(s);
  const step = s.step;
  const go = (next: number) => set({ step: Math.min(STEPS.length - 1, Math.max(0, next)) });

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all([photoUrl(s.beforePhotoId), photoUrl(s.afterPhotoId)]).then(([before, after]) => {
      for (const url of [before, after]) if (url) made.push(url);
      if (alive) setUrls({ ...(before ? { before } : {}), ...(after ? { after } : {}) });
    });
    return () => {
      alive = false;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [s.beforePhotoId, s.afterPhotoId]);

  const addProcedure = (name: string, price: number) =>
    set({ procedures: [...s.procedures, { name, price }] });
  const setProcedurePrice = (index: number, price: number) =>
    set({ procedures: s.procedures.map((item, i) => (i === index ? { ...item, price } : item)) });
  const removeProcedure = (index: number) =>
    set({ procedures: s.procedures.filter((_, i) => i !== index) });

  const qtyOf = (stockId: string) => s.products.find((item) => item.stockId === stockId)?.qty ?? 0;
  const setQty = (stockId: string, qty: number) => {
    const item = stock.find((entry) => entry.id === stockId);
    if (!item) return;
    const rest = s.products.filter((entry) => entry.stockId !== stockId);
    set({
      products: qty > 0 ? [...rest, { stockId, name: item.name, qty, unitCost: item.cost }] : rest,
    });
  };

  if (s.status === "done" && !closing) {
    return (
      <EmptyState
        icon="CalendarCheck"
        title="Atendimento já finalizado"
        description="Ele está salvo na ficha da cliente."
        action={
          <Button asChild>
            <Link to="/atendimento/novo">Novo atendimento</Link>
          </Button>
        }
      />
    );
  }

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
          clientName={s.client}
          procedure={s.procedure}
          anamnese={{
            alergias: client?.allergies,
            contraindicacoes: client?.contra,
            sensibilidade: client?.note && /sensibilidade/i.test(client.note) ? client.note : "",
            rotina: "Protetor solar irregular",
          }}
          onBack={() => setClosing(false)}
          onConfirm={async (result) => {
            if (saving) return;
            setSummary(result);
            setSaving(true);
            setCloseError(null);
            const outcome = await completeSession(s.id, {
              cuidados: result.cuidados,
              retorno: result.retorno,
            });
            setSaving(false);
            if (outcome.ok) {
              setQueued(Boolean(outcome.queued));
              setDone(true);
            } else setCloseError(outcome.message);
          }}
        />
        {closeError ? (
          <p role="alert" className="mt-3 text-center text-[13px] text-[var(--eb-coral-500)]">
            {closeError}
          </p>
        ) : null}
        <Modal
          open={done}
          onClose={() => setDone(false)}
          title="Atendimento finalizado"
          subtitle={`${queued ? "Sem internet: o fechamento ficou guardado neste aparelho e será concluído sozinho quando a conexão voltar. " : ""}Registro salvo no prontuário de ${s.client.split(" ")[0]}, com antes e depois. ${
            summary?.retorno
              ? `Retorno pedido para ${returnDate} às ${summary.retorno.hora}, aguardando confirmação.`
              : `Sem reagendamento${summary?.semRetorno ? ` · ${summary.semRetorno.toLowerCase()}` : ""}.`
          } ${summary?.cuidados.length ?? 0} cuidados enviados para a cliente.`}
          footer={
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
          }
        />
      </>
    );
  }

  const marginHigh = totals.price > 0 && totals.share > MARGIN_ALERT;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <IconButton icon="X" label="Sair do atendimento" onClick={onExit} />
        <div className="flex-1">
          <div className="text-[15px] font-medium">{s.client}</div>
          <div className="text-xs text-muted-foreground">
            {s.procedure || "Procedimento a definir"} · em andamento
          </div>
        </div>
        <span className="hidden text-xs text-[var(--eb-teal-500)] sm:inline">
          Salvo automaticamente
        </span>
        <StatusBadge tone="confirmed" size="sm">
          Em atendimento
        </StatusBadge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-6">
          <AnamnesisStepper steps={STEPS} current={step} onSelect={go} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {step === 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {client?.allergies ? (
                <div className="xl:col-span-2">
                  <AlertCard
                    tone="warn"
                    icon="AlertTriangle"
                    title={`Alergia registrada: ${client.allergies}`}
                    description="Confirme com a cliente antes de aplicar qualquer ativo."
                  />
                </div>
              ) : null}
              <Input
                label="Algo mudou desde a última sessão?"
                multiline
                rows={5}
                placeholder="Medicamentos, gestação, procedimentos recentes…"
                value={s.notes["saude"] ?? ""}
                onChange={(event) => setNote("saude", event.target.value)}
              />
              <Input
                label="Rotina de cuidados em casa"
                multiline
                rows={5}
                placeholder="Protetor solar, ativos em uso, produtos novos…"
                value={s.notes["rotina"] ?? ""}
                onChange={(event) => setNote("rotina", event.target.value)}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              <Input
                label="Avaliação da pele hoje"
                multiline
                rows={6}
                placeholder="Textura, hidratação, sensibilidade…"
                value={s.notes["avaliacao"] ?? ""}
                onChange={(event) => setNote("avaliacao", event.target.value)}
              />
              <Input
                label="Queixa do dia"
                multiline
                rows={6}
                placeholder="O que a cliente trouxe hoje?"
                value={s.notes["queixa"] ?? ""}
                onChange={(event) => setNote("queixa", event.target.value)}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5 md:grid-cols-[minmax(240px,360px)_1fr]">
              <SessionPhotoSlot
                clientId={s.clientId}
                sessionId={s.id}
                procedure={s.procedure}
                tipo="antes"
                photoId={s.beforePhotoId}
                authorized={Boolean(client?.imageConsent)}
                onChange={(id) => set({ beforePhotoId: id })}
              />
              <div className="flex flex-col gap-3">
                <AlertCard
                  tone="info"
                  icon="Camera"
                  title="Esta foto é o ponto de partida da evolução"
                  description="Ela entra na ficha de cliente como “antes” e reaparece na etapa 7 para você registrar o resultado ao lado dela."
                />
                <Input
                  label="Observação sobre a foto"
                  multiline
                  rows={3}
                  placeholder="Iluminação, ângulo, o que chama atenção…"
                  value={s.notes["foto-antes"] ?? ""}
                  onChange={(event) => setNote("foto-antes", event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? <FaceMapPanel clientId={s.clientId} /> : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
                <span className={label}>Procedimentos realizados</span>
                {s.procedures.length ? (
                  s.procedures.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-[14.5px]">{item.name}</span>
                      {fin ? (
                        <Input
                          aria-label={`Valor de ${item.name}`}
                          className="w-32"
                          trailing="R$"
                          inputMode="decimal"
                          value={String(item.price)}
                          onChange={(event) =>
                            setProcedurePrice(
                              index,
                              Number(event.target.value.replace(",", ".")) || 0,
                            )
                          }
                        />
                      ) : null}
                      <IconButton
                        icon="Trash2"
                        label={`Remover ${item.name}`}
                        onClick={() => removeProcedure(index)}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    Nenhum procedimento ainda. Escolha abaixo ou crie um novo.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                <span className={label}>Adicionar do catálogo</span>
                <div className="flex flex-wrap gap-2">
                  {catalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addProcedure(item.name, item.price)}
                      className="min-h-11 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3.5 text-[13.5px] text-[var(--text-secondary)]"
                    >
                      + {item.name} · {money(item.price)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-hairline)] px-3.5 text-[13.5px] text-[var(--text-secondary)]"
                  >
                    <Icon name="Plus" size={15} /> Criar procedimento
                  </button>
                </div>
                {creating ? (
                  <NewProcedureForm
                    onCancel={() => setCreating(false)}
                    onCreate={(rec) => {
                      addProcedure(rec.name, rec.price);
                      setCreating(false);
                    }}
                  />
                ) : null}
              </div>
              <Input
                label="Intercorrências"
                multiline
                rows={3}
                placeholder="Nenhuma"
                value={s.notes["intercorrencias"] ?? ""}
                onChange={(event) => setNote("intercorrencias", event.target.value)}
              />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
              <div className="flex flex-col gap-2.5">
                <span className={label}>Produtos usados</span>
                {stock.map((item) => {
                  const qty = qtyOf(item.id);
                  const days = daysToExpire(item);
                  const expired = days !== null && days < 0;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--surface-card)] px-3.5 py-2.5",
                        qty ? "border-[var(--eb-teal-a40)]" : "border-[var(--border-card)]",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px]">{item.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.quantity} {item.unit} em estoque · {money(item.cost)} cada
                          {expired
                            ? " · vencido"
                            : days !== null && days <= 30
                              ? ` · vence em ${days} dias`
                              : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <IconButton
                          icon="Minus"
                          label={`Menos ${item.name}`}
                          onClick={() => setQty(item.id, Math.max(0, qty - 1))}
                        />
                        <span className="w-8 text-center font-mono text-[14px]">{qty}</span>
                        <IconButton
                          icon="Plus"
                          label={`Mais ${item.name}`}
                          onClick={() => setQty(item.id, qty + 1)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {fin ? (
                <div className={card}>
                  <span className={label}>Custo do atendimento</span>
                  <Row k="Valor cobrado" v={money(totals.price)} />
                  <Row k="Produtos" v={money(totals.cost)} />
                  <Row k="Sobra" v={money(totals.profit)} strong />
                  {totals.price > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Produtos: {Math.round(totals.share * 100)}% do valor cobrado.
                    </p>
                  ) : null}
                  {marginHigh ? (
                    <AlertCard
                      tone="warn"
                      icon="TrendingDown"
                      title="Produtos pesaram neste atendimento"
                      description={`Passou de ${Math.round(MARGIN_ALERT * 100)}% do valor cobrado. Reveja o preço ou a quantidade.`}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {s.products.length
                      ? "A baixa no estoque acontece ao finalizar."
                      : "Nenhum produto marcado: o estoque não muda."}
                  </p>
                </div>
              ) : (
                <div className={card}>
                  <span className={label}>Estoque</span>
                  <p className="text-xs text-muted-foreground">
                    {s.products.length
                      ? "A baixa no estoque acontece ao finalizar."
                      : "Nenhum produto marcado: o estoque não muda."}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {step === 6 ? (
            <div className="flex flex-col gap-5">
              {urls.before && urls.after ? (
                <div className="max-w-[460px]">
                  <PhotoComparator
                    before={{ src: urls.before, label: "Antes" }}
                    after={{ src: urls.after, label: "Depois" }}
                    mode={compare}
                    onModeChange={setCompare}
                    meta={[{ icon: "Sparkles", label: s.procedure || "Atendimento" }]}
                  />
                </div>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2 xl:max-w-[760px]">
                <div className="flex flex-col gap-2.5">
                  {s.beforePhotoId ? null : (
                    <AlertCard
                      tone="info"
                      icon="Camera"
                      title="Sem foto inicial"
                      description="Volte à etapa 3 para registrar o antes, ou anexe aqui."
                    />
                  )}
                  <SessionPhotoSlot
                    clientId={s.clientId}
                    sessionId={s.id}
                    procedure={s.procedure}
                    tipo="antes"
                    photoId={s.beforePhotoId}
                    authorized={Boolean(client?.imageConsent)}
                    onChange={(id) => set({ beforePhotoId: id })}
                  />
                </div>
                <SessionPhotoSlot
                  clientId={s.clientId}
                  sessionId={s.id}
                  procedure={s.procedure}
                  tipo="depois"
                  photoId={s.afterPhotoId}
                  authorized={Boolean(client?.imageConsent)}
                  onChange={(id) => set({ afterPhotoId: id })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Antes e depois ficam salvos na ficha de {s.client.split(" ")[0]} e aparecem na
                evolução.
              </p>
            </div>
          ) : null}

          {step === 7 ? (
            <Input
              label="Recomendações para casa"
              multiline
              rows={6}
              value={
                s.notes["recomendacoes"] ??
                "Protetor solar todas as manhãs. Evitar esfoliação por 5 dias."
              }
              onChange={(event) => setNote("recomendacoes", event.target.value)}
            />
          ) : null}

          {step === 8 && !fin ? (
            <div className={card}>
              <span className={label}>Pagamento</span>
              <p className="text-[13.5px] text-[var(--text-secondary)]">
                O valor deste atendimento segue a tabela de preços e fica a receber para a gestora
                conferir e registrar o pagamento.
              </p>
            </div>
          ) : null}

          {step === 8 && fin ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <div className={card}>
                <span className={label}>Resumo</span>
                {s.procedures.map((item, index) => (
                  <Row key={`${item.name}-${index}`} k={item.name} v={money(item.price)} />
                ))}
                <Row k="Total" v={money(totals.price)} strong />
                <Row k="Custo de produtos" v={money(totals.cost)} />
                <Row k="Sobra" v={money(totals.profit)} strong />
              </div>
              <div className={card}>
                <span className={label}>Pagamento</span>
                <Select
                  label="Forma de pagamento"
                  options={[
                    "Pix",
                    "Cartão de crédito",
                    "Cartão de débito",
                    "Dinheiro",
                    "Transferência",
                  ]}
                  value={s.payment}
                  onChange={(event) => set({ payment: event.target.value })}
                />
                <div role="group" aria-label="Situação do pagamento" className="flex gap-2">
                  {([true, false] as const).map((paid) => (
                    <button
                      key={String(paid)}
                      type="button"
                      aria-pressed={s.paidNow === paid}
                      onClick={() => set({ paidNow: paid })}
                      className={cn(
                        "min-h-11 flex-1 rounded-full border px-3.5 text-[13.5px]",
                        s.paidNow === paid
                          ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                          : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                      )}
                    >
                      {paid ? "Pago agora" : "A receber"}
                    </button>
                  ))}
                </div>
                {!s.paidNow ? (
                  <Input
                    label="Vencimento da cobrança"
                    type="date"
                    value={s.dueDate}
                    onChange={(event) => set({ dueDate: event.target.value })}
                    hint="A cliente é avisada 3 dias antes e pode informar quando pagar."
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => go(step - 1)}
              disabled={step === 0}
            >
              <Icon name="ChevronLeft" size={18} /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => go(step + 1)}>
                Avançar <Icon name="ChevronRight" size={18} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="tech"
                disabled={!s.procedures.length}
                onClick={() => setClosing(true)}
              >
                <Icon name="Check" size={18} /> Finalizar atendimento
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-[13.5px]",
        strong ? "font-medium" : "text-[var(--text-secondary)]",
      )}
    >
      <span>{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
