import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { useRemote } from "@/lib/use-remote";
import { cn } from "@/lib/utils";
import {
  decideRedeem,
  deleteReward,
  loadRewardsAdmin,
  saveReward,
  STATUS_LABEL,
  type AdminReward,
  type RedeemStatus,
} from "@/services/loyalty.service";

const heading =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const card =
  "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4";

const statusColor: Record<RedeemStatus, string> = {
  pendente: "text-[var(--eb-amber-500)]",
  aprovado: "text-[var(--eb-teal-500)]",
  entregue: "text-[var(--eb-teal-500)]",
  recusado: "text-[var(--eb-coral-500)]",
  cancelado: "text-muted-foreground",
};

/** Fidelidade → Prêmios: o catálogo de prêmios (custo em pontos) e a fila de pedidos de resgate. */
export function RewardsTab({ onToast }: { onToast: (text: string) => void }) {
  const admin = useRemote(loadRewardsAdmin);
  const [editing, setEditing] = useState<AdminReward | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = admin.data;

  const decide = async (
    id: string,
    decision: "aprovar" | "recusar" | "entregar" | "cancelar",
    ok: string,
  ) => {
    setBusy(id);
    setError(null);
    const result = await decideRedeem(id, decision);
    setBusy(null);
    if (!result.ok) return setError(result.message);
    onToast(ok);
    void admin.reload();
  };

  if (!data)
    return (
      <p className="text-[13px] text-muted-foreground">
        {admin.error ?? (admin.loading ? "Carregando…" : "")}
      </p>
    );

  const pending = data.redemptions.filter((item) => item.status === "pendente");
  const history = data.redemptions.filter((item) => item.status !== "pendente");

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex items-center gap-3">
          <span className={`${heading} flex-1`}>
            Pedidos de resgate{pending.length ? ` · ${pending.length}` : ""}
          </span>
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            {error}
          </p>
        ) : null}
        {pending.length ? (
          pending.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--eb-amber-500)]/40 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[14.5px] font-medium">{item.client}</span>
                  <span className="block break-words text-[13px] text-[var(--text-secondary)]">
                    quer {item.reward} · {item.cost} pontos
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    saldo dela: {item.balance} pontos · {timeAgo(item.at)}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="tech"
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, "aprovar", "Resgate aprovado")}
                >
                  <Icon name="Check" size={15} /> Aprovar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, "recusar", "Resgate recusado")}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhum pedido esperando você.</p>
        )}
        {history.length ? (
          <>
            <span className={`${heading} mt-1`}>Histórico</span>
            {history.map((item) => (
              <div
                key={item.id}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--border-hairline)] py-1.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13.5px]">
                    {item.client} · {item.reward}
                  </span>
                  <span className={cn("block text-[11.5px]", statusColor[item.status])}>
                    {STATUS_LABEL[item.status]} · {timeAgo(item.decided_at ?? item.at)}
                  </span>
                </span>
                {item.status === "aprovado" ? (
                  <div className="flex flex-none gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy === item.id}
                      onClick={() => void decide(item.id, "entregar", "Marcado como entregue")}
                    >
                      Entregue
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy === item.id}
                      onClick={() =>
                        void decide(item.id, "cancelar", "Resgate cancelado, pontos devolvidos")
                      }
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className={`${heading} flex-1`}>Prêmios</span>
          <Button type="button" size="sm" onClick={() => setEditing("new")}>
            <Icon name="Plus" size={15} /> Novo prêmio
          </Button>
        </div>
        {data.rewards.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Crie prêmios para as clientes trocarem por pontos: um desconto, um brinde, uma sessão
            cortesia.
          </p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
          {data.rewards.map((reward) => (
            <button
              key={reward.id}
              type="button"
              onClick={() => setEditing(reward)}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-4 text-left",
                reward.active
                  ? "border-[var(--border-card)]"
                  : "border-[var(--border-hairline)] opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 break-words text-[15px] font-medium">
                  {reward.name}
                </span>
                <span className="flex-none font-mono text-[14px] text-[var(--eb-amber-500)]">
                  {reward.cost} pts
                </span>
              </div>
              {reward.description ? (
                <span className="break-words text-[12.5px] text-[var(--text-secondary)]">
                  {reward.description}
                </span>
              ) : null}
              <span className="text-[11.5px] text-muted-foreground">
                {reward.used} {reward.used === 1 ? "resgate" : "resgates"}
                {reward.quantity !== null ? ` de ${reward.quantity}` : ""}
                {reward.valid_until
                  ? ` · até ${new Date(`${reward.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : ""}
                {reward.active ? "" : " · desligado"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <RewardDrawer
        reward={editing}
        onClose={() => setEditing(null)}
        onDone={(text) => {
          setEditing(null);
          onToast(text);
          void admin.reload();
        }}
      />
    </div>
  );
}

function RewardDrawer({
  reward,
  onClose,
  onDone,
}: {
  reward: AdminReward | "new" | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const existing = reward && reward !== "new" ? reward : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("100");
  const [until, setUntil] = useState("");
  const [quantity, setQuantity] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setCost(String(existing?.cost ?? 100));
    setUntil(existing?.valid_until ?? "");
    setQuantity(
      existing?.quantity === null || existing?.quantity === undefined
        ? ""
        : String(existing.quantity),
    );
    setActive(existing?.active ?? true);
    setError(null);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward]);

  return (
    <Drawer
      open={Boolean(reward)}
      onClose={onClose}
      title={existing ? "Editar prêmio" : "Novo prêmio"}
      subtitle="A cliente vê em Conquistas e pede o resgate com os pontos dela"
      footer={
        <>
          {existing ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  const result = await deleteReward(existing.id);
                  if (!result.ok) return setError(result.message);
                  onDone("Prêmio removido");
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
            disabled={busy || !name.trim() || !Number(cost)}
            onClick={async () => {
              setBusy(true);
              const result = await saveReward({
                id: existing?.id ?? null,
                name,
                description,
                cost: Number(cost) || 0,
                valid_until: until || null,
                quantity: quantity === "" ? null : Number(quantity),
                active,
              });
              setBusy(false);
              if (!result.ok) return setError(result.message);
              onDone(existing ? "Prêmio atualizado" : "Prêmio criado");
            }}
          >
            <Icon name="Check" size={18} /> Salvar prêmio
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Nome do prêmio"
          placeholder="Ex.: Desconto de R$ 30"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Descrição (opcional)"
          multiline
          rows={2}
          value={description}
          maxLength={240}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Custo"
            trailing="pts"
            inputMode="numeric"
            value={cost}
            onChange={(event) => setCost(event.target.value.replace(/\D/g, ""))}
          />
          <Input
            label="Quantidade"
            placeholder="Sem limite"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))}
            hint="Deixe vazio para ilimitado."
          />
        </div>
        <Input
          label="Vale até (opcional)"
          type="date"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
        <label className="flex min-h-11 items-center gap-3">
          <span className="flex-1 text-[14px]">Prêmio ativo</span>
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
