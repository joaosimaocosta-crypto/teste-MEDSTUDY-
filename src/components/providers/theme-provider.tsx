"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Envolve a aplicação e gere o tema claro/escuro.
 * Guarda a escolha do utilizador no browser e respeita o tema do sistema por omissão.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
