import { formatWeekday, todayISO } from "@/lib/dates";

const isMobile = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/** Só dígitos, com o 55 do Brasil quando vier sem. Vazio quando não há número. */
export function waDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

/**
 * Abre o WhatsApp. No celular usa o endereço `whatsapp://`, que abre o aplicativo sem trocar a página do
 * EstetBoost. (abrir o site wa.me dentro do app instalado deixava a tela branca ao voltar). Se o
 * WhatsApp não abrir, cai para o wa.me numa nova aba.
 */
export function openWhatsApp(phone: string, text: string) {
  const number = waDigits(phone);
  const query = `text=${encodeURIComponent(text)}`;
  const web = `https://wa.me/${number}?${query}`;
  if (!isMobile()) {
    window.open(web, "_blank", "noopener");
    return;
  }
  const link = document.createElement("a");
  link.href = `whatsapp://send?${number ? `phone=${number}&` : ""}${query}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  let left = false;
  const onHide = () => {
    left = true;
  };
  document.addEventListener("visibilitychange", onHide, { once: true });
  link.click();
  link.remove();
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left && document.visibilityState === "visible") window.open(web, "_blank", "noopener");
  }, 1600);
}

/** Mensagem de confirmação de horário (a gestora vê e envia pelo próprio WhatsApp). */
export function confirmationText(a: {
  client: string;
  procedure: string;
  date: string;
  time: string;
}): string {
  const first = a.client.trim().split(/\s+/)[0] ?? "";
  const when =
    a.date === todayISO()
      ? `hoje às ${a.time}`
      : `${formatWeekday(a.date)} (${a.date.split("-").reverse().slice(0, 2).join("/")}) às ${a.time}`;
  return `Olá, ${first}! Tudo bem? Passando para confirmar o seu horário de ${a.procedure}, ${when}. Pode me confirmar a sua presença? Se precisar remarcar, é só me avisar por aqui. Obrigada!`;
}
