"use client";

import { Ban, CirclePlay, Pencil, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { assignSubscription, subscriptionAction } from "@/app/admin/assinaturas/actions";
import { recordPayment } from "@/app/admin/pagamentos/actions";
import { deletePlan, savePlan, saveSettings } from "@/app/admin/planos/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMZN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { initialFormState } from "@/lib/validations/auth";
import { PAYMENT_METHODS } from "@/lib/validations/subscriptions";

const controlCls = cn(
  "w-full rounded-xl border border-border bg-card px-4 text-base text-foreground transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 aria-invalid:border-danger",
);
const Err = ({ e }: { e?: string[] }) => (e?.length ? <p className="text-sm text-danger" role="alert">{e[0]}</p> : null);

// =============================================================================
// Acções sobre uma assinatura
// =============================================================================
export function SubscriptionActions({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState(subscriptionAction, initialFormState);
  const [confirm, setConfirm] = useState<null | "activate" | "renew" | "suspend" | "reactivate">(null);

  const ops: { op: NonNullable<typeof confirm>; label: string; icon: typeof Ban; variant: "primary" | "secondary" | "danger" }[] = [];
  if (status === "pending") ops.push({ op: "activate", label: "Activar", icon: CirclePlay, variant: "primary" });
  if (status === "active" || status === "expired") ops.push({ op: "renew", label: "Renovar", icon: RefreshCw, variant: "secondary" });
  if (status === "active") ops.push({ op: "suspend", label: "Suspender", icon: Ban, variant: "secondary" });
  if (status === "suspended") ops.push({ op: "reactivate", label: "Levantar suspensão", icon: Undo2, variant: "secondary" });

  const text = {
    activate: "Activar esta assinatura? O acesso começa agora (ou no fim da assinatura actual) pela duração do plano.",
    renew: "Renovar por mais um período do plano? Os dias são somados ao fim da validade actual.",
    suspend: "Suspender? O estudante perde o acesso de imediato até a suspensão ser levantada.",
    reactivate: "Levantar a suspensão? O acesso volta se a assinatura ainda estiver dentro da validade.",
  };

  if (ops.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      {!confirm ? (
        <div className="flex flex-wrap gap-2">
          {ops.map(({ op, label, icon: Icon, variant }) => (
            <Button key={op} size="sm" variant={variant} onClick={() => setConfirm(op)} className={cn(op === "suspend" && "text-danger")}>
              <Icon className="size-4" aria-hidden /> {label}
            </Button>
          ))}
        </div>
      ) : (
        <form action={action} onSubmit={() => setTimeout(() => setConfirm(null), 0)} className="flex flex-col gap-2 rounded-xl bg-muted p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value={confirm} />
          <p className="text-sm">{text[confirm]}</p>
          {confirm === "suspend" && (
            <input name="reason" maxLength={300} placeholder="Motivo (opcional)" aria-label="Motivo da suspensão" className={cn(controlCls, "h-10 text-sm")} />
          )}
          <div className="flex gap-2">
            <SubmitButton size="sm" variant={confirm === "suspend" ? "danger" : "primary"} pendingText="A guardar…">
              Confirmar
            </SubmitButton>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// =============================================================================
// Atribuir plano (na ficha do estudante)
// =============================================================================
export function AssignPlanForm({ userId, plans }: { userId: string; plans: { id: string; name: string; price_mzn: number; is_active: boolean }[] }) {
  const [state, action] = useActionState(assignSubscription, initialFormState);
  const uid = useId();
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <label htmlFor={`${uid}-plan`} className="text-sm font-medium">
        Atribuir plano (sem registar pagamento)
      </label>
      <div className="flex gap-2">
        <select id={`${uid}-plan`} name="plan_id" className={cn(controlCls, "h-11 flex-1")}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatMZN(Number(p.price_mzn))}
              {p.is_active ? "" : " (inactivo)"}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" className="h-11" pendingText="…">
          Atribuir
        </SubmitButton>
      </div>
    </form>
  );
}

// =============================================================================
// Registar pagamento
// =============================================================================
export function PaymentForm({
  plans,
  defaultEmail = "",
}: {
  plans: { id: string; name: string; price_mzn: number; is_active: boolean }[];
  defaultEmail?: string;
}) {
  const [state, action] = useActionState(recordPayment, initialFormState);
  const uid = useId();
  const e = state.fieldErrors ?? {};
  const v = (k: string, d = "") => (state.success ? d : (state.values?.[k] ?? d));
  const [planId, setPlanId] = useState(plans.find((p) => p.is_active)?.id ?? plans[0]?.id ?? "");
  const price = plans.find((p) => p.id === planId)?.price_mzn;

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-3" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <FormField label="E-mail do estudante" name="email" type="email" defaultValue={v("email", defaultEmail)} errors={e.email} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-plan`} className="text-sm font-medium">
            Plano
          </label>
          <select id={`${uid}-plan`} name="plan_id" value={planId} onChange={(ev) => setPlanId(ev.target.value)} className={cn(controlCls, "h-12")}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_active ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
          <Err e={e.plan_id} />
        </div>
        <FormField
          key={planId}
          label="Valor (MZN)"
          name="amount_mzn"
          inputMode="decimal"
          defaultValue={v("amount_mzn", price != null ? String(price) : "")}
          errors={e.amount_mzn}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-method`} className="text-sm font-medium">
            Método
          </label>
          <select id={`${uid}-method`} name="method" defaultValue={v("method", "mpesa")} className={cn(controlCls, "h-12")}>
            {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <FormField label="Referência" name="reference" defaultValue={v("reference")} errors={e.reference} />
        <FormField label="Data do pagamento" name="paid_at" type="date" defaultValue={v("paid_at")} errors={e.paid_at} />
      </div>
      <FormField label="Observações (opcional)" name="notes" defaultValue={v("notes")} />
      <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" name="apply" defaultChecked={state.values ? state.values.apply === "on" : true} className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          <span className="font-medium">Activar / renovar a assinatura</span>
          <span className="block text-muted-foreground">
            Activa o pedido pendente deste plano, renova a assinatura existente ou cria uma nova.
          </span>
        </span>
      </label>
      <SubmitButton className="self-start" pendingText="A registar…">
        Registar pagamento
      </SubmitButton>
    </form>
  );
}

// =============================================================================
// Planos
// =============================================================================
export type PlanValues = {
  id?: string;
  name: string;
  description: string;
  price_mzn: string;
  duration_days: string;
  features: string;
  course_id: string;
  is_active: boolean;
};

export function PlanForm({ plan, courses, onDone }: { plan: PlanValues; courses: { id: string; title: string }[]; onDone?: () => void }) {
  const [state, action] = useActionState(savePlan, initialFormState);
  const uid = useId();
  const e = state.fieldErrors ?? {};
  const isNew = !plan.id;
  const v = (k: keyof PlanValues) => (isNew && state.success ? "" : (state.values?.[k] ?? String(plan[k] ?? "")));

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-3" noValidate>
      {plan.id && <input type="hidden" name="id" value={plan.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <FormField label="Nome do plano" name="name" defaultValue={v("name")} errors={e.name} maxLength={100} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Preço (MZN)" name="price_mzn" inputMode="decimal" defaultValue={v("price_mzn")} errors={e.price_mzn} />
        <FormField label="Duração (dias)" name="duration_days" type="number" min={1} max={366} defaultValue={v("duration_days") || "30"} errors={e.duration_days} />
      </div>
      <FormField label="Descrição curta (opcional)" name="description" defaultValue={v("description")} errors={e.description} maxLength={500} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-features`} className="text-sm font-medium">
          Benefícios (um por linha)
        </label>
        <textarea id={`${uid}-features`} name="features" rows={3} defaultValue={v("features")} className={cn(controlCls, "py-3")} />
        <Err e={e.features} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-course`} className="text-sm font-medium">
          Acesso
        </label>
        <select id={`${uid}-course`} name="course_id" defaultValue={v("course_id")} className={cn(controlCls, "h-12")}>
          <option value="">Todos os cursos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              Só o curso: {c.title}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={state.values ? state.values.is_active === "on" : plan.is_active}
          className="size-5 accent-primary"
        />
        Plano activo (visível para os estudantes)
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="A guardar…">
          {isNew ? (
            <>
              <Plus className="size-4" aria-hidden /> Criar plano
            </>
          ) : (
            "Guardar plano"
          )}
        </SubmitButton>
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Fechar
          </Button>
        )}
      </div>
    </form>
  );
}

export function PlanItem({
  plan,
  courses,
  subscriptionCount,
  courseTitle,
}: {
  plan: PlanValues & { id: string };
  courses: { id: string; title: string }[];
  subscriptionCount: number;
  courseTitle: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [delState, delAction] = useActionState(deletePlan, initialFormState);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <li className="rounded-xl border border-border p-4">
      {editing ? (
        <PlanForm plan={plan} courses={courses} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {plan.name}{" "}
                {!plan.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactivo</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatMZN(Number(plan.price_mzn))} · {plan.duration_days} dias · {courseTitle ?? "todos os cursos"} · {subscriptionCount}{" "}
                {subscriptionCount === 1 ? "assinatura" : "assinaturas"}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Editar ${plan.name}`}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Eliminar ${plan.name}`} className="text-danger">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
          {delState.error && <Alert variant="error">{delState.error}</Alert>}
          {confirmDelete && (
            <form action={delAction} onSubmit={() => setTimeout(() => setConfirmDelete(false), 0)} className="flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 p-3 text-sm">
              <input type="hidden" name="id" value={plan.id} />
              <span className="flex-1">Eliminar o plano «{plan.name}»?</span>
              <SubmitButton size="sm" variant="danger" pendingText="…">
                Eliminar
              </SubmitButton>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

// =============================================================================
// Instruções de pagamento
// =============================================================================
export function SettingsForm({ initial }: { initial: { payment_instructions: string; support_contact: string } }) {
  const [state, action] = useActionState(saveSettings, initialFormState);
  const uid = useId();
  const v = (k: keyof typeof initial) => state.values?.[k] ?? initial[k];
  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-pi`} className="text-sm font-medium">
          Instruções de pagamento (mostradas aos estudantes; aceita Markdown)
        </label>
        <textarea
          id={`${uid}-pi`}
          name="payment_instructions"
          rows={7}
          maxLength={5000}
          defaultValue={v("payment_instructions")}
          placeholder={"Ex.:\n**M-Pesa:** envie para o número …\n**Transferência:** NIB …, titular …\nIndique o seu e-mail na referência."}
          className={cn(controlCls, "py-3 font-mono text-sm")}
        />
        <Err e={state.fieldErrors?.payment_instructions} />
      </div>
      <FormField label="Contacto de suporte (WhatsApp, e-mail…)" name="support_contact" defaultValue={v("support_contact")} maxLength={300} />
      <SubmitButton size="sm" className="self-start" pendingText="A guardar…">
        Guardar instruções
      </SubmitButton>
    </form>
  );
}
