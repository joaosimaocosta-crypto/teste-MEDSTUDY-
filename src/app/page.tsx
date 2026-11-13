import { BookOpen, ClipboardCheck, FileText, GraduationCap, Stethoscope } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const features = [
  { icon: GraduationCap, title: "Cursos organizados", text: "Disciplinas, módulos, capítulos e aulas." },
  { icon: FileText, title: "Manuais oficiais", text: "Biblioteca de PDFs acessível no telemóvel." },
  { icon: ClipboardCheck, title: "Testes e avaliações", text: "Pontuação automática e explicações." },
  { icon: BookOpen, title: "Progresso", text: "Acompanha a tua evolução ao longo do curso." },
];

/** Página inicial provisória (Fase 1) — confirma que o tema e as cores funcionam. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">
            MEDSTUDY <span className="text-primary">MOZ</span>
          </span>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-4">
        <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          Técnico de Medicina Geral
        </span>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Estuda com organização. <span className="text-primary">Aprende com confiança.</span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          A plataforma de estudo para estudantes de Técnico de Medicina Geral em Moçambique.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="flex items-start gap-4 rounded-card border border-border bg-card p-5 shadow-sm"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </article>
        ))}
      </section>

      <footer className="mt-auto text-center text-xs text-muted-foreground">
        © MEDSTUDY MOZ — Fase 1: ambiente preparado
      </footer>
    </main>
  );
}
