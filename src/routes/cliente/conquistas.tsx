import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { useClient } from "@/lib/use-client";
import { useRemote } from "@/lib/use-remote";
import { cn } from "@/lib/utils";
import {
  CRITERIA_LABEL,
  EVENT_LABEL,
  cancelMyRedeem,
  loadMyLoyalty,
  loadMyRewards,
  loadRanking,
  requestRedeem,
  STATUS_LABEL,
  setRankingOptin,
  type MyBadge,
} from "@/services/loyalty.service";

export const Route = createFileRoute("/cliente/conquistas")({
  head: () => ({ meta: [{ title: "Minhas conquistas — EstetBoost." }] }),
  component: ConquistasPage,
});

const heading =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

function Badge({ badge }: { badge: MyBadge }) {
  const earned = badge.earned;
  const pct =
    !earned && badge.threshold > 0 && badge.progress !== null
      ? Math.round((badge.progress / badge.threshold) * 100)
      : 0;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 rounded-[var(--radius-lg)] border p-3.5 text-center",
        earned
          ? "border-[var(--eb-amber-500)]/50 bg-[var(--surface-card)]"
          : "border-[var(--border-hairline)] bg-transparent",
      )}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          earned
            ? "bg-[color-mix(in_srgb,var(--eb-amber-500)_20%,transparent)] text-[var(--eb-amber-500)]"
            : "bg-[var(--eb-ivory-a06)] text-muted-foreground opacity-60",
        )}
      >
        <Icon name={earned ? badge.icon : "Lock"} size={24} />
      </span>
      <span className="break-words text-[13px] font-medium leading-tight">{badge.name}</span>
      {earned ? (
        <span className="text-[11px] text-muted-foreground">
          {badge.earned_at
            ? `desde ${new Date(badge.earned_at).toLocaleDateString("pt-BR")}`
            : "conquistado"}
        </span>
      ) : badge.criteria === "manual" ? (
        <span className="text-[11px] text-muted-foreground">entregue pela clínica</span>
      ) : (
        <div className="flex w-full flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--eb-ivory-a10)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--eb-amber-500)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="break-words text-[11px] leading-tight text-muted-foreground">
            {badge.progress ?? 0} de {badge.threshold} {CRITERIA_LABEL[badge.criteria]}
          </span>
        </div>
      )}
    </div>
  );
}

function ConquistasPage() {
  const { openNotifications, unread } = useShell();
  const { profile } = useClient();
  const mine = useRemote(loadMyLoyalty);
  const ranking = useRemote(loadRanking);
  const rewards = useRemote(loadMyRewards);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reloadAll = () => void Promise.all([mine.reload(), ranking.reload(), rewards.reload()]);
  const data = mine.data;

  const topBar = (
    <TopBar
      title="Conquistas"
      context="Pontos, selos e nível"
      notifications={unread}
      user={profile}
      onNotifications={openNotifications}
    />
  );

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <p className="text-[13px] text-muted-foreground">
          {mine.error ?? (mine.loading ? "Carregando…" : "")}
        </p>
      </div>
    );
  }
  if (!data.enabled) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <EmptyState
          icon="Trophy"
          title="Programa de fidelidade"
          description="Sua clínica ainda não ativou pontos e selos. Quando ativar, eles aparecem aqui."
        />
      </div>
    );
  }

  const base = data.level?.min ?? 0;
  const span = data.next ? data.next.min - base : 0;
  const pct =
    data.next && span > 0 ? Math.min(100, Math.round(((data.earned - base) / span) * 100)) : 100;
  const prizes = rewards.data && rewards.data.enabled ? rewards.data : null;
  const redeem = async (id: string) => {
    setBusy(true);
    const result = await requestRedeem(id);
    setBusy(false);
    if (!result.ok) return setToast(result.message);
    setToast("Pedido enviado. A clínica responde em breve.");
    reloadAll();
  };
  const cancelRedeem = async (id: string) => {
    const result = await cancelMyRedeem(id);
    if (result.ok) {
      setToast("Pedido cancelado");
      reloadAll();
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    const result = await setRankingOptin(true, nick);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setToast("Você entrou no ranking");
    reloadAll();
  };
  const leave = async () => {
    setBusy(true);
    const result = await setRankingOptin(false, "");
    setBusy(false);
    if (result.ok) {
      setToast("Você saiu do ranking");
      reloadAll();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {topBar}

      <section
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] p-[18px]"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--eb-amber-500)]">
              Seu nível
            </span>
            <div className="mt-1 text-[26px] font-bold leading-tight">
              {data.level?.name ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[30px] font-medium leading-none">{data.points}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">pontos</div>
          </div>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--eb-ivory-a10)]" aria-hidden>
          <div
            className="h-full rounded-full bg-[var(--eb-amber-500)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {data.next
            ? `Faltam ${data.next.remaining} pontos para o nível ${data.next.name}.`
            : "Você chegou ao nível mais alto. Parabéns!"}
        </p>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className={heading}>
          Selos · {data.badges.filter((b) => b.earned).length} de {data.badges.length}
        </span>
        {data.badges.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
            {data.badges.map((badge) => (
              <Badge key={badge.id} badge={badge} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhum selo disponível ainda.</p>
        )}
      </section>

      {prizes && (prizes.rewards.length || prizes.requests.length) ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-2">
            <span className={`${heading} flex-1`}>Prêmios</span>
            <span className="font-mono text-[12.5px] text-[var(--eb-amber-500)]">
              {prizes.available} pontos disponíveis
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2.5">
            {prizes.rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5"
              >
                <div className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[14.5px] font-medium">
                      {reward.name}
                    </span>
                    {reward.description ? (
                      <span className="mt-0.5 block break-words text-[12.5px] text-[var(--text-secondary)]">
                        {reward.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-none font-mono text-[14px] text-[var(--eb-amber-500)]">
                    {reward.cost}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                  {reward.valid_until ? (
                    <span>
                      até {new Date(`${reward.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                  {reward.remaining !== null ? (
                    <span>{reward.remaining === 1 ? "resta 1" : `restam ${reward.remaining}`}</span>
                  ) : null}
                </div>
                {reward.pending ? (
                  <span className="text-[12.5px] text-[var(--eb-amber-500)]">
                    Pedido enviado, aguardando a clínica
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={reward.can_redeem ? "tech" : "secondary"}
                    disabled={busy || !reward.can_redeem}
                    className="self-start"
                    onClick={() => void redeem(reward.id)}
                  >
                    <Icon name="Gift" size={15} />{" "}
                    {reward.can_redeem
                      ? "Resgatar"
                      : `Faltam ${reward.cost - prizes.available} pontos`}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {prizes.requests.length ? (
            <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-1">
              {prizes.requests.map((request) => (
                <div
                  key={request.id}
                  className="flex min-h-12 items-center gap-3 border-b border-[var(--border-hairline)] py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[13.5px]">{request.reward}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {STATUS_LABEL[request.status]} · {timeAgo(request.at)}
                    </span>
                  </span>
                  {request.status === "pendente" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void cancelRedeem(request.id)}
                    >
                      Cancelar
                    </Button>
                  ) : (
                    <span className="flex-none font-mono text-[12.5px] text-muted-foreground">
                      {request.cost}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {data.ranking.enabled ? (
        <section className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4">
          <span className={heading}>Ranking da clínica</span>
          {data.ranking.optin ? (
            <>
              <p className="text-[13px] text-[var(--text-secondary)]">
                Você aparece como{" "}
                <strong className="text-foreground">{data.ranking.nickname}</strong>
                {data.ranking.position ? ` · ${data.ranking.position}º lugar` : ""}. Só o apelido, a
                posição e os pontos ficam visíveis para as outras clientes.
              </p>
              <div className="flex flex-col">
                {(ranking.data ?? []).map((row) => (
                  <div
                    key={`${row.position}-${row.nickname}`}
                    className={cn(
                      "flex min-h-11 items-center gap-3 border-b border-[var(--border-hairline)] py-1.5 last:border-b-0",
                      row.me && "font-medium text-foreground",
                    )}
                  >
                    <span className="w-8 flex-none text-center font-mono text-[13px] text-[var(--eb-amber-500)]">
                      {row.position}º
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">
                      {row.nickname}
                      {row.me ? " (você)" : ""}
                    </span>
                    <span className="flex-none font-mono text-[13px]">{row.points}</span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={busy}
                onClick={() => void leave()}
              >
                Sair do ranking
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
                Participar é opcional. Você escolhe um apelido: ninguém vê seu nome, seus
                procedimentos nem valores. Só o apelido, a posição e os pontos aparecem para as
                outras participantes. Você pode sair quando quiser.
              </p>
              <Input
                label="Apelido no ranking"
                placeholder="Ex.: Aninha"
                value={nick}
                maxLength={24}
                error={error ?? undefined}
                onChange={(event) => setNick(event.target.value)}
              />
              <Button
                type="button"
                variant="tech"
                className="self-start"
                disabled={busy || nick.trim().length < 2}
                onClick={() => void join()}
              >
                <Icon name="Trophy" size={16} /> Participar do ranking
              </Button>
            </>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className={heading}>Como você ganha pontos</span>
        <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-1">
          {data.history.length ? (
            data.history.map((row, index) => (
              <div
                key={`${row.at}-${index}`}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--border-hairline)] py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13.5px]">
                    {EVENT_LABEL[row.event] ?? row.event}
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    {row.note ? `${row.note} · ` : ""}
                    {timeAgo(row.at)}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex-none font-mono text-[14px]",
                    row.points < 0 ? "text-[var(--eb-coral-500)]" : "text-[var(--eb-teal-500)]",
                  )}
                >
                  {row.points > 0 ? "+" : ""}
                  {row.points}
                </span>
              </div>
            ))
          ) : (
            <p className="py-3 text-[13px] text-muted-foreground">
              Seus pontos aparecem aqui: atendimento concluído, presença confirmada, retorno no
              prazo e mais.
            </p>
          )}
        </div>
      </section>
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
