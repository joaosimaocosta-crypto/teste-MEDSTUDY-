import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { PROTECTED_PREFIXES } from "@/lib/auth/routes";

/**
 * /robots.txt — os motores de busca só indexam as páginas públicas.
 * (Isto NÃO é uma protecção: as áreas privadas continuam protegidas pelo
 * proxy, pelas páginas e pelo RLS. Serve apenas para não aparecerem no Google.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PROTECTED_PREFIXES, "/api/", "/auth/"],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
