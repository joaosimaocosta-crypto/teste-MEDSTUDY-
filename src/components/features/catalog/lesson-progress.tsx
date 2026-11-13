"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useActionState, useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { markLessonViewed, toggleLessonCompleted } from "@/app/(student)/aulas/actions";

/** Regista (uma vez) que o estudante abriu a aula — alimenta "Continuar a estudar". */
export function LessonViewTracker({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void markLessonViewed(lessonId);
  }, [lessonId]);
  return null;
}

/** Botão "Marcar como concluída" / "Concluída". */
export function CompleteLessonButton({ lessonId, initialCompleted }: { lessonId: string; initialCompleted: boolean }) {
  const [state, action] = useActionState(toggleLessonCompleted, { completed: initialCompleted });

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="completed" value={String(!state.completed)} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.completed ? (
        <SubmitButton variant="secondary" fullWidth pendingText="A guardar…" aria-pressed="true">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          Aula concluída · desmarcar
        </SubmitButton>
      ) : (
        <SubmitButton fullWidth size="lg" pendingText="A guardar…" aria-pressed="false">
          <Circle className="size-5" aria-hidden />
          Marcar como concluída
        </SubmitButton>
      )}
    </form>
  );
}
