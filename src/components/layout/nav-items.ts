import {
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileText,
  House,
  LayoutDashboard,
  ReceiptText,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do telemóvel (máx. 5 itens). */
  mobile: boolean;
  /** Só fica activo no URL exacto (ex.: "/admin" não deve marcar "/admin/estudantes"). */
  exact?: boolean;
};

/** Navegação da área do estudante (ordem = ordem no menu). */
export const STUDENT_NAV: NavItem[] = [
  { href: "/painel", label: "Início", icon: House, mobile: true },
  { href: "/cursos", label: "Cursos", icon: BookOpen, mobile: true },
  { href: "/manuais", label: "Manuais", icon: FileText, mobile: true },
  { href: "/testes", label: "Testes", icon: ClipboardCheck, mobile: true },
  { href: "/progresso", label: "Progresso", icon: TrendingUp, mobile: false },
  { href: "/assinatura", label: "Assinatura", icon: CreditCard, mobile: false },
  { href: "/perfil", label: "Perfil", icon: UserRound, mobile: true },
];

/** Navegação da área administrativa. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, mobile: true, exact: true },
  { href: "/admin/estudantes", label: "Estudantes", icon: Users, mobile: true },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen, mobile: true },
  { href: "/admin/manuais", label: "Manuais", icon: FileText, mobile: true },
  { href: "/admin/testes", label: "Testes", icon: ClipboardCheck, mobile: true },
  { href: "/admin/planos", label: "Planos", icon: Tags, mobile: true },
  { href: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard, mobile: true },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: ReceiptText, mobile: true },
];

export const NAV_SECTIONS = { student: STUDENT_NAV, admin: ADMIN_NAV } as const;
export type NavSection = keyof typeof NAV_SECTIONS;
