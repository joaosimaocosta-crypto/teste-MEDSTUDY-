import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Testes de ponta a ponta: scripts Node em CommonJS (require é o normal aqui)
  {
    files: ["tests/**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      // apanha nomes usados sem estarem definidos/importados
      "no-undef": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gerado por scripts/copy-pdf-worker.mjs (código de terceiros)
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
