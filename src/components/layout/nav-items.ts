import {
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileText,
  House,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do telemóvel (máx. 5 itens). */
  mobile: boolean;
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
