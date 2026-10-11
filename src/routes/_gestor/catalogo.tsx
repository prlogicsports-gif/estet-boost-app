import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ProcedureDrawer, productsCost } from "@/components/catalog/procedure-drawer";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { SearchBar } from "@/components/eb/search-bar";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { Button } from "@/components/ui/button";
import { proceduresDb, stockDb } from "@/data/db";
import type { ProcedureRec } from "@/lib/models";
import { useClinic } from "@/lib/use-clinic";
import { usePro } from "@/lib/use-pro";
import { brl } from "@/lib/view";

export const Route = createFileRoute("/_gestor/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — EstetBoost." },
      {
        name: "description",
        content: "Procedimentos, valores, duração e produtos usados em cada um.",
      },
    ],
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  const pro = usePro();
  const { clinic } = useClinic();
  const list = proceduresDb.use();
  const stock = stockDb.use();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProcedureRec | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      list
        .filter((item) => !query || item.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [list, query],
  );

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Catálogo"
        context={`${clinic?.name ?? "Sua clínica"} · ${list.length} ${list.length === 1 ? "procedimento" : "procedimentos"}`}
        user={pro}
        actions={
          <Button type="button" size="sm" onClick={openNew}>
            <Icon name="Plus" size={15} /> Novo procedimento
          </Button>
        }
      />

      {list.length > 4 ? (
        <SearchBar
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Buscar procedimento"
        />
      ) : null}

      {shown.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
          {shown.map((item) => {
            const cost = productsCost(item.products);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditing(item);
                  setOpen(true);
                }}
                className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4 text-left transition-colors active:bg-[var(--eb-ivory-a10)]"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start gap-3">
                  <span className="min-w-0 flex-1 break-words text-[16px] font-medium leading-snug">
                    {item.name}
                  </span>
                  <span className="flex-none font-mono text-[15px] text-[var(--eb-teal-500)]">
                    {brl(item.price)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[12px] text-[var(--text-secondary)]">
                  <span className="rounded-full bg-[var(--eb-ivory-a06)] px-2.5 py-1">
                    {item.duration} min
                  </span>
                  <span className="rounded-full bg-[var(--eb-ivory-a06)] px-2.5 py-1">
                    {item.returnDays ? `retorno em ${item.returnDays} dias` : "sem retorno"}
                  </span>
                </div>
                {item.products?.length ? (
                  <div className="flex flex-col gap-1.5 border-t border-[var(--border-hairline)] pt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.products.map((used) => (
                        <span
                          key={used.stockId}
                          className="max-w-full break-words rounded-full border border-[var(--border-hairline)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]"
                        >
                          {stock.find((entry) => entry.id === used.stockId)?.name ?? "Produto"} ×
                          {used.qty}
                        </span>
                      ))}
                    </div>
                    {cost > 0 ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        Produtos: {brl(cost)} · sobra {brl(item.price - cost)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhum produto vinculado.</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="BookOpen"
          title={query ? "Nada com esse nome" : "Seu catálogo está vazio"}
          description={
            query
              ? "Tente outro nome."
              : "Cadastre os procedimentos que você realiza, com valor, duração e produtos usados."
          }
          action={
            query ? undefined : (
              <Button type="button" onClick={openNew}>
                <Icon name="Plus" size={16} /> Novo procedimento
              </Button>
            )
          }
        />
      )}

      <ProcedureDrawer
        open={open}
        procedure={editing}
        onClose={(message) => {
          setOpen(false);
          if (message) setToast(message);
        }}
      />
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
