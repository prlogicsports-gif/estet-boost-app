/** `gestor` é a dona da clínica; `funcionario` é da equipe, com as permissões que a gestora escolher. */
export type Role = "gestor" | "funcionario" | "cliente";
/** Área do app: a equipe (gestora e funcionárias) usa a área "gestor"; a cliente usa a área "cliente". */
export type Area = "gestor" | "cliente";
export type StudioSize = "autonoma" | "clinica";

export const PERMISSION_KEYS = [
  "clientes",
  "agenda",
  "atendimentos",
  "estoque",
  "financeiro",
  "historico",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type Permissions = Record<PermissionKey, boolean>;

/** Credencial ou link de cadastro aberto pela pessoa: de cliente (`convite`/`p`) ou de equipe (`equipe`). */
export type Invite = {
  kind: "cliente" | "equipe";
  slug: string | null;
  code: string | null;
  professional: string;
};

export type SignupData = {
  name: string;
  email: string;
  password: string;
  phone: string;
  studio: string;
  city: string;
  document: string;
  size: StudioSize;
};

export type Session = {
  uid: string;
  role: Role;
  name: string;
  email: string;
  clinicId: string;
  clientId?: string | undefined;
  permissions: Permissions;
  /** Conta criada pela gestora: ainda falta aceitar os termos no primeiro acesso. */
  termsPending?: boolean | undefined;
  /** Equipe: procedimentos que a gestora habilitou. Vazio = todos. */
  procedureIds?: string[] | undefined;
};

export type AuthResult = { ok: true; needsEmail?: boolean } | { ok: false; message: string };
