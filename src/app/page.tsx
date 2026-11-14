import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Layers,
  MoonStar,
  Smartphone,
  TrendingUp,
  UserPlus,
  WalletCards,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROUTES } from "@/lib/auth/routes";

const FEATURES = [
  {
    icon: Layers,
    title: "Conteúdos organizados",
    text: "Cada disciplina dividida em módulos, capítulos e aulas — sabe sempre o que estudar a seguir.",
  },
  {
    icon: FileText,
    title: "Manuais oficiais",
    text: "Consulte os manuais em PDF directamente no telemóvel, sem precisar de os descarregar.",
  },
  {
    icon: ClipboardCheck,
    title: "Testes com correcção",
    text: "Perguntas de escolha múltipla com pontuação automática e a explicação de cada resposta.",
  },
  {
    icon: TrendingUp,
    title: "Acompanhe o progresso",
    text: "Veja as aulas concluídas, os resultados dos testes e a evolução em cada disciplina.",
  },
  {
    icon: Smartphone,
    title: "Feito para o telemóvel",
    text: "Funciona em Android, iPhone, tablet e computador — estude onde estiver.",
  },
  {
    icon: MoonStar,
    title: "Tema claro e escuro",
    text: "Leitura confortável de dia e de noite, com um toque.",
  },
];

const STEPS = [
  { icon: UserPlus, title: "Crie a sua conta", text: "O registo é gratuito e leva menos de um minuto." },
  {
    icon: WalletCards,
    title: "Escolha um plano mensal",
    text: "Após a confirmação do pagamento, o acesso completo é activado.",
  },
  { icon: GraduationCap, title: "Comece a estudar", text: "Aulas, manuais e testes num só lugar." },
];

const HIERARCHY = ["Curso", "Disciplina", "Módulo", "Capítulo", "Aula"];

/** Página inicial pública (estática — carrega instantaneamente). */
export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo href={null} />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Conta">
            <Link href={ROUTES.login} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Entrar
            </Link>
            <Link
              href={ROUTES.register}
              className={buttonClasses({ size: "sm", className: "hidden sm:inline-flex" })}
            >
              Criar conta
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:gap-12 lg:pb-20">
          <div className="flex flex-col gap-5">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Técnico de Medicina Geral · Moçambique
            </span>
            <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">
              Estude com organização.{" "}
              <span className="text-primary">Aprenda com confiança.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Aulas estruturadas, manuais oficiais e testes com correcção automática — tudo o que
              precisa para o curso de Técnico de Medicina Geral, no seu telemóvel.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={ROUTES.register} className={buttonClasses({ size: "lg" })}>
                Criar conta gratuita
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href={ROUTES.login} className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Já tenho conta
              </Link>
            </div>
          </div>

          {/* Ilustração: a organização dos conteúdos */}
          <div className="relative" aria-hidden>
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-accent to-secondary/10 blur-2xl" />
            <div className="rounded-card border border-border bg-card p-5 shadow-lg sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <BookOpen className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Como os conteúdos estão organizados</p>
                  <p className="text-xs text-muted-foreground">Do geral para o específico</p>
                </div>
              </div>
              <ol className="flex flex-col gap-2">
                {HIERARCHY.map((level, i) => (
                  <li
                    key={level}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                    style={{ marginLeft: `${i * 12}px` }}
                  >
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{level}</span>
                    {i < HIERARCHY.length - 1 && (
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                Cada aula tem os seus recursos: textos, vídeos, documentos e testes.
              </p>
            </div>
          </div>
        </section>

        {/* Funcionalidades */}
        <section id="funcionalidades" className="border-y border-border bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Tudo o que precisa para estudar</h2>
              <p className="mt-2 text-muted-foreground">
                Uma plataforma pensada para a realidade dos estudantes moçambicanos.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-card border border-border bg-card p-5 shadow-sm">
                  <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">Como funciona</h2>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Passo {i + 1}
                  </p>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Chamada final */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start gap-4 rounded-card bg-primary p-6 text-primary-foreground sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Pronto para começar?</h2>
              <p className="mt-1 opacity-90">Crie a sua conta e explore a plataforma.</p>
            </div>
            <Link
              href={ROUTES.register}
              className={buttonClasses({
                variant: "secondary",
                size: "lg",
                className: "border-transparent bg-white text-[#0f172a] hover:bg-white/90",
              })}
            >
              Criar conta gratuita
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© MEDSTUDY MOZ — Plataforma educacional.</p>
          <div className="flex gap-4">
            <Link href={ROUTES.login} className="hover:text-foreground">
              Entrar
            </Link>
            <Link href={ROUTES.register} className="hover:text-foreground">
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
