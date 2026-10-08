import { useState } from "react";
import {
  Droplets,
  Flower2,
  Hand,
  Layers,
  type LucideIcon,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Waves,
  Wind,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GeneralAction } from "@/lib/face-general-actions";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Droplets,
  Sun,
  Wind,
  Waves,
  Flower2,
  Hand,
  Layers,
};

const fieldClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3 text-[14.5px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const blank = { nome: "", descricao: "", duracao: "", icone: "Sparkles" };

/**
 * Ações no rosto todo: nem tudo se marca por região (peeling geral, limpeza
 * completa). Elas valem para a face inteira e convivem com as marcações.
 */
export function FaceGeneralActions({
  actions,
  onChange,
  applied,
  onApply,
}: {
  actions: GeneralAction[];
  onChange: (next: GeneralAction[]) => void;
  applied: Record<string, boolean>;
  onApply: (action: GeneralAction, on: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const name = form.nome.trim();

  const create = () => {
    if (!name) return;
    onChange([
      ...actions,
      {
        id: `g-${Date.now()}`,
        nome: name,
        descricao: form.descricao.trim(),
        duracao: form.duracao.trim(),
        icone: form.icone,
      },
    ]);
    setForm(blank);
    setCreating(false);
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
          Ações no rosto todo
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {actions.length === 1 ? "1 ação" : `${actions.length} ações`}
        </span>
      </div>

      {actions.map((action) => {
        const on = Boolean(applied[action.id]);
        const Icon = ICONS[action.icone] ?? Sparkles;
        return (
          <div
            key={action.id}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 transition-colors",
              on
                ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                : "border-[var(--border-card)] bg-card",
            )}
          >
            <span
              className={cn(
                "grid size-[34px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)]",
                on ? "text-[var(--teal)]" : "text-[var(--nude-sand)]",
              )}
            >
              <Icon className="size-[17px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-[7px]">
                <span className="text-sm font-medium text-foreground">{action.nome}</span>
                {action.exemplo ? (
                  <span className="rounded-full bg-[var(--eb-nude-a16)] px-[7px] py-0.5 text-[10.5px] text-[var(--nude-sand)]">
                    exemplo
                  </span>
                ) : null}
              </div>
              {action.descricao ? (
                <div className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  {action.descricao}
                </div>
              ) : null}
              {action.duracao ? (
                <div className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                  {action.duracao}
                </div>
              ) : null}
            </div>
            {on ? (
              <span className="rounded-full bg-[var(--eb-teal-a12)] px-2 py-0.5 text-[11px] font-medium text-[var(--teal)]">
                Aplicada
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={on ? "ghost" : "secondary"}
              onClick={() => onApply(action, !on)}
            >
              {on ? "Remover" : "Aplicar"}
            </Button>
            {!action.exemplo ? (
              <button
                type="button"
                onClick={() => onChange(actions.filter((item) => item.id !== action.id))}
                aria-label={`Excluir ${action.nome}`}
                className="grid size-11 flex-none place-items-center text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        );
      })}

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-3.5 text-[13.5px] text-[var(--text-secondary)] hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden /> Criar ação no rosto todo
        </button>
      ) : (
        <div
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-card px-4 py-3.5"
          style={{ boxShadow: "var(--shadow-raised)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[17px] font-medium text-foreground">
              Nova ação no rosto todo
            </span>
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Cancelar"
              className="grid size-11 place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="size-[17px]" aria-hidden />
            </button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">Nome</span>
            <input
              value={form.nome}
              placeholder="ex.: Peeling no rosto todo"
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className={cn(fieldClass, "min-h-11")}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">
              Descrição
            </span>
            <textarea
              rows={2}
              value={form.descricao}
              placeholder="O que esta ação envolve?"
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className={cn(fieldClass, "resize-y py-2.5 leading-normal")}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">
              Duração prevista
            </span>
            <input
              value={form.duracao}
              placeholder="ex.: 45 min"
              onChange={(e) => setForm({ ...form, duracao: e.target.value })}
              className={cn(fieldClass, "min-h-11")}
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">Ícone</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ICONS).map(([key, Icon]) => {
                const on = form.icone === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, icone: key })}
                    aria-label={key}
                    aria-pressed={on}
                    className={cn(
                      "grid size-11 place-items-center rounded-[var(--radius-md)] border",
                      on
                        ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                        : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                    )}
                  >
                    <Icon className="size-[17px]" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="flex-1" disabled={!name} onClick={create}>
              Criar ação
            </Button>
          </div>
          {!name ? (
            <p className="text-center text-[11.5px] text-muted-foreground">
              Dê um nome para criar a ação.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
