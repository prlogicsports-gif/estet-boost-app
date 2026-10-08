import { appointmentsDb, clientsDb, clinicsDb, DEMO_CLINIC } from "@/data/db";
import { useSession } from "@/lib/session";

/** Clínica da esteticista logada (ou a clínica da cliente logada). Sem sessão, é a de demonstração. */
export function useClinic() {
  const session = useSession();
  const clinics = clinicsDb.use();
  const id = session?.clinicId ?? DEMO_CLINIC;
  const clinic = clinics.find((item) => item.id === id) ?? clinics[0];
  return { clinicId: clinic?.id ?? id, clinic };
}

/** Só as clientes da clínica logada. */
export function useClinicClients() {
  const { clinicId } = useClinic();
  return clientsDb.use().filter((item) => (item.clinicId ?? DEMO_CLINIC) === clinicId);
}

/** Só os atendimentos das clientes da clínica logada. */
export function useClinicAppointments() {
  const clients = useClinicClients();
  const ids = new Set(clients.map((item) => item.id));
  return appointmentsDb.use().filter((item) => ids.has(item.clientId));
}
