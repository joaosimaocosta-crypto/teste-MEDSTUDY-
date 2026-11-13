"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NAV_SECTIONS, STUDENT_NAV, type NavItem, type NavSection } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

// Nota: os ícones são componentes (funções) e não podem ser passados do servidor
// para um Client Component; por isso escolhe-se a lista pelo nome da secção.

function isActive(pathname: string | null, item: NavItem) {
  if (pathname === null) return false;
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/*
 * Em rotas dinâmicas (ex.: /admin/estudantes/[id]) o URL só é conhecido no pedido.
 * Cada menu é mostrado de imediato (fallback, sem item activo) e o item activo é
 * marcado assim que o URL estiver disponível — exigência do Next.js 16 (Suspense).
 */
export function SidebarNav({ section = "student" }: { section?: NavSection }) {
  return (
    <Suspense fallback={<SidebarNavView section={section} pathname={null} />}>
      <SidebarNavLive section={section} />
    </Suspense>
  );
}
function SidebarNavLive({ section }: { section: NavSection }) {
  return <SidebarNavView section={section} pathname={usePathname()} />;
}

export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname={null} />}>
      <BottomNavLive />
    </Suspense>
  );
}
function BottomNavLive() {
  return <BottomNavView pathname={usePathname()} />;
}

export function ScrollTabsNav({ section }: { section: NavSection }) {
  return (
    <Suspense fallback={<ScrollTabsNavView section={section} pathname={null} />}>
      <ScrollTabsNavLive section={section} />
    </Suspense>
  );
}
function ScrollTabsNavLive({ section }: { section: NavSection }) {
  return <ScrollTabsNavView section={section} pathname={usePathname()} />;
}

/** Menu lateral (computador). */
function SidebarNavView({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string | null;
}) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {NAV_SECTIONS[section].map((item) => {
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, item);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de navegação inferior do estudante (telemóvel) — alvos de toque com 56px de altura. */
function BottomNavView({ pathname }: { pathname: string | null }) {
  const items = STUDENT_NAV.filter((i) => i.mobile);
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActive(pathname, item);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-12 items-center justify-center rounded-full transition",
                    active && "bg-accent",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Separadores horizontais deslizantes (administração no telemóvel). */
function ScrollTabsNavView({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string | null;
}) {
  return (
    <nav aria-label="Navegação principal" className="lg:hidden">
      <ul className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {NAV_SECTIONS[section].map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActive(pathname, item);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
