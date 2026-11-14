"use client";

import { useActionState, useId } from "react";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/validations/auth";
import { ACADEMIC_YEARS, PROVINCES } from "@/lib/validations/profile";
import { cn } from "@/lib/utils";
import { updateProfile } from "./actions";

export type ProfileValues = {
  fullName: string;
  phone: string;
  province: string;
  institution: string;
  academicYear: string;
};

const selectClasses = cn(
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-foreground transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25",
  "aria-invalid:border-danger",
);

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, formAction] = useActionState(updateProfile, initialFormState);
  const uid = useId(); // ids únicos (o Next.js pode manter páginas anteriores escondidas no DOM)
  const v = { ...initial, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    // key: repõe os campos com os valores guardados após cada submissão
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <FormField
        label="Nome completo"
        name="fullName"
        autoComplete="name"
        defaultValue={v.fullName}
        errors={errors.fullName}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Telefone (opcional)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="84 123 4567"
          defaultValue={v.phone}
          errors={errors.phone}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-province`} className="text-sm font-medium">
            Província (opcional)
          </label>
          <select
            id={`${uid}-province`}
            name="province"
            defaultValue={v.province}
            aria-invalid={errors.province ? true : undefined}
            className={selectClasses}
          >
            <option value="">Seleccione…</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.province && <p className="text-sm text-danger" role="alert">{errors.province[0]}</p>}
        </div>

        <FormField
          label="Instituição de ensino (opcional)"
          name="institution"
          placeholder="Ex.: Instituto de Ciências de Saúde"
          defaultValue={v.institution}
          errors={errors.institution}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-academicYear`} className="text-sm font-medium">
            Ano do curso (opcional)
          </label>
          <select
            id={`${uid}-academicYear`}
            name="academicYear"
            defaultValue={v.academicYear}
            aria-invalid={errors.academicYear ? true : undefined}
            className={selectClasses}
          >
            <option value="">Seleccione…</option>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}.º ano
              </option>
            ))}
          </select>
          {errors.academicYear && (
            <p className="text-sm text-danger" role="alert">{errors.academicYear[0]}</p>
          )}
        </div>
      </div>

      <SubmitButton className="self-start" pendingText="A guardar…">
        Guardar alterações
      </SubmitButton>
    </form>
  );
}
