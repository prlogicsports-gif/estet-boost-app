import {
  anamnesisDb,
  appointmentsDb,
  ledgerDb,
  sessionsDb,
  settingsDb,
  type ClientRec,
} from "@/data/db";
import { brl } from "@/lib/view";

const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Monta o prontuário em texto e baixa o arquivo. Quando houver banco, vira um PDF gerado no servidor. */
export function exportRecord(client: ClientRec) {
  const { questions } = settingsDb.get();
  const anamnese = anamnesisDb.get().find((item) => item.clientId === client.id);
  const sessions = sessionsDb
    .get()
    .filter((item) => item.clientId === client.id && item.status === "done");
  const appointments = appointmentsDb
    .get()
    .filter((item) => item.clientId === client.id && item.done);
  const ledger = ledgerDb.get().filter((item) => item.clientId === client.id);
  const lines: string[] = [
    `PRONTUÁRIO · ${client.name}`,
    `Gerado em ${date(new Date().toISOString())}`,
    "",
    "DADOS",
    `Telefone: ${client.phone || "—"}`,
    `E-mail: ${client.email ?? "—"}`,
    `Nascimento: ${client.birth ? date(`${client.birth}T12:00:00`) : "—"}`,
    `CPF: ${client.document ?? "—"}`,
    `Endereço: ${client.address ?? "—"}`,
    `Objetivo: ${client.goal ?? "—"}`,
    `Alergias: ${client.allergies ?? "nenhuma registrada"}`,
    `Contraindicações: ${client.contra ?? "nenhuma registrada"}`,
    `Observações: ${client.note ?? "—"}`,
    `Autorização de imagem: ${client.imageConsent ? "sim" : "não"}`,
    "",
    "ANAMNESE",
    ...(anamnese
      ? questions.map((question) => `${question.label}: ${anamnese.answers[question.id] || "—"}`)
      : ["Não preenchida"]),
    "",
    "ATENDIMENTOS",
    ...(sessions.length
      ? sessions.flatMap((item) => [
          `${date(item.finishedAt ?? item.startedAt)} · ${item.procedure}`,
          `  Procedimentos: ${item.procedures.map((p) => `${p.name} (${brl(p.price)})`).join(", ")}`,
          `  Produtos: ${item.products.map((p) => `${p.name} x${p.qty}`).join(", ") || "—"}`,
          ...Object.entries(item.notes)
            .filter(([, text]) => text)
            .map(([key, text]) => `  ${key}: ${text}`),
          `  Fotos: ${item.beforePhotoId ? "antes" : "—"} / ${item.afterPhotoId ? "depois" : "—"}`,
        ])
      : appointments.map((item) => `${date(`${item.date}T12:00:00`)} · ${item.procedure}`)),
    "",
    "FINANCEIRO",
    ...(ledger.length
      ? ledger.map(
          (item) =>
            `${date(`${item.date}T12:00:00`)} · ${item.origin} · ${brl(item.value)} · ${item.kind === "receber" ? "em aberto" : "pago"}`,
        )
      : ["Sem lançamentos"]),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `prontuario-${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
