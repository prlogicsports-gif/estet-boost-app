import { initialsOf } from "@/lib/initials";
import { useSession } from "@/lib/session";

const ROLE = { gestor: "Gestora", funcionario: "Equipe", cliente: "Cliente" } as const;

/** A pessoa da equipe logada (gestora ou funcionária). */
export function usePro() {
  const session = useSession();
  const name = session?.name ?? "";
  return { name, initials: initialsOf(name), role: session ? ROLE[session.role] : "" };
}
