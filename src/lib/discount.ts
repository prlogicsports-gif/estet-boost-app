export type Discount = { kind: "valor" | "percent"; value: number };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Quanto sai do total: em valor nunca passa do total, em porcentagem vai de 0 a 100 (igual ao banco). */
export function discountAmount(gross: number, discount?: Discount | null): number {
  if (!discount || !(discount.value > 0) || !(gross > 0)) return 0;
  return discount.kind === "percent"
    ? cents((gross * Math.min(discount.value, 100)) / 100)
    : Math.min(cents(discount.value), gross);
}

export const afterDiscount = (gross: number, discount?: Discount | null) =>
  cents(gross - discountAmount(gross, discount));

/** Texto curto do desconto para o resumo ("10%" ou "R$ 50,00"). */
export const describeDiscount = (discount: Discount, money: (n: number) => string) =>
  discount.kind === "percent" ? `${discount.value}%` : money(discount.value);
