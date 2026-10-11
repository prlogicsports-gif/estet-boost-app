import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { MetricCard } from "@/components/eb/metric-card";
import { Switch } from "@/components/eb/notifications-panel";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { Select } from "@/components/eb/select";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { Button } from "@/components/ui/button";
import { clientsDb } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { useRemote } from "@/lib/use-remote";
import { cn } from "@/lib/utils";
import {
  awardManual,
  BADGE_ICONS,
  CRITERIA_LABEL,
  deleteBadge,
  grantBadge,
  loadLoyaltyAdmin,
  loyaltyBackfill,
  saveBadge,
  saveLoyaltyConfig,
  type AdminBadge,
  type BadgeCriteria,
  type LoyaltyAdmin,
  type LoyaltyLevel,
  type LoyaltyPoints,
} from "@/services/loyalty.service";

export const Route = createFileRoute("/_gestor/fidelidade")({
  head: () => ({
    meta: [
      { title: "Fidelidade — EstetBoost." },
      {
        name: "description",
        content: "Pontos, níveis, selos e ranking das suas clientes, definidos por você.",
      },
    ],
  }),
  component: FidelidadePage,
});

type Tab = "geral" | "programa" | "selos";
const heading =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const card =
  "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4";

const POINT_ROWS: { key: keyof LoyaltyPoints; label: string; hint: string; unit: string }[] = [
  {
    key: "session_done",
    label: "Atendimento concluído",
    hint: "Cada atendimento finalizado",
    unit: "pts",
  },
  {
    key: "first_visit",
    label: "Primeira visita",
    hint: "Bônus no primeiro atendimento",
    unit: "pts",
  },
  {
    key: "return_on_time",
    label: "Retorno no prazo",
    hint: "Voltou dentro do prazo abaixo",
    unit: "pts",
  },
  {
    key: "confirmed",
    label: "Presença confirmada",
    hint: "Confirmou o horário no app",
    unit: "pts",
  },
  { key: "signup", label: "Cadastro no app", hint: "Quando ela cria a conta", unit: "pts" },
];

function FidelidadePage() {
  const pro = usePro();
  const admin = useRemote(loadLoyaltyAdmin);
  const [tab, setTab] = useState<Tab>("geral");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const data = admin.data;
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Fidelidade" context="Pontos, selos e ranking das clientes" user={pro} />
      {!data ? (
        <p className="text-[13px] text-muted-foreground">
          {admin.error ?? (admin.loading ? "Carregando…" : "")}
        </p>
      ) : (
        <>
          {!data.config.enabled ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--eb-amber-500)]/40 bg-[var(--surface-card)] p-4">
              <Icon name="Trophy" size={20} color="var(--eb-amber-500)" />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">O programa está desligado</div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  Ligue em “Programa” para as clientes começarem a ganhar pontos e selos. Você
                  escolhe quanto vale cada coisa.
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => setTab("programa")}>
                Configurar
              </Button>
            </div>
          ) : null}
          <SegmentedTabs<Tab>
            size="sm"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "geral", label: "Visão geral" },
              { id: "programa", label: "Programa" },
              { id: "selos", label: "Selos" },
            ]}
            className="max-w-md"
          />
          {tab === "geral" ? (
            <Overview data={data} onToast={setToast} onChanged={() => void admin.reload()} />
          ) : null}
          {tab === "programa" ? (
            <Program data={data} onToast={setToast} onSaved={() => void admin.reload()} />
          ) : null}
          {tab === "selos" ? (
            <Badges data={data} onToast={setToast} onChanged={() => void admin.reload()} />
          ) : null}
        </>
      )}
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}

// ---------------------------------------------------------------- visão geral
function Overview({
  data,
  onToast,
  onChanged,
}: {
  data: LoyaltyAdmin;
  onToast: (text: string) => void;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const o = data.overview;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricCard label="Clientes" value={o.clients} icon="Users" />
        <MetricCard
          label="Com pontos"
          value={o.participants}
          hint="já participam"
          icon="Trophy"
          tone="tech"
        />
        <MetricCard label="Pontos dados" value={o.points_issued} icon="Gift" />
        <MetricCard
          label="No ranking"
          value={o.ranking_members}
          hint={data.config.ranking_enabled ? "por escolha delas" : "ranking desligado"}
          icon="Crown"
        />
      </div>
      <section className={card}>
        <span className={heading}>Quem mais pontua</span>
        {o.top.length ? (
          <div className="flex flex-col">
            {o.top.map((row, index) => (
              <div
                key={row.client_id}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--border-hairline)] py-1.5 last:border-b-0"
              >
                <span className="w-7 flex-none text-center font-mono text-[13px] text-[var(--eb-amber-500)]">
                  {index + 1}º
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{row.name}</span>
                <span className="flex-none font-mono text-[13px]">{row.points}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setTarget({ id: row.client_id, name: row.name })}
                >
                  Ajustar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Ninguém pontuou ainda. Os pontos aparecem quando as clientes concluírem atendimentos.
          </p>
        )}
        <ManualAward
          onToast={onToast}
          onDone={onChanged}
          target={target}
          onTarget={setTarget}
          enabled={data.config.enabled}
        />
      </section>
    </div>
  );
}

function ManualAward({
  target,
  onTarget,
  onToast,
  onDone,
  enabled,
}: {
  target: { id: string; name: string } | null;
  onTarget: (next: { id: string; name: string } | null) => void;
  onToast: (text: string) => void;
  onDone: () => void;
  enabled: boolean;
}) {
  const clients = clientsDb.use();
  const [points, setPoints] = useState("10");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  useEffect(() => {
    if (target) setOpen(true);
  }, [target]);

  const chosen = target ?? clients.find((item) => item.name === pick) ?? null;
  const close = () => {
    setOpen(false);
    onTarget(null);
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={!enabled}
        onClick={() => setOpen(true)}
      >
        <Icon name="Plus" size={15} /> Dar ou tirar pontos
      </Button>
      <Drawer
        open={open}
        onClose={close}
        title="Ajustar pontos"
        subtitle="Fica registrado no histórico da cliente"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="tech"
              className="flex-1"
              disabled={busy || !chosen || !Number(points)}
              onClick={async () => {
                if (!chosen) return;
                setBusy(true);
                const result = await awardManual(chosen.id, Number(points), note);
                setBusy(false);
                if (!result.ok) return setError(result.message);
                onToast(`${Number(points) > 0 ? "+" : ""}${points} pontos para ${chosen.name}`);
                close();
                onDone();
              }}
            >
              <Icon name="Check" size={18} /> Salvar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {target ? (
            <div className="text-[15px] font-medium">{target.name}</div>
          ) : (
            <Select
              label="Cliente"
              options={["Escolher…", ...clients.map((item) => item.name)]}
              value={pick || "Escolher…"}
              onChange={(event) =>
                setPick(event.target.value === "Escolher…" ? "" : event.target.value)
              }
            />
          )}
          <Input
            label="Pontos (use sinal de menos para tirar)"
            inputMode="numeric"
            value={points}
            onChange={(event) => setPoints(event.target.value.replace(/[^\d-]/g, ""))}
          />
          <Input
            label="Motivo (a cliente vê)"
            placeholder="Ex.: indicou uma amiga"
            value={note}
            maxLength={120}
            onChange={(event) => setNote(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
              {error}
            </p>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------- programa
function Program({
  data,
  onToast,
  onSaved,
}: {
  data: LoyaltyAdmin;
  onToast: (text: string) => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(data.config.enabled);
  const [ranking, setRanking] = useState(data.config.ranking_enabled);
  const [points, setPoints] = useState<LoyaltyPoints>(data.config.points);
  const [levels, setLevels] = useState<LoyaltyLevel[]>(data.config.levels);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPoint = (key: keyof LoyaltyPoints, value: string) =>
    setPoints((current) => ({ ...current, [key]: Number(value.replace(/\D/g, "")) || 0 }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await saveLoyaltyConfig({
      enabled,
      ranking_enabled: ranking,
      points,
      levels: levels.filter((item) => item.name.trim()),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onToast("Programa salvo");
    onSaved();
  };

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Programa de fidelidade</span>
            <span className="block text-xs text-muted-foreground">
              Ligado: as clientes ganham pontos, selos e sobem de nível.
            </span>
          </span>
          <Switch
            checked={enabled}
            onChange={() => setEnabled((value) => !value)}
            label="Programa de fidelidade"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Ranking entre clientes</span>
            <span className="block text-xs text-muted-foreground">
              Opcional para elas, só com apelido. Desligar apaga os apelidos.
            </span>
          </span>
          <Switch
            checked={ranking}
            onChange={() => setRanking((value) => !value)}
            label="Ranking entre clientes"
          />
        </div>
      </section>

      <section className={card}>
        <span className={heading}>Quanto vale cada coisa</span>
        {POINT_ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px]">{row.label}</span>
              <span className="block text-xs text-muted-foreground">{row.hint}</span>
            </span>
            <Input
              aria-label={row.label}
              className="w-28"
              trailing={row.unit}
              inputMode="numeric"
              value={String(points[row.key])}
              onChange={(event) => setPoint(row.key, event.target.value)}
            />
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px]">Prazo do retorno</span>
            <span className="block text-xs text-muted-foreground">
              Para valer “retorno no prazo”
            </span>
          </span>
          <Input
            aria-label="Prazo do retorno em dias"
            className="w-28"
            trailing="dias"
            inputMode="numeric"
            value={String(points.return_days)}
            onChange={(event) => setPoint("return_days", event.target.value)}
          />
        </div>
      </section>

      <section className={card}>
        <span className={heading}>Níveis</span>
        <p className="-mt-1.5 text-xs text-muted-foreground">
          O nível sobe quando a cliente chega nos pontos indicados. O primeiro sempre começa em 0.
        </p>
        {levels.map((level, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Nome do nível ${index + 1}`}
              className="min-w-0 flex-1"
              placeholder="Nome"
              value={level.name}
              maxLength={24}
              onChange={(event) =>
                setLevels((list) =>
                  list.map((item, i) =>
                    i === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`Pontos do nível ${index + 1}`}
              className="w-28"
              trailing="pts"
              inputMode="numeric"
              disabled={index === 0}
              value={String(index === 0 ? 0 : level.min)}
              onChange={(event) =>
                setLevels((list) =>
                  list.map((item, i) =>
                    i === index
                      ? { ...item, min: Number(event.target.value.replace(/\D/g, "")) || 0 }
                      : item,
                  ),
                )
              }
            />
            <IconButton
              icon="Trash2"
              label="Remover nível"
              size={40}
              disabled={levels.length <= 1}
              onClick={() => setLevels((list) => list.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        {levels.length < 8 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() =>
              setLevels((list) => [
                ...list,
                { id: `n${list.length}`, name: "", min: (list.at(-1)?.min ?? 0) + 200 },
              ])
            }
          >
            <Icon name="Plus" size={15} /> Novo nível
          </Button>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="tech" disabled={busy} onClick={() => void save()}>
          <Icon name="Check" size={18} /> {busy ? "Salvando…" : "Salvar programa"}
        </Button>
        {data.config.enabled ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await loyaltyBackfill();
              setBusy(false);
              if (!result.ok) return setError(result.message);
              onToast(
                result.created
                  ? `${result.created} lançamentos criados a partir do que já aconteceu`
                  : "Nada novo para calcular",
              );
              onSaved();
            }}
          >
            Calcular pontos do que já aconteceu
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Os pontos só passam a valer depois que o programa estiver ligado e salvo. “Calcular pontos
        do que já aconteceu” soma atendimentos finalizados e cadastros antigos, sem duplicar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- selos
function Badges({
  data,
  onToast,
  onChanged,
}: {
  data: LoyaltyAdmin;
  onToast: (text: string) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminBadge | "new" | null>(null);
  const [granting, setGranting] = useState<AdminBadge | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" size="sm" className="self-start" onClick={() => setEditing("new")}>
        <Icon name="Plus" size={15} /> Novo selo
      </Button>
      {data.badges.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Os selos padrão aparecem quando você liga o programa.
        </p>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
        {data.badges.map((badge) => (
          <div
            key={badge.id}
            className={cn(
              "flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-4",
              badge.active
                ? "border-[var(--border-card)]"
                : "border-[var(--border-hairline)] opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--eb-amber-500)_18%,transparent)] text-[var(--eb-amber-500)]">
                <Icon name={badge.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[14.5px] font-medium">{badge.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {badge.criteria === "manual"
                    ? "Entregue por você"
                    : `${badge.threshold} ${CRITERIA_LABEL[badge.criteria]}`}
                  {badge.active ? "" : " · desligado"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">
                {badge.earned_by} {badge.earned_by === 1 ? "cliente" : "clientes"}
              </span>
              {badge.criteria === "manual" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setGranting(badge)}
                >
                  Entregar
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(badge)}>
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>
      <BadgeDrawer
        badge={editing}
        onClose={() => setEditing(null)}
        onDone={(text) => {
          setEditing(null);
          onToast(text);
          onChanged();
        }}
      />
      <GrantDrawer
        badge={granting}
        onClose={() => setGranting(null)}
        onDone={(text) => {
          setGranting(null);
          onToast(text);
          onChanged();
        }}
      />
    </div>
  );
}

const CRITERIA_OPTIONS: BadgeCriteria[] = [
  "sessions_count",
  "confirmed_count",
  "points_total",
  "streak",
  "manual",
];

function BadgeDrawer({
  badge,
  onClose,
  onDone,
}: {
  badge: AdminBadge | "new" | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("Star");
  const [criteria, setCriteria] = useState<BadgeCriteria>("sessions_count");
  const [threshold, setThreshold] = useState("5");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = badge && badge !== "new" ? badge : null;

  useEffect(() => {
    if (!badge) return;
    setName(existing?.name ?? "");
    setIcon(existing?.icon ?? "Star");
    setCriteria(existing?.criteria ?? "sessions_count");
    setThreshold(String(existing?.threshold || 5));
    setActive(existing?.active ?? true);
    setError(null);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge]);

  return (
    <Drawer
      open={Boolean(badge)}
      onClose={onClose}
      title={existing ? "Editar selo" : "Novo selo"}
      subtitle="Aparece em Conquistas, no app da cliente"
      footer={
        <>
          {existing ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  const result = await deleteBadge(existing.id);
                  if (!result.ok) return setError(result.message);
                  onDone("Selo removido");
                }}
              >
                Confirmar exclusão
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Icon name="Trash2" size={16} /> Excluir
              </Button>
            )
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            variant="tech"
            className="flex-1"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              const result = await saveBadge({
                id: existing?.id ?? null,
                name,
                icon,
                criteria,
                threshold: criteria === "manual" ? 0 : Number(threshold) || 0,
                active,
              });
              setBusy(false);
              if (!result.ok) return setError(result.message);
              onDone(existing ? "Selo atualizado" : "Selo criado");
            }}
          >
            <Icon name="Check" size={18} /> Salvar selo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Nome do selo"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-[var(--text-secondary)]">Ícone</span>
          <div className="flex flex-wrap gap-2">
            {BADGE_ICONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={item}
                aria-pressed={icon === item}
                onClick={() => setIcon(item)}
                className={cn(
                  "grid size-11 place-items-center rounded-full border",
                  icon === item
                    ? "border-[var(--eb-amber-500)] bg-[color-mix(in_srgb,var(--eb-amber-500)_20%,transparent)] text-[var(--eb-amber-500)]"
                    : "border-[var(--border-hairline)] text-[var(--text-secondary)]",
                )}
              >
                <Icon name={item} size={19} />
              </button>
            ))}
          </div>
        </div>
        <Select
          label="Como se ganha"
          options={CRITERIA_OPTIONS.map((item) => CRITERIA_LABEL[item])}
          value={CRITERIA_LABEL[criteria]}
          onChange={(event) =>
            setCriteria(
              CRITERIA_OPTIONS.find((item) => CRITERIA_LABEL[item] === event.target.value) ??
                "manual",
            )
          }
        />
        {criteria !== "manual" ? (
          <Input
            label={`Quantos (${CRITERIA_LABEL[criteria]})`}
            inputMode="numeric"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value.replace(/\D/g, ""))}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Selo manual: só você entrega, para a cliente que merecer.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3">
          <span className="flex-1 text-[14px]">Selo ativo</span>
          <input
            type="checkbox"
            checked={active}
            onChange={() => setActive((value) => !value)}
            className="size-5 accent-[var(--teal)]"
          />
        </label>
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}

function GrantDrawer({
  badge,
  onClose,
  onDone,
}: {
  badge: AdminBadge | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const clients = clientsDb.use();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = clients.find((item) => item.name === pick);
  useEffect(() => {
    if (badge) {
      setPick("");
      setError(null);
    }
  }, [badge]);
  return (
    <Drawer
      open={Boolean(badge)}
      onClose={onClose}
      title={badge ? `Entregar “${badge.name}”` : ""}
      subtitle="A cliente recebe um aviso"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="tech"
            className="flex-1"
            disabled={!chosen || !badge}
            onClick={async () => {
              if (!chosen || !badge) return;
              const result = await grantBadge(badge.id, chosen.id);
              if (!result.ok) return setError(result.message);
              onDone(`Selo entregue para ${chosen.name}`);
            }}
          >
            <Icon name="Gift" size={18} /> Entregar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Select
          label="Cliente"
          options={["Escolher…", ...clients.map((item) => item.name)]}
          value={pick || "Escolher…"}
          onChange={(event) =>
            setPick(event.target.value === "Escolher…" ? "" : event.target.value)
          }
        />
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
