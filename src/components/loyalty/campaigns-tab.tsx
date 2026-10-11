import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { card, heading } from "@/components/loyalty/styles";
import { Button } from "@/components/ui/button";
import {
  CAMPAIGN_TEMPLATES,
  describeSegment,
  previewText,
  SEGMENT_LABEL,
  SEGMENT_PARAM,
  unknownVariables,
  VARIABLES,
  type CampaignHref,
  type CampaignTemplate,
  type Segment,
  type SegmentType,
} from "@/lib/campaign-templates";
import { useRemote } from "@/lib/use-remote";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_LABEL,
  deleteCampaign,
  loadCampaignsAdmin,
  previewAudience,
  saveCampaign,
  saveCampaignLimits,
  sendCampaignNow,
  setCampaignStatus,
  type AdminCampaign,
  type CampaignStatus,
} from "@/services/loyalty.service";

const HREF_LABEL: Record<CampaignHref, string> = {
  "/cliente": "Início do app",
  "/cliente/agenda": "Agenda (marcar horário)",
  "/cliente/conquistas": "Conquistas (pontos e prêmios)",
  "/cliente/evolucao": "Evolução",
};
const statusTone: Record<CampaignStatus, string> = {
  rascunho: "text-muted-foreground",
  ativa: "text-[var(--eb-teal-500)]",
  pausada: "text-[var(--eb-amber-500)]",
  encerrada: "text-muted-foreground",
};

type Draft = {
  id: string | null;
  name: string;
  template: string;
  segment: Segment;
  title: string;
  body: string;
  href: CampaignHref;
  every_days: number;
  starts_on: string;
  ends_on: string;
  status: CampaignStatus;
};

const fromTemplate = (template: CampaignTemplate): Draft => ({
  id: null,
  name: template.name,
  template: template.id,
  segment: template.segment,
  title: template.title,
  body: template.body,
  href: template.href,
  every_days: template.everyDays,
  starts_on: "",
  ends_on: "",
  status: "rascunho",
});
const fromCampaign = (c: AdminCampaign): Draft => ({
  id: c.id,
  name: c.name,
  template: c.template,
  segment: c.segment,
  title: c.title,
  body: c.body,
  href: (c.href as CampaignHref) in HREF_LABEL ? (c.href as CampaignHref) : "/cliente",
  every_days: c.every_days,
  starts_on: c.starts_on ?? "",
  ends_on: c.ends_on ?? "",
  status: c.status,
});

/** Fidelidade → Campanhas: sugestões prontas, limites gerais e resultado de cada campanha. */
export function CampaignsTab({ onToast }: { onToast: (text: string) => void }) {
  const admin = useRemote(loadCampaignsAdmin);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const data = admin.data;

  if (!data)
    return (
      <p className="text-[13px] text-muted-foreground">
        {admin.error ?? (admin.loading ? "Carregando…" : "")}
      </p>
    );

  const act = async (id: string, work: () => Promise<{ ok: boolean }>, ok: string) => {
    setBusy(id);
    const result = await work();
    setBusy(null);
    if (result.ok) onToast(ok);
    void admin.reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Limits limits={data.limits} onToast={onToast} onSaved={() => void admin.reload()} />

      <section className="flex flex-col gap-3">
        <span className={heading}>Minhas campanhas</span>
        {data.campaigns.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Você ainda não tem campanhas. Escolha uma sugestão abaixo, ajuste o texto e ligue.
          </p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3">
          {data.campaigns.map((campaign) => (
            <div key={campaign.id} className={card}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-medium">{campaign.name}</span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {describeSegment(campaign.segment)}
                  </span>
                </span>
                <span
                  className={cn("flex-none text-[12px] font-medium", statusTone[campaign.status])}
                >
                  {CAMPAIGN_STATUS_LABEL[campaign.status]}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  ["Públicos", campaign.audience],
                  ["Enviadas", campaign.sent],
                  ["Lidas", campaign.read],
                  ["Marcaram", campaign.booked],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)] py-2"
                  >
                    <div className="font-mono text-[16px]">{value}</div>
                    <div className="text-[10.5px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {campaign.status === "ativa" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === campaign.id}
                    onClick={() =>
                      void act(
                        campaign.id,
                        () => setCampaignStatus(campaign.id, "pausada"),
                        "Campanha pausada",
                      )
                    }
                  >
                    Pausar
                  </Button>
                ) : campaign.status !== "encerrada" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="tech"
                    disabled={busy === campaign.id}
                    onClick={() =>
                      void act(
                        campaign.id,
                        () => setCampaignStatus(campaign.id, "ativa"),
                        "Campanha ligada",
                      )
                    }
                  >
                    Ligar
                  </Button>
                ) : null}
                {campaign.status !== "encerrada" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === campaign.id}
                    onClick={async () => {
                      setBusy(campaign.id);
                      const result = await sendCampaignNow(campaign.id);
                      setBusy(null);
                      onToast(
                        result.ok
                          ? result.sent
                            ? `Enviada para ${result.sent} ${result.sent === 1 ? "cliente" : "clientes"}`
                            : "Ninguém para receber agora (público vazio, limite da semana ou já recebeu)"
                          : result.message,
                      );
                      void admin.reload();
                    }}
                  >
                    <Icon name="Send" size={14} /> Enviar agora
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDraft(fromCampaign(campaign))}
                >
                  Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className={heading}>Sugestões</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
          {CAMPAIGN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setDraft(fromTemplate(template))}
              className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] p-4 text-left active:bg-[var(--eb-ivory-a06)]"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-9 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--eb-coral-500)_16%,transparent)] text-[var(--eb-coral-500)]">
                  <Icon name={template.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1 break-words text-[14.5px] font-medium">
                  {template.name}
                </span>
              </span>
              <span className="break-words text-[12.5px] text-[var(--text-secondary)]">
                {template.goal}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {describeSegment(template.segment)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <CampaignDrawer
        draft={draft}
        loyaltyEnabled={data.loyalty_enabled}
        onClose={() => setDraft(null)}
        onDone={(text) => {
          setDraft(null);
          onToast(text);
          void admin.reload();
        }}
      />
    </div>
  );
}

function Limits({
  limits,
  onToast,
  onSaved,
}: {
  limits: { max_per_week: number; from: string; to: string };
  onToast: (text: string) => void;
  onSaved: () => void;
}) {
  const [max, setMax] = useState(String(limits.max_per_week));
  const [from, setFrom] = useState(limits.from);
  const [to, setTo] = useState(limits.to);
  const [error, setError] = useState<string | null>(null);
  const dirty = Number(max) !== limits.max_per_week || from !== limits.from || to !== limits.to;
  return (
    <section className={card}>
      <span className={heading}>Limites para não incomodar</span>
      <p className="-mt-1.5 text-xs text-muted-foreground">
        Valem para todas as campanhas. Quem desligou “Campanhas e novidades” no app nunca recebe.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
        <Input
          label="Máx. por cliente na semana"
          inputMode="numeric"
          value={max}
          onChange={(event) => setMax(event.target.value.replace(/\D/g, ""))}
          hint="0 pausa todas"
        />
        <Input
          label="Enviar a partir de"
          type="time"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Input
          label="Enviar até"
          type="time"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="self-start"
        disabled={!dirty}
        onClick={async () => {
          const result = await saveCampaignLimits(Number(max) || 0, from, to);
          if (!result.ok) return setError(result.message);
          setError(null);
          onToast("Limites salvos");
          onSaved();
        }}
      >
        Salvar limites
      </Button>
    </section>
  );
}

function CampaignDrawer({
  draft,
  loyaltyEnabled,
  onClose,
  onDone,
}: {
  draft: Draft | null;
  loyaltyEnabled: boolean;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [form, setForm] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{
    count: number;
    blocked: number;
    sample: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(draft);
    setPreview(null);
    setError(null);
    setConfirmDelete(false);
  }, [draft]);

  if (!form) return <Drawer open={false} onClose={onClose} title="" children={null} />;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  const param = SEGMENT_PARAM[form.segment.type];
  const unknown = unknownVariables(`${form.title} ${form.body}`);
  const needsLoyalty =
    (form.segment.type === "near_reward" || form.segment.type === "near_level") && !loyaltyEnabled;

  const save = async (status: CampaignStatus) => {
    if (!form.name.trim() || !form.title.trim())
      return setError("Dê um nome e escreva o título do aviso.");
    setBusy(true);
    setError(null);
    const result = await saveCampaign({
      id: form.id,
      name: form.name,
      template: form.template,
      segment: form.segment,
      title: form.title,
      body: form.body,
      href: form.href,
      status,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      every_days: form.every_days,
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone(status === "ativa" ? "Campanha ligada" : "Campanha salva");
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={form.id ? "Editar campanha" : "Nova campanha"}
      subtitle="Você decide quem recebe, o texto e quando"
      width={520}
      footer={
        <>
          {form.id ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  const result = await deleteCampaign(form.id as string);
                  if (!result.ok) return setError(result.message);
                  onDone("Campanha removida");
                }}
              >
                Confirmar
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Icon name="Trash2" size={16} />
              </Button>
            )
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void save(form.status === "ativa" ? "ativa" : "rascunho")}
          >
            Salvar
          </Button>
          <Button
            type="button"
            variant="tech"
            className="flex-1"
            disabled={busy || needsLoyalty}
            onClick={() => void save("ativa")}
          >
            <Icon name="Check" size={18} /> Salvar e ligar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Nome (só você vê)"
          value={form.name}
          maxLength={60}
          onChange={(event) => set("name", event.target.value)}
        />

        <span className={heading}>Quem recebe</span>
        <Select
          label="Público"
          options={Object.values(SEGMENT_LABEL)}
          value={SEGMENT_LABEL[form.segment.type]}
          onChange={(event) => {
            const type = (Object.keys(SEGMENT_LABEL) as SegmentType[]).find(
              (key) => SEGMENT_LABEL[key] === event.target.value,
            );
            if (type) {
              set("segment", {
                type,
                days:
                  SEGMENT_PARAM[type].field === "days" ? Math.max(SEGMENT_PARAM[type].min, 14) : 0,
                points: SEGMENT_PARAM[type].field === "points" ? 40 : 0,
              });
              setPreview(null);
            }
          }}
        />
        {param.field ? (
          <Input
            label={param.label}
            inputMode="numeric"
            hint={param.hint}
            value={String(form.segment[param.field])}
            onChange={(event) => {
              set("segment", {
                ...form.segment,
                [param.field as "days" | "points"]:
                  Number(event.target.value.replace(/\D/g, "")) || 0,
              });
              setPreview(null);
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{param.hint}</p>
        )}
        {needsLoyalty ? (
          <p className="text-[12.5px] text-[var(--eb-amber-500)]">
            Esse público usa pontos. Ligue o programa em “Programa” antes de ligar a campanha.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--eb-ivory-a06)] p-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={async () => {
              const result = await previewAudience(form.segment);
              if (!result.ok) return setError(result.message);
              setError(null);
              setPreview({ count: result.count, blocked: result.blocked, sample: result.sample });
            }}
          >
            Ver quantas receberiam
          </Button>
          {preview ? (
            <p className="text-[13px]">
              <strong>{preview.count}</strong>{" "}
              {preview.count === 1 ? "cliente receberia" : "clientes receberiam"}
              {preview.sample.length
                ? ` (${preview.sample.join(", ")}${preview.count > preview.sample.length ? "…" : ""})`
                : ""}
              .{preview.blocked ? ` ${preview.blocked} já estão no limite da semana.` : ""} Só
              entram clientes com acesso ao app.
            </p>
          ) : null}
        </div>

        <span className={heading}>O aviso</span>
        <Input
          label="Título"
          value={form.title}
          maxLength={60}
          onChange={(event) => set("title", event.target.value)}
        />
        <Input
          label="Texto"
          multiline
          rows={3}
          value={form.body}
          maxLength={200}
          onChange={(event) => set("body", event.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((variable) => (
            <button
              key={variable.key}
              type="button"
              title={variable.hint}
              onClick={() =>
                set(
                  "body",
                  `${form.body}${form.body && !form.body.endsWith(" ") ? " " : ""}${variable.key}`.slice(
                    0,
                    200,
                  ),
                )
              }
              className="min-h-9 rounded-full border border-dashed border-[var(--border-hairline)] px-3 text-[12px] text-[var(--text-secondary)]"
            >
              + {variable.label}
            </button>
          ))}
        </div>
        {unknown.length ? (
          <p className="text-[12.5px] text-[var(--eb-coral-500)]">
            Não conheço: {unknown.join(", ")}. Use só as variáveis acima.
          </p>
        ) : null}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Como a cliente vê
          </span>
          <div className="mt-1.5 break-words text-[14.5px] font-semibold">
            {previewText(form.title) || "—"}
          </div>
          <div className="mt-0.5 break-words text-[13px] text-[var(--text-secondary)]">
            {previewText(form.body)}
          </div>
        </div>
        <Select
          label="Ao tocar, abre"
          options={Object.values(HREF_LABEL)}
          value={HREF_LABEL[form.href]}
          onChange={(event) => {
            const href = (Object.keys(HREF_LABEL) as CampaignHref[]).find(
              (key) => HREF_LABEL[key] === event.target.value,
            );
            if (href) set("href", href);
          }}
        />

        <span className={heading}>Quando</span>
        <Input
          label="Não repetir para a mesma cliente por (dias)"
          inputMode="numeric"
          value={String(form.every_days)}
          onChange={(event) =>
            set(
              "every_days",
              Math.min(365, Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1)),
            )
          }
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Começa em (opcional)"
            type="date"
            value={form.starts_on}
            onChange={(event) => set("starts_on", event.target.value)}
          />
          <Input
            label="Termina em (opcional)"
            type="date"
            value={form.ends_on}
            min={form.starts_on || undefined}
            onChange={(event) => set("ends_on", event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
