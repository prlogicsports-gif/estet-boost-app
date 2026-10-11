import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import type { StockRec } from "@/lib/models";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { removeStock, saveStock } from "@/services/finance.service";

const parseMoney = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

const CATEGORIES = ["Ativo", "Máscara", "Cosmético", "Descartável", "Equipamento", "Outro"];
const UNITS = ["un", "fr", "pt", "pc", "cx", "ml", "g", "kg"];

/** Cadastro, edição e reposição de produto do estoque (usado em Gestão e dentro do atendimento). */
export function ProductDrawer({
  open,
  item,
  mode,
  onClose,
  onSaved,
  onCreated,
}: {
  open: boolean;
  item: StockRec | null;
  mode: "novo" | "editar" | "repor";
  onClose: () => void;
  onSaved: (text: string) => void;
  /** Produto novo salvo (não em edição nem reposição): quem abriu pode usá-lo na hora. */
  onCreated?: (item: StockRec) => void;
}) {
  const money = can(useSession(), "financeiro");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [min, setMin] = useState("2");
  const [expiry, setExpiry] = useState("");
  const [batch, setBatch] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [tried, setTried] = useState(false);
  const restocking = mode === "repor";

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setCategory(item?.category ?? CATEGORIES[0] ?? "");
    setQuantity(item ? (restocking ? "1" : String(item.quantity)) : "1");
    setUnit(item?.unit ?? "un");
    setMin(String(item?.min ?? 2));
    setExpiry(item?.expiry ?? "");
    setBatch(item?.batch ?? "");
    setCost(item ? String(item.cost).replace(".", ",") : "");
    setSupplier(item?.supplier ?? "");
    setTried(false);
  }, [open, item, restocking]);

  const nameError = name.trim() ? undefined : "Informe o produto.";
  const qtyError =
    Number(quantity.replace(",", ".")) > 0 || (mode === "editar" && Number(quantity) >= 0)
      ? undefined
      : "Informe a quantidade.";

  function submit() {
    setTried(true);
    if (nameError || qtyError) return;
    const saved = saveStock(
      {
        ...(item ? { id: item.id } : {}),
        name: name.trim(),
        category,
        quantity: Number(quantity.replace(",", ".")),
        unit,
        min: Number(min) || 0,
        expiry,
        batch: batch.trim(),
        cost: parseMoney(cost) || 0,
        supplier: supplier.trim(),
      },
      restocking,
    );
    if (mode === "novo") onCreated?.(saved);
    onSaved(
      restocking
        ? `${saved.name}: agora ${saved.quantity} ${saved.unit} no estoque`
        : `${saved.name} salvo no estoque`,
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        restocking ? "Repor produto" : mode === "editar" ? "Editar produto" : "Adicionar produto"
      }
      subtitle={
        restocking
          ? "A quantidade informada é somada ao que já tem"
          : "Validade e mínimo geram avisos para você"
      }
      footer={
        <>
          {mode === "editar" && item ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                removeStock(item.id);
                onSaved(`${item.name} removido do estoque`);
              }}
            >
              <Icon name="Trash2" size={16} /> Excluir
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="button" variant="tech" className="flex-1" onClick={submit}>
            <Icon name="Check" size={18} /> {restocking ? "Registrar reposição" : "Salvar produto"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Produto"
          placeholder="Ácido mandélico 5%"
          value={name}
          disabled={restocking}
          error={tried ? nameError : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Tipo"
          options={CATEGORIES}
          value={category}
          disabled={restocking}
          onChange={(event) => setCategory(event.target.value)}
        />
        <div className="grid grid-cols-3 gap-2.5">
          <Input
            label={restocking ? "Entrada" : "Quantidade"}
            inputMode="decimal"
            value={quantity}
            error={tried ? qtyError : undefined}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <Select
            label="Unidade"
            options={UNITS}
            value={unit}
            disabled={restocking}
            onChange={(event) => setUnit(event.target.value)}
          />
          <Input
            label="Mínimo"
            inputMode="numeric"
            value={min}
            onChange={(event) => setMin(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Validade"
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
          <Input
            label="Lote"
            placeholder="A-2291"
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
          />
        </div>
        {money ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Custo por unidade"
              trailing="R$"
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              hint="Usado no cálculo de custo de cada atendimento."
            />
            <Input
              label="Fornecedor"
              placeholder="Dermaline"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
