/** Modelo e respostas da anamnese: a clínica monta as perguntas (tipo, opções, ordem) em Configurações. */

export const QUESTION_TYPES = [
  { id: "longtext", label: "Texto longo" },
  { id: "text", label: "Texto curto" },
  { id: "yesno", label: "Sim ou não" },
  { id: "single", label: "Escolha uma opção" },
  { id: "multi", label: "Escolha várias opções" },
  { id: "number", label: "Número" },
  { id: "date", label: "Data" },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]["id"];

export type Question = {
  id: string;
  label: string;
  /** Sem tipo (modelos antigos) = texto longo. */
  type?: QuestionType;
  /** Para "escolha uma/várias opções". */
  options?: string[];
  required?: boolean;
  /** Resposta preenchida aparece como alerta na ficha (ex.: alergias). */
  flag?: boolean;
};

/** Resposta: texto, "Sim"/"Não", opção escolhida, ou lista de opções. */
export type Answer = string | string[];

export const typeLabel = (type: QuestionType | undefined) =>
  QUESTION_TYPES.find((item) => item.id === (type ?? "longtext"))?.label ?? "Texto longo";

export const isChoice = (type: QuestionType | undefined) => type === "single" || type === "multi";

/** Arruma uma pergunta lida do banco (modelos antigos, opções vazias, tipo desconhecido). */
export function normalizeQuestion(question: Question): Question {
  const known = QUESTION_TYPES.some((item) => item.id === question.type);
  const type: QuestionType = known ? (question.type as QuestionType) : "longtext";
  const options = isChoice(type)
    ? (question.options ?? []).map((item) => item.trim()).filter(Boolean)
    : undefined;
  return {
    id: question.id,
    label: question.label,
    type,
    ...(options ? { options } : {}),
    ...(question.required ? { required: true } : {}),
    ...(question.flag ? { flag: true } : {}),
  };
}

export const normalizeQuestions = (list: Question[] | undefined): Question[] =>
  (list ?? []).map(normalizeQuestion);

export const answerList = (answer: Answer | undefined): string[] =>
  Array.isArray(answer) ? answer : answer ? [answer] : [];

export const answerText = (answer: Answer | undefined): string =>
  Array.isArray(answer) ? answer.join(", ") : (answer ?? "");

export const hasAnswer = (answer: Answer | undefined): boolean =>
  answerList(answer).some((item) => item.trim() !== "");

/** Texto para mostrar (data em dd/mm/aaaa; vazio vira "—"). */
export function formatAnswer(question: Question, answer: Answer | undefined): string {
  if (!hasAnswer(answer)) return "—";
  if (question.type === "date") {
    const text = answerText(answer);
    const [y, m, d] = text.split("-");
    return y && m && d ? `${d}/${m}/${y}` : text;
  }
  return answerText(answer);
}

/** Perguntas obrigatórias sem resposta. */
export const missingRequired = (questions: Question[], answers: Record<string, Answer>) =>
  questions.filter((question) => question.required && !hasAnswer(answers[question.id]));

/** Perguntas padrão de uma clínica nova. */
export const DEFAULT_QUESTIONS: Question[] = [
  { id: "queixa", label: "Queixa principal", type: "longtext" },
  { id: "objetivo", label: "Objetivo com o tratamento", type: "longtext" },
  { id: "saude", label: "Saúde e doenças crônicas", type: "longtext" },
  { id: "medicamentos", label: "Medicamentos em uso", type: "longtext" },
  { id: "alergias", label: "Alergias", type: "longtext", flag: true },
  { id: "rotina", label: "Rotina de cuidados em casa", type: "longtext" },
  { id: "anteriores", label: "Procedimentos anteriores", type: "longtext" },
];

/** Modelos de perguntas prontas para a gestora adicionar com um toque. */
export const SUGGESTED_QUESTIONS: Omit<Question, "id">[] = [
  { label: "Está grávida ou amamentando?", type: "yesno", flag: true },
  { label: "Usa protetor solar diariamente?", type: "yesno" },
  {
    label: "Tipo de pele",
    type: "single",
    options: ["Seca", "Oleosa", "Mista", "Normal", "Sensível"],
  },
  { label: "Já teve reação a algum cosmético?", type: "yesno", flag: true },
  { label: "Fuma?", type: "yesno" },
  { label: "Ingestão de água por dia (litros)", type: "number" },
  {
    label: "Preocupações com a pele",
    type: "multi",
    options: ["Manchas", "Acne", "Rugas", "Flacidez", "Poros dilatados", "Olheiras"],
  },
  { label: "Data da última sessão em outro local", type: "date" },
];
