"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/** Botão para alternar entre tema claro e escuro. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Alternar tema claro/escuro"
      className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* Os dois ícones são renderizados; o CSS mostra o correcto (evita diferenças entre servidor e cliente). */}
      <Sun className="size-5 dark:hidden" aria-hidden />
      <Moon className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}
