import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { stockDb } from "@/data/db";
import type { ProcedureRec } from "@/lib/models";
import { brl } from "@/lib/view";
import { removeProcedure, saveProcedure } from "@/services/sessions.service";

type Used = { stockId: string; qty: number };
const PICK = "Escolher produto…";

/** Custo estimado dos produtos de um procedimento (custo por unidade × quantidade). */
export function productsCost(products: Used[] | undefined) {
  const stock = stockDb.get();
  return (products ?? []).reduce(
    (sum, item) => sum + item.qty * (stock.find((entry) => entry.id === item.stockId)?.cost ?? 0),
    0,
  );
}

/** Criar ou editar um procedimento do catálogo: valor, duração, retorno e produtos usados. */
export function ProcedureDrawer({
  open,
  procedure,
  onClose,
}: {
  open: boolean;
  procedure: ProcedureRec | null;
  onClose: (message?: string) => void;
}) {
  const stock = stockDb.use();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [returnDays, setReturnDays] = useState("14");
  const [products, setProducts] = useState<Used[]>([]);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(procedure?.name ?? "");
    setPrice(procedure ? String(procedure.price).replace(".", ",") : "");
    setDuration(String(procedure?.duration ?? 60));
    setReturnDays(String(procedure?.returnDays ?? 14));
    setProducts(procedure?.products ?? []);
    setTried(false);
    setConfirmDelete(false);
  }, [open, procedure]);

  const nameError = name.trim() ? undefined : "Informe o nome do procedimento.";
  const available = stock.filter((item) => !products.some((used) => used.stockId === item.id));
  const cost = products.reduce(
    (sum, item) => sum + item.qty * (stock.find((entry) => entry.id === item.stockId)?.cost ?? 0),
    0,
  );
  const priceNumber = Number(price.replace(/\./g, "").replace(",", ".")) || 0;

  const save = () => {
    setTried(true);
    if (nameError) return;
    saveProcedure({
      ...(procedure ? { id: procedure.id } : {}),
      name,
      price: priceNumber,
      duration: Number(duration) || 60,
      returnDays: Number(returnDays) || 0,
      products: products.filter((item) => item.qty > 0),
    });
    onClose(procedure ? "Procedimento atualizado" : "Procedimento criado");
  };

  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title={procedure ? "Editar procedimento" : "Novo procedimento"}
      subtitle="Aparece na agenda, no atendimento e no cadastro das clientes"
      width={520}
      footer={
        <>
          {procedure ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  removeProcedure(procedure.id);
                  onClose("Procedimento removido");
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
            <Button type="button" variant="ghost" onClick={() => onClose()}>
              Cancelar
            </Button>
          )}
          <Button type="button" variant="tech" className="flex-1" onClick={save}>
            <Icon name="Check" size={18} /> Salvar procedimento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Nome do procedimento"
          placeholder="Ex.: Limpeza de pele profunda"
          value={name}
          error={tried ? nameError : undefined}
          onChange={(event) => setName(event.target.value)}
          hint={
            procedure ? "Atendimentos e horários já feitos mantêm o nome que tinham." : undefined
          }
        />
        <div className="grid grid-cols-3 gap-2.5">
          <Input
            label="Valor"
            trailing="R$"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <Input
            label="Duração"
            trailing="min"
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <Input
            label="Retorno"
            trailing="dias"
            inputMode="numeric"
            value={returnDays}
            onChange={(event) => setReturnDays(event.target.value)}
          />
        </div>

        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Produtos usados
        </span>
        <p className="-mt-2 text-xs text-muted-foreground">
          Entram já marcados na etapa de produtos do atendimento (dá para ajustar na hora).
        </p>
        {products.map((used) => {
          const item = stock.find((entry) => entry.id === used.stockId);
          return (
            <div
              key={used.stockId}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] py-2 pl-3.5 pr-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="break-words text-[14px]">{item?.name ?? "Produto removido"}</div>
                {item ? (
                  <div className="font-mono text-xs text-muted-foreground">
                    {brl(item.cost)} por {item.unit}
                  </div>
                ) : null}
              </div>
              <IconButton
                icon="Minus"
                label="Menos"
                size={40}
                onClick={() =>
                  setProducts((list) =>
                    list
                      .map((entry) =>
                        entry.stockId === used.stockId
                          ? { ...entry, qty: Math.max(0, entry.qty - 1) }
                          : entry,
                      )
                      .filter((entry) => entry.qty > 0),
                  )
                }
              />
              <span className="w-7 text-center font-mono text-[14px]">{used.qty}</span>
              <IconButton
                icon="Plus"
                label="Mais"
                size={40}
                onClick={() =>
                  setProducts((list) =>
                    list.map((entry) =>
                      entry.stockId === used.stockId ? { ...entry, qty: entry.qty + 1 } : entry,
                    ),
                  )
                }
              />
              <IconButton
                icon="Trash2"
                label="Remover produto"
                size={40}
                onClick={() =>
                  setProducts((list) => list.filter((entry) => entry.stockId !== used.stockId))
                }
              />
            </div>
          );
        })}
        {available.length ? (
          <Select
            label="Adicionar produto"
            options={[PICK, ...available.map((item) => item.name)]}
            value={PICK}
            onChange={(event) => {
              const picked = available.find((item) => item.name === event.target.value);
              if (picked) setProducts((list) => [...list, { stockId: picked.id, qty: 1 }]);
            }}
          />
        ) : !stock.length ? (
          <p className="text-xs text-muted-foreground">
            Cadastre produtos em Gestão → Estoque para usá-los aqui.
          </p>
        ) : null}

        {products.length ? (
          <div className="flex flex-col gap-1 rounded-[var(--radius-md)] bg-[var(--eb-ivory-a06)] px-3.5 py-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">Custo dos produtos</span>
              <span className="font-mono">{brl(cost)}</span>
            </div>
            {priceNumber > 0 ? (
              <div className="flex justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Sobra por atendimento</span>
                <span className="font-mono">{brl(priceNumber - cost)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
