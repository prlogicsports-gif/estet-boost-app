export type Role = "gestor" | "cliente";
export type StudioSize = "autonoma" | "clinica";
export type Invite = { slug: string | null; code: string | null; professional: string };
export type SignupData = {
  name: string;
  email: string;
  phone: string;
  studio: string;
  city: string;
  document: string;
  size: StudioSize;
};
export type Session = {
  role: Role;
  name: string;
  email: string;
  /** Cliente: qual cliente da carteira ela é. */ clientId?: string | undefined;
  /** Clínica da esteticista, ou a clínica à qual a cliente está filiada. */
  clinicId?: string | undefined;
};
export type AuthResult = { ok: true; session: Session } | { ok: false; message: string };
