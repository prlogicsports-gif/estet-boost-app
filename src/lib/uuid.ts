/** Identificador único (o banco usa uuid em todas as tabelas). */
export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const r = (Math.random() * 16) | 0;
        return (char === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
