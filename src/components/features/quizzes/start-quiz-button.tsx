"use client";

import { Play } from "lucide-react";
import { useActionState } from "react";
import { startQuiz } from "@/app/(student)/testes/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

export function StartQuizButton({ quizId, label }: { quizId: string; label: string }) {
  const [state, action] = useActionState(startQuiz, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="quizId" value={quizId} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <SubmitButton size="lg" fullWidth pendingText="A preparar o teste…">
        <Play className="size-4" aria-hidden />
        {label}
      </SubmitButton>
    </form>
  );
}
