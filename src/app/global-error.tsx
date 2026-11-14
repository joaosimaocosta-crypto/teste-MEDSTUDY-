"use client";

/**
 * Erro no layout principal (raro). Substitui todo o documento, por isso não usa
 * os estilos globais: estilos simples inline, compatíveis com tema claro/escuro.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
          colorScheme: "light dark",
        }}
      >
        <title>Erro · MEDSTUDY MOZ</title>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>MEDSTUDY MOZ — Algo correu mal</h1>
          <p style={{ opacity: 0.75, marginBottom: 20 }}>Ocorreu um erro inesperado. Tente novamente dentro de instantes.</p>
          <button
            onClick={() => retry()}
            style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: "#0d9488", color: "#fff", fontWeight: 600, fontSize: 16 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
