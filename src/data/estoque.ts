/** Produtos da clínica: a mesma lista alimenta o mapa facial e a aba Estoque da Gestão. */
export type Produto = { nome: string; unidade: string; quantidade: number; minimo: number };

export const PRODUTOS: Produto[] = [
  { nome: "Ácido mandélico 5%", unidade: "fr", quantidade: 2, minimo: 3 },
  { nome: "Argila verde", unidade: "pt", quantidade: 6, minimo: 2 },
  { nome: "Máscara calmante", unidade: "un", quantidade: 1, minimo: 4 },
  { nome: "Gel de limpeza suave", unidade: "fr", quantidade: 5, minimo: 2 },
  { nome: "Vitamina C 10%", unidade: "fr", quantidade: 3, minimo: 2 },
  { nome: "Protetor solar FPS 50", unidade: "un", quantidade: 4, minimo: 2 },
  { nome: "Gaze estéril", unidade: "pc", quantidade: 14, minimo: 5 },
];
