import { useEffect, useState } from "react";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { clientsDb } from "@/data/db";
import { cn } from "@/lib/utils";
import {
  BADGE_ICONS,
  CRITERIA_LABEL,
  deleteBadge,
  grantBadge,
  saveBadge,
  type AdminBadge,
  type BadgeCriteria,
  type LoyaltyAdmin,
} from "@/services/loyalty.service";
import { card } from "@/components/loyalty/styles";

// ---------------------------------------------------------------- selos
export function Badges({
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
