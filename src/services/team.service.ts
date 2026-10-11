import type { Permissions } from "@/lib/auth.types";
import { supabase } from "@/lib/supabase";

export type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  permissions: Partial<Permissions> | null;
  /** Procedimentos habilitados; vazio ou ausente = todos. */
  procedure_ids?: string[] | null;
  created_at: string;
};
export type InviteRow = {
  id: string;
  role: "cliente" | "funcionario";
  name_hint: string | null;
  phone_hint: string | null;
  email_hint: string | null;
  permissions: Partial<Permissions> | null;
  expires_at: string;
  used_at: string | null;
  revoked: boolean;
  created_at: string;
};
export type InviteState = "pendente" | "usada" | "expirada" | "cancelada";
export const inviteState = (invite: InviteRow): InviteState =>
  invite.used_at
    ? "usada"
    : invite.revoked
      ? "cancelada"
      : new Date(invite.expires_at).getTime() < Date.now()
        ? "expirada"
        : "pendente";

type RpcResult = { ok: boolean; reason?: string; code?: string; expires_at?: string };
const REASONS: Record<string, string> = {
  sem_permissao: "Só a gestora pode fazer isso.",
  email_invalido: "Esse e-mail não parece válido.",
  limite_de_credenciais: "Há credenciais pendentes demais. Cancele algumas.",
  nao_encontrada: "Pessoa não encontrada.",
};
const fail = (reason?: string) => ({
  ok: false as const,
  message: REASONS[reason ?? ""] ?? "Não foi possível concluir. Tente de novo.",
});

async function call(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return fail();
  const result = data as RpcResult;
  return result?.ok
    ? { ok: true as const, code: result.code, expiresAt: result.expires_at }
    : fail(result?.reason);
}

export async function listStaff(): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "funcionario")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

export async function listInvites(): Promise<InviteRow[]> {
  const { data, error } = await supabase.rpc("list_invites");
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

export const createClientInvite = (name: string, phone: string) =>
  call("create_invite", { p_name: name, p_phone: phone });
export const createStaffInvite = (name: string, email: string, permissions: Permissions) =>
  call("create_staff_invite", { p_name: name, p_email: email, p_permissions: permissions });
export const setStaffProcedures = (id: string, ids: string[]) =>
  call("set_staff_procedures", { p_staff_id: id, p_ids: ids });
export const setInviteProcedures = (code: string, ids: string[]) =>
  call("set_invite_procedures", { p_code: code, p_ids: ids });
export const revokeInvite = (id: string) => call("revoke_invite", { p_id: id });
export const setStaffActive = (id: string, active: boolean) =>
  call("set_staff_active", { p_staff_id: id, p_active: active });
export const setStaffPermissions = (id: string, permissions: Permissions) =>
  call("set_staff_permissions", { p_staff_id: id, p_permissions: permissions });
