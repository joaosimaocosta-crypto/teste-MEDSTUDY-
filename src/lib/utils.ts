import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes Tailwind condicionalmente, resolvendo conflitos (ex.: "p-2" vs "p-4"). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
