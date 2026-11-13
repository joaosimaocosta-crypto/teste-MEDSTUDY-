"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const inputClasses = cn(
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-foreground",
  "placeholder:text-muted-foreground/70 transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25",
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/20",
);

type FieldProps = ComponentProps<"input"> & {
  label: string;
  errors?: string[];
  hint?: string;
};

/**
 * Campo de formulário com etiqueta, ajuda e mensagens de erro acessíveis.
 * text-base (16px) evita o zoom automático do iPhone ao tocar no campo.
 */
export function FormField({ label, errors, hint, type = "text", className, ...props }: FieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const hasError = Boolean(errors?.length);
  const describedBy = [hint && `${id}-hint`, hasError && `${id}-error`].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? "text" : type}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy || undefined}
          className={cn(inputClasses, isPassword && "pr-12")}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
