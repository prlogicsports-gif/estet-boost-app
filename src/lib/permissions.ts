import type { PermissionKey, Permissions, Session } from "@/lib/auth.types";

export const PERMISSION_INFO: Record<PermissionKey, { label: string; hint: string }> = {
  clientes: { label: "Clientes", hint: "Ver e cadastrar clientes, fichas, anamnese e fotos" },
  agenda: { label: "Agenda", hint: "Ver e organizar horários, aprovar pedidos das clientes" },
  atendimentos: { label: "Atendimentos", hint: "Realizar e finalizar atendimentos" },
  estoque: { label: "Estoque", hint: "Ver e atualizar produtos (sem ver custo)" },
  financeiro: { label: "Financeiro", hint: "Caixa, contas, valores recebidos e custos" },
  historico: { label: "Histórico de eventos", hint: "Ver o que as clientes e a equipe fizeram" },
};

/** Padrão ao convidar: tudo, menos o financeiro. */
export const DEFAULT_STAFF_PERMISSIONS: Permissions = {
  clientes: true,
  agenda: true,
  atendimentos: true,
  estoque: true,
  financeiro: false,
  historico: true,
};

/** A gestora tem tudo. A funcionária só o que foi marcado. A cliente nada da equipe. */
export const can = (session: Session | null | undefined, permission: PermissionKey) =>
  Boolean(session && session.role !== "cliente" && session.permissions[permission]);

/** Qualquer uma das permissões. */
export const canAny = (session: Session | null | undefined, ...permissions: PermissionKey[]) =>
  permissions.some((permission) => can(session, permission));

/** Procedimentos que a pessoa pode usar: a gestora todos; a funcionária os habilitados (vazio = todos). */
export function usableProcedures<T extends { id: string }>(
  session: Session | null | undefined,
  list: T[],
): T[] {
  const ids = session?.role === "funcionario" ? session.procedureIds : undefined;
  return ids?.length ? list.filter((item) => ids.includes(item.id)) : list;
}

/** O que cada página da equipe exige (qualquer uma das permissões listadas). `[]` = qualquer pessoa da equipe. */
export function requiredFor(pathname: string): PermissionKey[] | "gestor" {
  if (pathname.startsWith("/agenda")) return ["agenda"];
  if (pathname.startsWith("/atendimentos")) return ["agenda", "atendimentos"];
  if (pathname.startsWith("/atendimento")) return ["atendimentos"];
  if (pathname.startsWith("/clientes")) return ["clientes"];
  if (pathname.startsWith("/gestao")) return ["financeiro", "estoque", "historico"];
  if (pathname.startsWith("/credenciais") || pathname.startsWith("/catalogo")) return "gestor";
  return [];
}
