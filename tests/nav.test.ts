import { describe, expect, test } from "bun:test";

import { gestorNav } from "../src/components/shell/nav-items";
import { visibleNav } from "../src/components/shell/use-visible-nav";
import type { Permissions, Session } from "../src/lib/auth.types";
import { requiredFor } from "../src/lib/permissions";

const none: Permissions = {
  clientes: false,
  agenda: false,
  atendimentos: false,
  estoque: false,
  financeiro: false,
  historico: false,
};
const staff = (permissions: Partial<Permissions>): Session => ({
  uid: "u",
  name: "x",
  email: "x@x.com",
  clinicId: "c",
  role: "funcionario",
  permissions: { ...none, ...permissions },
});
const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("menu da equipe", () => {
  test("a gestora vê Financeiro no dock e Produtos e estoque no Mais", () => {
    const nav = visibleNav(gestorNav, { ...staff({}), role: "gestor" });
    expect(labels(nav.primary)).toEqual(["Hoje", "Agenda", "Clientes", "Financeiro"]);
    expect(labels(nav.secondary)).toContain("Produtos e estoque");
    expect(labels(nav.secondary)).toContain("Histórico");
    expect(labels(nav.secondary)).toContain("Catálogo");
  });

  test("funcionária sem financeiro: Produtos e estoque sobe para o dock", () => {
    const nav = visibleNav(
      gestorNav,
      staff({ agenda: true, clientes: true, estoque: true, historico: true }),
    );
    expect(labels(nav.primary)).toEqual(["Hoje", "Agenda", "Clientes", "Produtos e estoque"]);
    expect(labels(nav.secondary)).toContain("Histórico");
    expect(labels(nav.secondary)).not.toContain("Produtos e estoque");
  });

  test("só agenda: dock com 2 itens e sem itens da gestora", () => {
    const nav = visibleNav(gestorNav, staff({ agenda: true }));
    expect(labels(nav.primary)).toEqual(["Hoje", "Agenda"]);
    for (const hidden of ["Dashboard", "Catálogo", "Credenciais", "Produtos e estoque"])
      expect(labels(nav.secondary)).not.toContain(hidden);
  });
});

describe("rotas novas", () => {
  test("permissões por rota", () => {
    expect(requiredFor("/financeiro")).toEqual(["financeiro"]);
    expect(requiredFor("/estoque")).toEqual(["estoque"]);
    expect(requiredFor("/historico")).toEqual(["historico"]);
    expect(requiredFor("/fidelidade")).toBe("gestor");
    expect(requiredFor("/dashboard")).toBe("gestor");
    expect(requiredFor("/gestao")).toEqual([]);
  });
});
