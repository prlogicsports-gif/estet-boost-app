import {
  Bell,
  BookOpen,
  CalendarDays,
  History,
  House,
  KeyRound,
  LayoutDashboard,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
  Package,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Area, PermissionKey } from "@/lib/auth.types";

/** `needs`: a funcionária precisa de ao menos uma destas permissões. `adminOnly`: só a gestora. */
export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  needs?: PermissionKey[];
  adminOnly?: boolean;
  /** Rótulo curto para o dock do celular (o menu "Mais" e a barra lateral usam `label`). */
  dockLabel?: string;
  /** No menu "Mais": seção em que o item aparece. */
  group?: "gestao" | "conta";
};
export type NavConfig = {
  role: Area;
  /** Itens do dock no celular. */
  primary: NavItem[];
  /** Itens que no celular ficam em "Mais". Vazio: sem menu "Mais". */
  secondary: NavItem[];
  /** Largura máxima do conteúdo. */
  maxWidth: string;
};

export const gestorNav: NavConfig = {
  role: "gestor",
  primary: [
    { to: "/hoje", label: "Hoje", icon: Sun },
    { to: "/agenda", label: "Agenda", icon: CalendarDays, needs: ["agenda"] },
    {
      to: "/clientes",
      label: "Clientes",
      icon: Users,
      needs: ["clientes"],
    },
    { to: "/financeiro", label: "Financeiro", icon: Wallet, needs: ["financeiro"] },
  ],
  secondary: [
    {
      to: "/estoque",
      label: "Produtos e estoque",
      dockLabel: "Estoque",
      icon: Package,
      needs: ["estoque"],
      group: "gestao",
    },
    { to: "/historico", label: "Histórico", icon: History, needs: ["historico"], group: "gestao" },
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      adminOnly: true,
      group: "gestao",
    },
    { to: "/catalogo", label: "Catálogo", icon: BookOpen, adminOnly: true, group: "gestao" },
    { to: "/notificacoes", label: "Notificações", icon: Bell, group: "conta" },
    { to: "/credenciais", label: "Credenciais", icon: KeyRound, adminOnly: true, group: "conta" },
    { to: "/configuracoes", label: "Configurações", icon: Settings, group: "conta" },
  ],
  maxWidth: "var(--content-max, 1120px)",
};

export const clienteNav: NavConfig = {
  role: "cliente",
  primary: [
    { to: "/cliente", label: "Início", icon: House },
    { to: "/cliente/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/cliente/evolucao", label: "Evolução", icon: Sparkles },
    { to: "/cliente/perfil", label: "Perfil", icon: User },
  ],
  secondary: [],
  maxWidth: "var(--content-narrow, 640px)",
};
