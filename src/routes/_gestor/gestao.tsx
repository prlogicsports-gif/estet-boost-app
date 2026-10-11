import { createFileRoute, redirect } from "@tanstack/react-router";

type Aba = "caixa" | "receber" | "contas" | "estoque" | "historico";
const ABAS: Aba[] = ["caixa", "receber", "contas", "estoque", "historico"];

/**
 * A antiga "Gestão" foi dividida em Financeiro, Produtos e estoque e Histórico. Esta rota só leva quem
 * abre um link ou uma notificação antiga (`/gestao?aba=...`) para o lugar certo.
 */
export const Route = createFileRoute("/_gestor/gestao")({
  validateSearch: (search): { aba?: Aba | undefined } => ({
    aba: ABAS.find((item) => item === search["aba"]),
  }),
  beforeLoad: ({ search }) => {
    if (search.aba === "estoque") throw redirect({ to: "/estoque", replace: true });
    if (search.aba === "historico") throw redirect({ to: "/historico", replace: true });
    throw redirect({
      to: "/financeiro",
      replace: true,
      ...(search.aba ? { search: { aba: search.aba } } : {}),
    });
  },
});
