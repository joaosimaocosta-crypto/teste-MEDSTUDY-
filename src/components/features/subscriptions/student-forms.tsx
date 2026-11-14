"use client";

import { Check } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { requestSubscription } from "@/app/(student)/assinatura/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMZN } from "@/lib/format";
import { initialFormState } from "@/lib/validations/auth";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_mzn: number;
  duration_days: number;
  features: string[];
  course: { title: string } | null;
};

/** Cartão de plano com pedido (o estudante pode juntar a referência do pagamento). */
export function PlanCard({ plan, disabled }: { plan: Plan; disabled: string | null }) {
  const [state, action] = useActionState(requestSubscription, initialFormState);
  const [open, setOpen] = useState(false);
  const uid = useId();

  return (
    <article
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-sm"
    >
      <div>
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
      </div>
      <p>
        <span className="text-3xl font-bold tabular-nums">{formatMZN(Number(plan.price_mzn))}</span>
        <span className="text-sm text-muted-foreground"> / {plan.duration_days} dias</span>
      </p>
      <p className="text-xs text-muted-foreground">{plan.course ? `Acesso ao curso: ${plan.course.title}` : "Acesso a todos os cursos"}</p>
      {plan.features.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {state.error && <Alert variant="error">{state.error}</Alert>}
        {state.success ? (
          <Alert variant="success">{state.success}</Alert>
        ) : disabled ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm text-muted-foreground">{disabled}</p>
        ) : !open ? (
          <Button fullWidth onClick={() => setOpen(true)}>
            Escolher este plano
          </Button>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="plan_id" value={plan.id} />
            <label htmlFor={`${uid}-notes`} className="text-sm font-medium">
              Referência do pagamento (opcional)
            </label>
            <textarea
              id={`${uid}-notes`}
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="Ex.: M-Pesa, ID da transacção…"
              className="rounded-xl border border-border bg-card px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25"
            />
            {state.fieldErrors?.notes && <p className="text-sm text-danger">{state.fieldErrors.notes[0]}</p>}
            <div className="flex gap-2">
              <SubmitButton className="flex-1" pendingText="A enviar…">
                Enviar pedido
              </SubmitButton>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
