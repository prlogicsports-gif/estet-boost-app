import type { Session } from "@/lib/auth.types";

/** Contas de demonstração. Qualquer senha é aceita enquanto não há backend. */
export const demoAccounts: Session[] = [
  {
    role: "gestor",
    name: "Fernanda Costa",
    email: "fernanda@estudio.com.br",
    clinicId: "clinica-fernanda",
  },
  {
    role: "cliente",
    name: "Mariana Silva",
    email: "mariana@email.com",
    clientId: "c1",
    clinicId: "clinica-fernanda",
  },
];

export const roleLabel = { gestor: "Esteticista", cliente: "Cliente" } as const;

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
