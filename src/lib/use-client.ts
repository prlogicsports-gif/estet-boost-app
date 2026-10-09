import { clientsDb } from "@/data/db";
import { useSession } from "@/lib/session";

/** A cliente logada no app da cliente. */
export function useClient() {
  const session = useSession();
  const clients = clientsDb.use();
  const clientId = session?.clientId ?? "";
  const client = clients.find((item) => item.id === clientId);
  const name = session?.name ?? client?.name ?? "Cliente";
  return {
    clientId,
    client,
    profile: {
      name,
      initials:
        client?.initials ??
        name
          .split(" ")
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      first: name.split(" ")[0] ?? name,
    },
  };
}
