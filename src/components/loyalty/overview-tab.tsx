import { useEffect, useState } from "react";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { MetricCard } from "@/components/eb/metric-card";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { clientsDb } from "@/data/db";
import { awardManual, type LoyaltyAdmin } from "@/services/loyalty.service";
import { heading, card } from "@/components/loyalty/styles";

// ---------------------------------------------------------------- visão geral
export function Overview({
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
