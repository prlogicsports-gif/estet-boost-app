/**
 * Cuidados pós-atendimento. As sugestões vêm da anamnese da cliente, do que a
 * esteticista já costuma indicar para o procedimento e de uma base por
 * procedimento. O que ela escreve ou escolhe volta como sugestão nas próximas
 * vezes: sem IA clínica, só o que ela registrou, guardado no aparelho.
 */
export type LearnedCare = {
  texto: string;
  procedimento: string;
  usos: number;
  origem: "escrito" | "sugerido";
  criadoEm: string;
};

export type Anamnese = {
  alergias?: string | undefined;
  contraindicacoes?: string | undefined;
  sensibilidade?: string | undefined;
  rotina?: string | undefined;
};

export type CareSuggestion = {
  texto: string;
  motivo: string | null;
  origem: "anamnese" | "aprendido" | "base";
};

const KEY = "estetboost:cuidados-aprendidos";

export function readLearned(): LearnedCare[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return Array.isArray(list) ? (list as LearnedCare[]) : [];
  } catch {
    return [];
  }
}

export function writeLearned(list: LearnedCare[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
}

export const norm = (text: string | undefined) =>
  (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const BASE: Record<string, string[]> = {
  limpeza: [
    "Protetor solar FPS 50 todas as manhãs, reaplicar a cada 3 horas",
    "Evitar esfoliação por 5 dias",
    "Não usar maquiagem nas primeiras 12 horas",
    "Lavar o rosto com sabonete suave, água fria ou morna",
  ],
  peeling: [
    "Protetor solar FPS 50 e evitar sol direto por 7 dias",
    "Não remover a pele que descamar",
    "Hidratante calmante 2x ao dia",
    "Suspender ácidos e retinoides por 7 dias",
  ],
  hidrata: [
    "Beber ao menos 2 litros de água por dia",
    "Hidratante à noite, antes de dormir",
    "Protetor solar diário",
  ],
  drenagem: [
    "Evitar sal em excesso nas próximas 24 horas",
    "Dormir com a cabeça levemente elevada",
    "Beber bastante água",
  ],
  avalia: ["Manter a rotina atual até a próxima sessão", "Protetor solar diário"],
};

export function baseFor(procedure: string): string[] {
  const p = norm(procedure);
  const key = Object.keys(BASE).find((item) => p.includes(item));
  return (
    (key ? BASE[key] : undefined) ?? [
      "Protetor solar FPS 50 todas as manhãs",
      "Evitar sol direto nas próximas 48 horas",
    ]
  );
}

/** Regras a partir da anamnese: cada sugestão diz de onde veio. */
export function fromAnamnese(anamnese: Anamnese | undefined): { texto: string; motivo: string }[] {
  const a = anamnese ?? {};
  const out: { texto: string; motivo: string }[] = [];
  if (a.alergias && !/nenhum/i.test(a.alergias)) {
    out.push({
      texto: `Evitar produtos com ${a.alergias.toLowerCase()}`,
      motivo: "Alergia registrada",
    });
  }
  if (a.contraindicacoes && /gestante|gravidez/i.test(a.contraindicacoes)) {
    out.push({ texto: "Não usar ácidos em casa sem liberação médica", motivo: "Gestante" });
  }
  if (a.sensibilidade)
    out.push({
      texto: "Compressa fria por 10 minutos se houver ardência",
      motivo: "Sensibilidade anterior",
    });
  if (a.rotina && /irregular|às vezes|raramente/i.test(a.rotina)) {
    out.push({
      texto: "Criar o hábito do protetor solar logo ao acordar",
      motivo: "Rotina de cuidados",
    });
  }
  return out;
}

export const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function returnDays(procedure: string) {
  const p = norm(procedure);
  return /peeling/.test(p) ? 21 : /drenagem/.test(p) ? 7 : /avalia/.test(p) ? 7 : 14;
}

export type WrapUpResult = {
  retorno: { data: string; hora: string } | null;
  semRetorno: string | null;
  cuidados: string[];
};
