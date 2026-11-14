// Gera um ficheiro SQL que importa conteúdos escritos em Markdown para a plataforma
// (módulos → capítulos → aulas), dentro de uma disciplina JÁ criada no painel.
//
//   node scripts/build-content-sql.mjs semiologia [01-anamnese ...]
//
// Estrutura esperada (o teste do capítulo é opcional):
//   conteudos/<disciplina>/_meta.json                    { course, subject }
//   conteudos/<disciplina>/<NN-modulo>/_meta.json        { title, description }
//   conteudos/<disciplina>/<NN-modulo>/<NN-capitulo>/_meta.json
//   conteudos/<disciplina>/<NN-modulo>/<NN-capitulo>/<NN-aula>.md  (frontmatter: title, summary, duration)
//   conteudos/<disciplina>/<NN-modulo>/<NN-capitulo>/teste.json      { title, questions: [{statement, options[4], correct, explanation}] }
//
// O SQL resultante:
//   - procura o curso e a disciplina pelo título (sem distinguir maiúsculas) e pára se não os encontrar;
//   - cria só o que ainda não existe (pelo "slug"): NUNCA altera nem apaga conteúdos existentes;
//   - cria tudo como RASCUNHO (draft): o administrador revê e publica no painel.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [discipline, ...onlyModules] = process.argv.slice(2);
if (!discipline) {
  console.error("Uso: node scripts/build-content-sql.mjs <disciplina> [módulos…]");
  process.exit(2);
}
const base = path.join(root, "conteudos", discipline);
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const dirs = (p) => readdirSync(p).filter((d) => /^\d+-/.test(d) && statSync(path.join(p, d)).isDirectory()).sort();
const slugOf = (name) => name.replace(/^\d+-/, "").replace(/\.md$/, "");
const posOf = (name) => Number(name.match(/^(\d+)/)[1]);

function lit(s) {
  if (s == null) return "null";
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function dollar(s) {
  let tag = "md";
  while (s.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${s}$${tag}$`;
}
function parseLesson(file) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Sem frontmatter: ${file}`);
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  if (!meta.title) throw new Error(`Sem título: ${file}`);
  return { ...meta, body: m[2].trim() + "\n" };
}

const top = json(path.join(base, "_meta.json"));
const modules = dirs(base).filter((d) => onlyModules.length === 0 || onlyModules.includes(d));
let counts = { modules: 0, chapters: 0, lessons: 0, quizzes: 0, questions: 0 };

const out = [];
out.push(`-- =============================================================================
-- MEDSTUDY MOZ — Importação de conteúdos: ${top.subject} (${modules.join(", ")})
--
-- Supabase → SQL Editor → New query → colar TODO este ficheiro → Run.
-- Cria módulos, capítulos e aulas dentro da disciplina "${top.subject}" do curso
-- "${top.course}" (já criados no painel). Tudo entra como RASCUNHO.
-- Seguro para repetir: o que já existe (mesmo endereço/slug) é ignorado, nada é apagado.
--
-- Gerado por scripts/build-content-sql.mjs — editar os ficheiros em conteudos/, não este.
-- =============================================================================
do $import$
declare
  v_course uuid;
  v_subject uuid;
  v_module uuid;
  v_chapter uuid;
  v_quiz uuid;
  v_n int;
  v_new int := 0;
  v_new_quizzes int := 0;
begin
  select count(*), min(c.id::text)::uuid into v_n, v_course
    from public.courses c where lower(trim(c.title)) = lower(${lit(top.course)});
  if v_n <> 1 then
    raise exception 'Curso "%" não encontrado (ou repetido): % resultado(s). Confirme o nome no painel.', ${lit(top.course)}, v_n;
  end if;
  select count(*), min(s.id::text)::uuid into v_n, v_subject
    from public.subjects s where s.course_id = v_course and lower(trim(s.title)) = lower(${lit(top.subject)});
  if v_n <> 1 then
    raise exception 'Disciplina "%" não encontrada no curso (ou repetida): % resultado(s).', ${lit(top.subject)}, v_n;
  end if;
`);

for (const mod of modules) {
  const mdir = path.join(base, mod);
  const mm = json(path.join(mdir, "_meta.json"));
  counts.modules++;
  out.push(`
  -- ── Módulo: ${mm.title}
  insert into public.modules (subject_id, title, slug, description, position)
    values (v_subject, ${lit(mm.title)}, ${lit(slugOf(mod))}, ${lit(mm.description)}, ${posOf(mod)})
    on conflict (subject_id, slug) do nothing;
  select id into v_module from public.modules where subject_id = v_subject and slug = ${lit(slugOf(mod))};
`);
  for (const ch of dirs(mdir)) {
    const cdir = path.join(mdir, ch);
    const cm = json(path.join(cdir, "_meta.json"));
    counts.chapters++;
    out.push(`
  -- Capítulo: ${cm.title}
  insert into public.chapters (module_id, title, slug, description, position)
    values (v_module, ${lit(cm.title)}, ${lit(slugOf(ch))}, ${lit(cm.description)}, ${posOf(ch)})
    on conflict (module_id, slug) do nothing;
  select id into v_chapter from public.chapters where module_id = v_module and slug = ${lit(slugOf(ch))};
`);
    const lessons = readdirSync(cdir).filter((f) => /^\d+-.*\.md$/.test(f)).sort();
    for (const f of lessons) {
      const l = parseLesson(path.join(cdir, f));
      counts.lessons++;
      out.push(`
  insert into public.lessons (chapter_id, course_id, title, slug, summary, content, duration_minutes, position)
    values (v_chapter, v_course, ${lit(l.title)}, ${lit(slugOf(f))}, ${lit(l.summary)},
${dollar(l.body)},
      ${l.duration ? Number(l.duration) : "null"}, ${posOf(f)})
    on conflict (chapter_id, slug) do nothing;
  get diagnostics v_n = row_count; v_new := v_new + v_n;
`);
    }

    // Teste do capítulo (opcional): <capítulo>/teste.json
    const quizFile = path.join(cdir, "teste.json");
    if (existsSync(quizFile)) {
      const q = json(quizFile);
      const status = q.status === "published" ? "published" : "draft";
      q.questions.forEach((x, i) => {
        if (x.options?.length !== 4 || typeof x.correct !== "string" || !/^[ABCD]$/.test(x.correct))
          throw new Error(`${quizFile}: pergunta ${i + 1} precisa de 4 opções e resposta A–D`);
      });
      counts.quizzes++;
      counts.questions += q.questions.length;
      out.push(`
  -- Teste: ${q.title}
  if not exists (select 1 from public.quizzes where chapter_id = v_chapter and title = ${lit(q.title)}) then
    insert into public.quizzes (course_id, subject_id, module_id, chapter_id, title, description,
                                passing_score, shuffle_questions, status, position)
      values (v_course, v_subject, v_module, v_chapter, ${lit(q.title)}, ${lit(q.description)},
              ${Number(q.passing_score ?? 50)}, ${q.shuffle_questions ? "true" : "false"}, '${status}', ${posOf(ch)})
      returning id into v_quiz;
    insert into public.questions (quiz_id, statement, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
${q.questions
  .map(
    (x, i) =>
      `      (v_quiz, ${lit(x.statement)}, ${x.options.map(lit).join(", ")}, '${x.correct}', ${lit(x.explanation)}, ${i + 1})`,
  )
  .join(",\n")};
    v_new_quizzes := v_new_quizzes + 1;
  end if;
`);
    }
  }
}

out.push(`
  raise notice 'Aulas novas: % (de ${counts.lessons}) · Testes novos: % (de ${counts.quizzes})', v_new, v_new_quizzes;
end
$import$;

-- Verificação: módulos, capítulos e aulas desta disciplina
select m.position as mod, m.title as modulo, c.position as cap, c.title as capitulo, count(distinct l.id) as aulas,
       (select count(*) from public.quizzes q where q.chapter_id = c.id) as testes
  from public.modules m
  join public.subjects s on s.id = m.subject_id
  join public.courses co on co.id = s.course_id
  left join public.chapters c on c.module_id = m.id
  left join public.lessons l on l.chapter_id = c.id
 where lower(trim(co.title)) = lower(${lit(top.course)}) and lower(trim(s.title)) = lower(${lit(top.subject)})
 group by 1, 2, 3, 4, c.id order by 1, 3;
`);

const outDir = path.join(root, "supabase", "conteudos");
mkdirSync(outDir, { recursive: true });
const name = `${discipline}${onlyModules.length ? "-" + onlyModules.join("-") : ""}.sql`;
writeFileSync(path.join(outDir, name), out.join(""));
console.log(
  `Gerado supabase/conteudos/${name}: ${counts.modules} módulo(s), ${counts.chapters} capítulo(s), ${counts.lessons} aula(s), ${counts.quizzes} teste(s) com ${counts.questions} pergunta(s)`,
);
