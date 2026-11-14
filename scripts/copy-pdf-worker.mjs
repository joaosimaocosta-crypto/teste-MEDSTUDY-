// Copia o "worker" do PDF.js (versão legacy, compatível com Android antigos) para
// public/, onde o browser o carrega. Executado automaticamente após `npm install`
// e antes de `dev`/`build`. O ficheiro gerado não vai para o Git.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const src = join(pkgDir, "legacy", "build", "pdf.worker.min.mjs");
const dest = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("[pdf.js] worker copiado para public/pdf.worker.min.mjs");
