-- =============================================================================
-- MEDSTUDY MOZ — Dados de EXEMPLO (apenas para desenvolvimento local)
-- Executado automaticamente por `supabase db reset`. NÃO aplicar em produção.
-- Os preços e endereços abaixo são fictícios.
-- =============================================================================

-- Curso
insert into public.courses (id, title, slug, description, status, position) values
  ('10000000-0000-0000-0000-000000000001', 'Técnico de Medicina Geral', 'tecnico-medicina-geral',
   'Curso de formação de Técnicos de Medicina Geral em Moçambique.', 'published', 1);

-- Disciplinas
insert into public.subjects (id, course_id, title, slug, description, status, position) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Anatomia e Fisiologia', 'anatomia-fisiologia', 'Estrutura e funcionamento do corpo humano.', 'published', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Farmacologia', 'farmacologia', 'Princípios do uso de medicamentos.', 'draft', 2);

-- Módulo
insert into public.modules (id, subject_id, title, slug, status, position) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Sistema Cardiovascular', 'sistema-cardiovascular', 'published', 1);

-- Capítulo
insert into public.chapters (id, module_id, title, slug, status, position) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'O Coração', 'o-coracao', 'published', 1);

-- Aulas (course_id é preenchido automaticamente pelo trigger)
insert into public.lessons (id, chapter_id, title, slug, summary, content, duration_minutes, is_free_preview, status, position) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   'Introdução ao coração', 'introducao-ao-coracao', 'Visão geral do órgão.',
   E'# Introdução ao coração\n\nO **coração** é um órgão muscular que bombeia o sangue através do sistema circulatório.\n\n## Localização\n\n- No mediastino, entre os pulmões\n- Cerca de dois terços à esquerda da linha média\n\n> Conteúdo de exemplo (aula gratuita).\n\n| Câmara | Função |\n|---|---|\n| Aurícula direita | Recebe sangue venoso |\n| Ventrículo esquerdo | Bombeia sangue para a aorta |', 15, true, 'published', 1),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001',
   'Ciclo cardíaco', 'ciclo-cardiaco', 'Sístole e diástole.',
   E'# Ciclo cardíaco\n\nO ciclo cardíaco tem duas fases: **sístole** (contracção) e **diástole** (relaxamento).\n\n> Conteúdo de exemplo (exige assinatura).', 25, false, 'published', 2),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001',
   'Aula em preparação', 'aula-em-preparacao', null, 'Rascunho.', 10, false, 'draft', 3);

-- Recurso
insert into public.resources (lesson_id, title, type, url, position) values
  ('50000000-0000-0000-0000-000000000002', 'Esquema do ciclo cardíaco', 'link',
   'https://exemplo.invalid/recursos/ciclo-cardiaco', 1);

-- Manual (endereço fictício — o real será da Lunes Host)
insert into public.manuals (id, course_id, subject_id, title, description, pdf_url, status, position) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'Manual de Anatomia (exemplo)',
   'Manual oficial de exemplo.', 'https://exemplo.invalid/manuais/anatomia.pdf', 'published', 1);

-- Teste com 3 perguntas
insert into public.quizzes (id, course_id, subject_id, chapter_id, title, description, time_limit_minutes, passing_score, max_attempts, status) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   'Teste: O Coração', 'Avaliação do capítulo sobre o coração.', 10, 50, 3, 'published');

insert into public.questions (id, quiz_id, statement, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
   'Quantas câmaras tem o coração humano?', 'Duas', 'Três', 'Quatro', 'Cinco', 'C',
   'O coração tem duas aurículas e dois ventrículos.', 1),
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
   'Que válvula separa a aurícula esquerda do ventrículo esquerdo?', 'Tricúspide', 'Mitral', 'Pulmonar', 'Aórtica', 'B',
   'A válvula mitral (bicúspide) fica entre a aurícula e o ventrículo esquerdos.', 2),
  ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001',
   'A fase de contracção ventricular chama-se:', 'Diástole', 'Sístole', 'Fibrilhação', 'Repolarização', 'B',
   'Sístole é a contracção; diástole é o relaxamento.', 3);

-- Plano de assinatura (preço fictício — definir o real no painel admin)
insert into public.subscription_plans (id, name, slug, description, price_mzn, duration_days, features, is_active, position) values
  ('90000000-0000-0000-0000-000000000001', 'Plano Mensal (exemplo)', 'mensal-exemplo',
   'Acesso a todos os conteúdos durante 30 dias.', 0, 30,
   array['Todas as aulas', 'Manuais em PDF', 'Testes ilimitados'], true, 1);
