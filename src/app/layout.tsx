import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Plataforma de estudo para estudantes dos cursos de Saúde em Moçambique.";

export const metadata: Metadata = {
  // Base dos links absolutos (partilha em redes sociais, sitemap): o domínio público.
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "MEDSTUDY MOZ",
    template: "%s · MEDSTUDY MOZ",
  },
  description: DESCRIPTION,
  applicationName: "MEDSTUDY MOZ",
  openGraph: {
    type: "website",
    locale: "pt_MZ",
    siteName: "MEDSTUDY MOZ",
    title: "MEDSTUDY MOZ",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o next-themes altera a classe do <html> antes da hidratação.
    <html lang="pt" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
