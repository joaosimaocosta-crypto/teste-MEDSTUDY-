import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { ROUTES } from "@/lib/auth/routes";

/** /sitemap.xml — apenas as páginas públicas. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return [
    { url: `${base}${ROUTES.home}`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}${ROUTES.register}`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${base}${ROUTES.login}`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
