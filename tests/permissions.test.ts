import { describe, expect, test } from "bun:test";

import type { Session } from "../src/lib/auth.types";
import { requiredFor, usableProcedures } from "../src/lib/permissions";

const base = { uid: "u", name: "x", email: "x@x.com", clinicId: "c" };
const perms = {
  clientes: true,
  agenda: true,
  atendimentos: true,
  estoque: true,
  financeiro: false,
  historico: true,
};
const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("procedimentos por pessoa", () => {
  test("gestora e cliente veem todos", () => {
    expect(
      usableProcedures({ ...base, role: "gestor", permissions: perms } as Session, list),
    ).toEqual(list);
    expect(usableProcedures(null, list)).toEqual(list);
  });
  test("funcionária sem lista vê todos; com lista só os habilitados", () => {
    const staff = { ...base, role: "funcionario", permissions: perms } as Session;
    expect(usableProcedures(staff, list)).toEqual(list);
    expect(usableProcedures({ ...staff, procedureIds: [] }, list)).toEqual(list);
    expect(usableProcedures({ ...staff, procedureIds: ["b"] }, list)).toEqual([{ id: "b" }]);
  });
  test("catálogo e credenciais são só da gestora", () => {
    expect(requiredFor("/catalogo")).toBe("gestor");
    expect(requiredFor("/credenciais")).toBe("gestor");
    expect(requiredFor("/clientes")).toEqual(["clientes"]);
  });
});
