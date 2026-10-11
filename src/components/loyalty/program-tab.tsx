import { useState } from "react";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Switch } from "@/components/eb/notifications-panel";
import { Button } from "@/components/ui/button";
import {
  loyaltyBackfill,
  saveLoyaltyConfig,
  type LoyaltyAdmin,
  type LoyaltyLevel,
  type LoyaltyPoints,
} from "@/services/loyalty.service";
import { heading, card } from "@/components/loyalty/styles";

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

// ---------------------------------------------------------------- programa
export function Program({
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
