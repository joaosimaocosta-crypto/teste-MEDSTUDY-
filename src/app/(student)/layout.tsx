import { StudentShell } from "@/components/layout/student-shell";

/**
 * Layout da área do estudante. Não lê a sessão aqui (ficaria tudo à espera);
 * cada página verifica a sessão dentro de <Suspense> com requireUser().
 */
export default function StudentLayout({ children }: LayoutProps<"/">) {
  return <StudentShell>{children}</StudentShell>;
}
