import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Mostra conteúdo em Markdown (aulas).
 * Seguro por omissão: o react-markdown NÃO interpreta HTML embutido e remove
 * endereços perigosos (ex.: "javascript:"). Links externos abrem num novo separador.
 */
const components: Components = {
  h1: (p) => <h2 className="mb-3 mt-8 text-2xl font-bold tracking-tight first:mt-0" {...p} />,
  h2: (p) => <h2 className="mb-3 mt-8 text-xl font-bold tracking-tight first:mt-0" {...p} />,
  h3: (p) => <h3 className="mb-2 mt-6 text-lg font-semibold" {...p} />,
  h4: (p) => <h4 className="mb-2 mt-5 font-semibold" {...p} />,
  p: (p) => <p className="my-3 leading-7" {...p} />,
  ul: (p) => <ul className="my-3 list-disc space-y-1.5 pl-6" {...p} />,
  ol: (p) => <ol className="my-3 list-decimal space-y-1.5 pl-6" {...p} />,
  li: (p) => <li className="leading-7 marker:text-muted-foreground" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  a: ({ href, ...p }) => (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-2"
      {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...p}
    />
  ),
  blockquote: (p) => (
    <blockquote className="my-4 rounded-r-xl border-l-4 border-primary bg-accent px-4 py-2 text-foreground" {...p} />
  ),
  code: (p) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]" {...p} />,
  pre: (p) => <pre className="my-4 overflow-x-auto rounded-xl bg-muted p-4 text-sm [&_code]:bg-transparent [&_code]:p-0" {...p} />,
  hr: () => <hr className="my-6 border-border" />,
  table: (p) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm" {...p} />
    </div>
  ),
  // Nas tabelas, as palavras não são partidas a meio (no telemóvel a tabela desliza na horizontal
  // se precisar); a translineação automática (hífen) usa as regras do português (lang="pt").
  th: (p) => <th className="border-b border-border bg-muted px-3 py-2 font-semibold hyphens-auto [overflow-wrap:normal]" {...p} />,
  td: (p) => <td className="border-b border-border px-3 py-2 align-top hyphens-auto [overflow-wrap:normal]" {...p} />,
  img: ({ alt, src }) =>
    typeof src === "string" && src.startsWith("https://") ? (
      // eslint-disable-next-line @next/next/no-img-element -- imagens externas de conteúdo
      <img src={src} alt={alt ?? ""} loading="lazy" className="my-4 h-auto max-w-full rounded-xl" />
    ) : null,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-base text-foreground [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
