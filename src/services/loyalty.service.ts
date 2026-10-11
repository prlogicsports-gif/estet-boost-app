import { supabase } from "@/lib/supabase";

export type LoyaltyLevel = { id: string; name: string; min: number };
export type LoyaltyPoints = {
  session_done: number;
  first_visit: number;
  return_on_time: number;
  confirmed: number;
  signup: number;
  return_days: number;
};
export type BadgeCriteria =
  "sessions_count" | "confirmed_count" | "points_total" | "streak" | "manual";

export type MyBadge = {
  id: string;
  name: string;
  icon: string;
  criteria: BadgeCriteria;
  threshold: number;
  earned: boolean;
  earned_at: string | null;
  progress: number | null;
};
export type MyLoyalty =
  | { enabled: false }
  | {
      enabled: true;
      /** Saldo para gastar. O nível e o ranking usam `earned` (gastar não rebaixa). */
      points: number;
      earned: number;
      level: LoyaltyLevel | null;
      next: { name: string; min: number; remaining: number } | null;
      levels: LoyaltyLevel[];
      badges: MyBadge[];
      history: { event: string; points: number; note: string | null; at: string }[];
      ranking: {
        enabled: boolean;
        optin: boolean;
        nickname: string | null;
        position: number | null;
      };
    };
export type RankingRow = { position: number; nickname: string; points: number; me: boolean };

export type AdminBadge = {
  id: string;
  name: string;
  icon: string;
  criteria: BadgeCriteria;
  threshold: number;
  active: boolean;
  earned_by: number;
};
export type LoyaltyAdmin = {
  ok: true;
  config: {
    enabled: boolean;
    ranking_enabled: boolean;
    points: LoyaltyPoints;
    levels: LoyaltyLevel[];
  };
  badges: AdminBadge[];
  overview: {
    clients: number;
    participants: number;
    points_issued: number;
    ranking_members: number;
    top: { client_id: string; name: string; points: number }[];
  };
};

const REASONS: Record<string, string> = {
  sem_permissao: "Só a gestora pode fazer isso.",
  apelido_invalido: "Use de 2 a 24 letras, números, espaço, ponto ou hífen.",
  apelido_em_uso: "Esse apelido já está em uso. Escolha outro.",
  ranking_desligado: "A clínica desligou o ranking.",
  programa_desligado: "Ligue o programa de fidelidade primeiro.",
  pontos_invalidos: "Informe de 1 a 1000 pontos (ou negativo para tirar).",
  nao_encontrado: "Não encontrado.",
  nome_vazio: "Dê um nome ao selo.",
  limite_invalido: "Informe quanto é preciso para ganhar o selo.",
  limite_de_selos: "Você chegou ao limite de selos.",
  premio_indisponivel: "Esse prêmio não está mais disponível.",
  premio_esgotado: "Esse prêmio esgotou.",
  pontos_insuficientes: "Pontos insuficientes.",
  ja_pedido: "Você já pediu esse prêmio. Aguarde a resposta da clínica.",
  custo_invalido: "Informe quantos pontos o prêmio custa.",
  quantidade_invalida: "A quantidade não pode ser negativa.",
  limite_de_premios: "Você chegou ao limite de prêmios.",
  tem_pedidos_abertos: "Há pedidos abertos desse prêmio. Resolva-os antes de excluir.",
  estado_invalido: "Esse pedido já foi resolvido.",
};
export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; message: string };

async function call<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error)
      return { ok: false, message: "Não foi possível agora. Confira a internet e tente de novo." };
    const result = data as { ok?: boolean; reason?: string } | null;
    if (result && result.ok === false)
      return { ok: false, message: REASONS[result.reason ?? ""] ?? "Não foi possível concluir." };
    return { ok: true, ...(result as T) };
  } catch {
    return { ok: false, message: "Não foi possível agora. Confira a internet e tente de novo." };
  }
}

export async function loadMyLoyalty(): Promise<MyLoyalty> {
  const { data, error } = await supabase.rpc("my_loyalty");
  if (error) throw error;
  return data as MyLoyalty;
}
export async function loadRanking(): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc("loyalty_ranking");
  if (error) throw error;
  return (data ?? []) as RankingRow[];
}
export const setRankingOptin = (optin: boolean, nickname: string) =>
  call("set_ranking_optin", { p_optin: optin, p_nickname: nickname });

export async function loadLoyaltyAdmin(): Promise<LoyaltyAdmin> {
  const { data, error } = await supabase.rpc("loyalty_admin");
  if (error) throw error;
  return data as LoyaltyAdmin;
}
export const saveLoyaltyConfig = (config: LoyaltyAdmin["config"]) =>
  call("save_loyalty_config", {
    p_enabled: config.enabled,
    p_ranking: config.ranking_enabled,
    p_points: config.points,
    p_levels: config.levels,
  });
export const saveBadge = (badge: {
  id?: string | null;
  name: string;
  icon: string;
  criteria: BadgeCriteria;
  threshold: number;
  active: boolean;
}) =>
  call("save_badge", {
    p_id: badge.id ?? null,
    p_name: badge.name,
    p_icon: badge.icon,
    p_criteria: badge.criteria,
    p_threshold: badge.threshold,
    p_active: badge.active,
  });
export const deleteBadge = (id: string) => call("delete_badge", { p_id: id });
export const grantBadge = (badgeId: string, clientId: string) =>
  call("grant_badge", { p_badge: badgeId, p_client: clientId });
export const awardManual = (clientId: string, points: number, note: string) =>
  call("award_manual", { p_client: clientId, p_points: points, p_note: note });
export const loyaltyBackfill = () => call<{ created: number }>("loyalty_backfill");

export const CRITERIA_LABEL: Record<BadgeCriteria, string> = {
  sessions_count: "atendimentos concluídos",
  confirmed_count: "presenças confirmadas",
  points_total: "pontos acumulados",
  streak: "meses seguidos com atendimento",
  manual: "entregue pela gestora",
};

export const EVENT_LABEL: Record<string, string> = {
  session_done: "Atendimento concluído",
  first_visit: "Primeira visita",
  return_on_time: "Retorno no prazo",
  confirmed: "Presença confirmada",
  signup: "Cadastro",
  manual: "Ajuste da clínica",
};

export const BADGE_ICONS = [
  "Star",
  "Trophy",
  "Medal",
  "Crown",
  "Heart",
  "Flame",
  "Gift",
  "Award",
  "Sparkles",
  "Gem",
] as const;

// ---------------------------------------------------------------- prêmios
export type MyReward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  valid_until: string | null;
  remaining: number | null;
  pending: boolean;
  can_redeem: boolean;
};
export type RedeemStatus = "pendente" | "aprovado" | "recusado" | "entregue" | "cancelado";
export type MyRewards =
  | { enabled: false }
  | {
      enabled: true;
      available: number;
      rewards: MyReward[];
      requests: { id: string; reward: string; cost: number; status: RedeemStatus; at: string }[];
    };
export const STATUS_LABEL: Record<RedeemStatus, string> = {
  pendente: "Aguardando a clínica",
  aprovado: "Aprovado",
  recusado: "Não aprovado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export async function loadMyRewards(): Promise<MyRewards> {
  const { data, error } = await supabase.rpc("my_rewards");
  if (error) throw error;
  return data as MyRewards;
}
export const requestRedeem = (rewardId: string) => call("request_redeem", { p_reward: rewardId });
export const cancelMyRedeem = (id: string) => call("cancel_my_redeem", { p_id: id });

export type AdminReward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  valid_until: string | null;
  quantity: number | null;
  active: boolean;
  used: number;
};
export type AdminRedemption = {
  id: string;
  client_id: string;
  client: string;
  reward: string;
  cost: number;
  status: RedeemStatus;
  at: string;
  decided_at: string | null;
  balance: number;
};
export type RewardsAdmin = { ok: true; rewards: AdminReward[]; redemptions: AdminRedemption[] };

export async function loadRewardsAdmin(): Promise<RewardsAdmin> {
  const { data, error } = await supabase.rpc("rewards_admin");
  if (error) throw error;
  return data as RewardsAdmin;
}
export const saveReward = (reward: {
  id?: string | null;
  name: string;
  description: string;
  cost: number;
  valid_until: string | null;
  quantity: number | null;
  active: boolean;
}) =>
  call("save_reward", {
    p_id: reward.id ?? null,
    p_name: reward.name,
    p_description: reward.description,
    p_cost: reward.cost,
    p_valid_until: reward.valid_until,
    p_quantity: reward.quantity,
    p_active: reward.active,
  });
export const deleteReward = (id: string) => call("delete_reward", { p_id: id });
export const decideRedeem = (
  id: string,
  decision: "aprovar" | "recusar" | "entregar" | "cancelar",
) => call("decide_redeem", { p_id: id, p_decision: decision });
