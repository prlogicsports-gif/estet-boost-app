import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { Icon } from "@/components/eb/icon";
import { ProductDrawer } from "@/components/eb/product-drawer";
import { SearchBar } from "@/components/eb/search-bar";
import { daysToExpire, StockItem } from "@/components/eb/stock-item";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { stockDb } from "@/data/db";
import type { StockRec } from "@/lib/models";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { usePro } from "@/lib/use-pro";

export const Route = createFileRoute("/_gestor/estoque")({
  head: () => ({
    meta: [
      { title: "Produtos e estoque — EstetBoost." },
      {
        name: "description",
        content: "Produtos, quantidades, validade e reposição do seu estúdio.",
      },
    ],
  }),
  component: EstoquePage,
});

function EstoquePage() {
  const pro = usePro();
  const { openNotifications, unread } = useShell();
  const session = useSession();
  const stock = stockDb.use();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [product, setProduct] = useState<{
    item: StockRec | null;
    mode: "novo" | "editar" | "repor";
  }>({ item: null, mode: "novo" });

  const low = stock.filter((item) => item.quantity <= item.min);
  const shown = useMemo(
    () =>
      stock
        .filter((item) =>
          `${item.name} ${item.category}${can(session, "financeiro") ? ` ${item.supplier}` : ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stock, query, session],
  );
  const expiring = stock.filter((item) => {
    const days = daysToExpire(item);
    return days !== null && days <= 30;
  });

  const openWith = (item: StockRec | null, mode: "novo" | "editar" | "repor") => {
    setProduct({ item, mode });
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Produtos e estoque"
        context={`${stock.length} ${stock.length === 1 ? "produto" : "produtos"}`}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button type="button" size="sm" onClick={() => openWith(null, "novo")}>
            <Icon name="Plus" size={15} />
            Adicionar produto
          </Button>
        }
      />
      <div className="flex flex-col gap-2.5">
        <SearchBar
          placeholder="Buscar produto"
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
        />
        {low.length ? (
          <AlertCard
            tone="warn"
            icon="PackageMinus"
            title={`${low.length} ${low.length === 1 ? "produto abaixo do mínimo" : "produtos abaixo do mínimo"}`}
            description={low.map((item) => item.name).join(" e ")}
            actionLabel="Repor"
            onAction={() => openWith(low[0] ?? null, "repor")}
          />
        ) : null}
        {expiring.length ? (
          <AlertCard
            tone="danger"
            icon="CalendarX"
            title={`${expiring.length} ${expiring.length === 1 ? "produto vencido ou perto de vencer" : "produtos vencidos ou perto de vencer"}`}
            description={expiring.map((item) => item.name).join(", ")}
          />
        ) : null}
        {shown.map((item) => (
          <StockItem
            key={item.id}
            item={item}
            onEdit={() => openWith(item, "editar")}
            onRestock={() => openWith(item, "repor")}
          />
        ))}
        {!shown.length ? (
          <p className="py-2 text-[13px] text-muted-foreground">Nenhum produto com esse nome.</p>
        ) : null}
      </div>
      <ProductDrawer
        open={open}
        item={product.item}
        mode={product.mode}
        onClose={() => setOpen(false)}
        onSaved={(text) => (setOpen(false), setToast(text))}
      />
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
