import { useEffect, useState } from "react";

export type GeneralAction = {
  id: string;
  nome: string;
  descricao: string;
  duracao: string;
  icone: string;
  exemplo?: boolean;
};

export const ACOES_GERAIS_EXEMPLO: GeneralAction[] = [
  {
    id: "g-peeling-rosto",
    nome: "Peeling no rosto todo",
    descricao: "Aplicação uniforme em toda a face, sem marcação por região.",
    icone: "Sparkles",
    duracao: "45 min",
    exemplo: true,
  },
];

const KEY = "eb-mapa-facial-acoes-gerais-v1";

function load(): GeneralAction[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return Array.isArray(list) && list.length ? (list as GeneralAction[]) : ACOES_GERAIS_EXEMPLO;
  } catch {
    return ACOES_GERAIS_EXEMPLO;
  }
}

/** Ações do rosto todo: a esteticista cria as dela, e a lista nasce com um exemplo. */
export function useGeneralActions() {
  const [actions, setActions] = useState<GeneralAction[]>(ACOES_GERAIS_EXEMPLO);

  useEffect(() => setActions(load()), []);

  const update = (next: GeneralAction[]) => {
    setActions(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignorado */
    }
  };
  return { actions, update };
}
