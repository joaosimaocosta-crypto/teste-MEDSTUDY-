import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/lib/auth/routes";

/** Página provisória para secções ainda em desenvolvimento. */
export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={icon}
          title="Disponível em breve"
          description="Esta secção está a ser preparada e ficará disponível numa próxima actualização."
          action={
            <Link href={ROUTES.dashboard} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Voltar ao início
            </Link>
          }
        />
      </Card>
    </>
  );
}
