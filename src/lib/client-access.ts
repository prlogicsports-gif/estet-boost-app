/** Textos e utilitários do acesso da cliente ao app (criado pela gestora ou enviado por link). */

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Senha legível de 10 caracteres, sem letras que se confundem (l, I, O, 0, 1). */
export function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 2 ** 32);
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

export const appLink = () => (typeof window === "undefined" ? "" : `${window.location.origin}/`);

export const INSTALL_STEPS = [
  "iPhone: abra o link no Safari, toque em Compartilhar e em Adicionar à Tela de Início.",
  "Android: abra o link no Chrome, toque no menu (três pontos) e em Instalar app.",
];

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Mensagem com o acesso pronto (link, e-mail e senha) e como instalar o app. */
export function accessMessage(input: {
  name: string;
  clinic: string;
  link: string;
  email: string;
  password: string;
}): string {
  return [
    `Olá, ${firstName(input.name)}! Seu acesso ao app de ${input.clinic} está pronto.`,
    "",
    `1. Abra: ${input.link}`,
    `2. Entre com o e-mail ${input.email} e a senha ${input.password}`,
    "",
    "Para instalar como aplicativo no celular:",
    ...INSTALL_STEPS,
  ].join("\n");
}

/** Mensagem com o link de cadastro (a cliente cria a própria conta) e como instalar o app. */
export function signupMessage(input: { name: string; clinic: string; link: string }): string {
  return [
    `Olá, ${firstName(input.name)}! Faça seu cadastro no app de ${input.clinic} para acompanhar seus atendimentos:`,
    input.link,
    "",
    "Para instalar como aplicativo no celular:",
    ...INSTALL_STEPS,
  ].join("\n");
}
