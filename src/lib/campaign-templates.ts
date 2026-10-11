/** Campanhas sugeridas: a gestora escolhe, edita o texto e o público, vê a prévia e só então liga. */

export type SegmentType =
  "inactive" | "birthday" | "new" | "confirm" | "near_reward" | "near_level" | "all";

export type Segment = { type: SegmentType; days: number; points: number };
export type CampaignHref =
  "/cliente" | "/cliente/agenda" | "/cliente/conquistas" | "/cliente/evolucao";

export type CampaignTemplate = {
  id: string;
  name: string;
  /** O que ela faz, em uma frase, para a gestora escolher. */
  goal: string;
  segment: Segment;
  title: string;
  body: string;
  href: CampaignHref;
  everyDays: number;
  icon: string;
};

export const VARIABLES = [
  { key: "{nome}", label: "Nome", hint: "primeiro nome da cliente" },
  { key: "{pontos}", label: "Pontos", hint: "saldo de pontos" },
  { key: "{nivel}", label: "Nível", hint: "nível atual" },
  { key: "{premio}", label: "Prêmio", hint: "próximo prêmio ao alcance" },
  { key: "{faltam}", label: "Faltam", hint: "pontos que faltam" },
] as const;

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  inactive: "Sem vir há um tempo (e sem horário marcado)",
  birthday: "Aniversário chegando",
  new: "Cadastrada recentemente, ainda sem atendimento",
  confirm: "Horário pendente de confirmação",
  near_reward: "Perto de um prêmio",
  near_level: "Perto do próximo nível",
  all: "Todas as clientes com o app",
};

/** O que o número do segmento significa em cada tipo (ou nada). */
export const SEGMENT_PARAM: Record<
  SegmentType,
  { field: "days" | "points" | null; label: string; hint: string; min: number }
> = {
  inactive: {
    field: "days",
    label: "Dias sem atendimento",
    hint: "Quem está há pelo menos esse tempo sem vir",
    min: 7,
  },
  birthday: {
    field: "days",
    label: "Dias de antecedência",
    hint: "Avisa quando o aniversário está a esse número de dias",
    min: 0,
  },
  new: {
    field: "days",
    label: "Cadastrada há até (dias)",
    hint: "Só quem entrou nesse prazo e ainda não foi atendida",
    min: 1,
  },
  confirm: { field: null, label: "", hint: "Horários pendentes nas próximas 48 horas", min: 0 },
  near_reward: {
    field: "points",
    label: "Faltam até (pontos)",
    hint: "Quem está a esse número de pontos de um prêmio",
    min: 1,
  },
  near_level: {
    field: "points",
    label: "Faltam até (pontos)",
    hint: "Quem está a esse número de pontos do próximo nível",
    min: 1,
  },
  all: { field: null, label: "", hint: "Cuidado: vai para todas. Use com moderação", min: 0 },
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "saudade",
    name: "Saudade",
    goal: "Traz de volta quem está há tempo sem vir e sem horário marcado.",
    segment: { type: "inactive", days: 60, points: 0 },
    title: "{nome}, que saudade!",
    body: "Faz um tempinho que você não vem. Que tal marcar o seu próximo cuidado?",
    href: "/cliente/agenda",
    everyDays: 30,
    icon: "Heart",
  },
  {
    id: "aniversario",
    name: "Aniversário",
    goal: "Parabeniza na semana do aniversário e convida a agendar.",
    segment: { type: "birthday", days: 7, points: 0 },
    title: "Feliz aniversário, {nome}!",
    body: "A clínica deseja um dia lindo. Que tal comemorar com um cuidado especial?",
    href: "/cliente/agenda",
    everyDays: 330,
    icon: "Gift",
  },
  {
    id: "boas-vindas",
    name: "Boas-vindas",
    goal: "Acolhe quem acabou de entrar e ainda não fez o primeiro atendimento.",
    segment: { type: "new", days: 14, points: 0 },
    title: "Bem-vinda, {nome}!",
    body: "Seu acesso está pronto. Escolha o melhor horário para o seu primeiro atendimento.",
    href: "/cliente/agenda",
    everyDays: 365,
    icon: "Sparkles",
  },
  {
    id: "confirme",
    name: "Confirme seu horário",
    goal: "Lembra de confirmar o horário pendente e reduz faltas.",
    segment: { type: "confirm", days: 0, points: 0 },
    title: "{nome}, confirme seu horário",
    body: "Falta pouco para o seu atendimento. Toque para confirmar a presença (e ganhe pontos).",
    href: "/cliente/agenda",
    everyDays: 3,
    icon: "CalendarCheck",
  },
  {
    id: "perto-premio",
    name: "Perto do prêmio",
    goal: "Incentiva a voltar quando faltam poucos pontos para um prêmio.",
    segment: { type: "near_reward", days: 0, points: 40 },
    title: "Faltam {faltam} pontos para {premio}",
    body: "Você está pertinho! Um novo atendimento pode te levar ao prêmio.",
    href: "/cliente/conquistas",
    everyDays: 14,
    icon: "Trophy",
  },
  {
    id: "perto-nivel",
    name: "Perto do próximo nível",
    goal: "Estimula a subir de nível quando falta pouco.",
    segment: { type: "near_level", days: 0, points: 40 },
    title: "Faltam {faltam} pontos para o próximo nível",
    body: "Você está no nível {nivel} e já está quase lá. Veja suas conquistas.",
    href: "/cliente/conquistas",
    everyDays: 14,
    icon: "Award",
  },
  {
    id: "indique",
    name: "Indique uma amiga",
    goal: "Pede indicações. Os pontos da indicação você entrega manualmente.",
    segment: { type: "all", days: 0, points: 0 },
    title: "Indique uma amiga, {nome}",
    body: "Quando ela vier, você ganha pontos. Conte para a gente quem você indicou!",
    href: "/cliente",
    everyDays: 60,
    icon: "Users",
  },
  {
    id: "novidade",
    name: "Novidade da clínica",
    goal: "Mensagem livre para todas: novo procedimento, horário especial, aviso.",
    segment: { type: "all", days: 0, points: 0 },
    title: "Novidade na clínica",
    body: "Escreva aqui a sua novidade.",
    href: "/cliente",
    everyDays: 30,
    icon: "Megaphone",
  },
];

export const templateById = (id: string) => CAMPAIGN_TEMPLATES.find((item) => item.id === id);

/** Mostra o texto como a cliente vai ver, com dados de exemplo. */
export function previewText(
  text: string,
  sample = {
    nome: "Maria",
    pontos: "120",
    nivel: "Prata",
    premio: "Desconto de R$ 30",
    faltam: "30",
  },
) {
  return text
    .replaceAll("{nome}", sample.nome)
    .replaceAll("{pontos}", sample.pontos)
    .replaceAll("{nivel}", sample.nivel)
    .replaceAll("{premio}", sample.premio)
    .replaceAll("{faltam}", sample.faltam);
}

/** Variáveis do texto que o app não conhece (provável erro de digitação). */
export function unknownVariables(text: string): string[] {
  const known = new Set<string>(VARIABLES.map((item) => item.key));
  return Array.from(new Set(text.match(/\{[^}]*\}/g) ?? [])).filter((item) => !known.has(item));
}

/** Descrição em português de quem recebe. */
export function describeSegment(segment: Segment): string {
  switch (segment.type) {
    case "inactive":
      return `Sem atendimento há ${segment.days}+ dias e sem horário marcado`;
    case "birthday":
      return segment.days > 0 ? `Aniversário em até ${segment.days} dias` : "Aniversário hoje";
    case "new":
      return `Cadastrada há até ${segment.days} dias e sem atendimento`;
    case "confirm":
      return "Horário pendente nas próximas 48 horas";
    case "near_reward":
      return `Faltam até ${segment.points} pontos para um prêmio`;
    case "near_level":
      return `Faltam até ${segment.points} pontos para o próximo nível`;
    default:
      return "Todas as clientes com o app";
  }
}
