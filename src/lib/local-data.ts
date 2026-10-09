/**
 * Dados operacionais que ainda vivem no aparelho (até migrarem para o Supabase). Para que duas contas
 * diferentes no mesmo aparelho nunca vejam os dados uma da outra, tudo é apagado quando quem entra
 * não é a mesma pessoa que entrou da última vez.
 */
const OWNER_KEY = "eb.owner";
const PREFIXES = ["eb:v1:", "estetboost:"];

/** Apaga os dados locais do app (clientes, agenda, caixa, fotos…). Não mexe na sessão do Supabase. */
export function wipeLocalData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
    window.indexedDB.deleteDatabase("estetboost-fotos");
  } catch {
    /* sem armazenamento */
  }
}

/** Se este aparelho guardava dados locais de outra pessoa (versões antigas do app), apaga-os em silêncio. */
export function ensureOwner(uid: string) {
  try {
    const owner = window.localStorage.getItem(OWNER_KEY);
    if (owner === uid) return;
    window.localStorage.setItem(OWNER_KEY, uid);
    if (owner) wipeLocalData();
  } catch {
    /* sem armazenamento */
  }
}
