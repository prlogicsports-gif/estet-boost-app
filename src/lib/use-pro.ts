import { pro as demo } from "@/data/gestor-mock";
import { initialsOf } from "@/data/mock-auth";
import { useSession } from "@/lib/session";

/** A esteticista logada. Quem cria conta vê o próprio nome; a conta de demonstração é a Fernanda. */
export function usePro() {
  const session = useSession();
  if (!session || session.role !== "gestor") return demo;
  return { name: session.name, initials: initialsOf(session.name), role: demo.role };
}
