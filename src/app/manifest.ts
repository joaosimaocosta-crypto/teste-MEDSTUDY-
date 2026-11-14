import type { MetadataRoute } from "next";

/** /manifest.webmanifest — permite "Adicionar ao ecrã principal" no telemóvel. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEDSTUDY MOZ",
    short_name: "MEDSTUDY",
    description: "Plataforma de estudo para estudantes dos cursos de Saúde em Moçambique.",
    lang: "pt",
    start_url: "/painel",
    display: "standalone",
    background_color: "#f6f9fb",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
