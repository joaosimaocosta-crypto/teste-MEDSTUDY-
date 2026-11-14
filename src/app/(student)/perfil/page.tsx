import { KeyRound, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { formatPhoneForInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Perfil" description="Os seus dados pessoais e a sua conta." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser(ROUTES.profile);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, province, institution, academic_year")
    .eq("id", user.id)
    .single();

  const initials = (user.fullName || user.email || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
      <Card className="lg:col-span-2">
        <CardHeader title="Dados pessoais" />
        <ProfileForm
          initial={{
            fullName: profile?.full_name ?? "",
            phone: formatPhoneForInput(profile?.phone ?? null),
            province: profile?.province ?? "",
            institution: profile?.institution ?? "",
            academicYear: profile?.academic_year ? String(profile.academic_year) : "",
          }}
        />
      </Card>

      <Card className="flex flex-col gap-4 self-start">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.fullName || "Estudante"}</p>
            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{user.email}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Link href={ROUTES.newPassword} className={buttonClasses({ variant: "secondary", fullWidth: true })}>
            <KeyRound className="size-4" aria-hidden />
            Alterar senha
          </Link>
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}
