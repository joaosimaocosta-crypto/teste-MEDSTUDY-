-- =============================================================================
-- MEDSTUDY MOZ — Importação de conteúdos: Semiologia (01-anamnese)
--
-- Supabase → SQL Editor → New query → colar TODO este ficheiro → Run.
-- Cria módulos, capítulos e aulas dentro da disciplina "Semiologia" do curso
-- "Técnico de medicina geral" (já criados no painel). Tudo entra como RASCUNHO.
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
  v_n int;
  v_new int := 0;
begin
  select count(*), min(c.id::text)::uuid into v_n, v_course
    from public.courses c where lower(trim(c.title)) = lower('Técnico de medicina geral');
  if v_n <> 1 then
    raise exception 'Curso "%" não encontrado (ou repetido): % resultado(s). Confirme o nome no painel.', 'Técnico de medicina geral', v_n;
  end if;
  select count(*), min(s.id::text)::uuid into v_n, v_subject
    from public.subjects s where s.course_id = v_course and lower(trim(s.title)) = lower('Semiologia');
  if v_n <> 1 then
    raise exception 'Disciplina "%" não encontrada no curso (ou repetida): % resultado(s).', 'Semiologia', v_n;
  end if;

  -- ── Módulo: Anamnese
  insert into public.modules (subject_id, title, slug, description, position)
    values (v_subject, 'Anamnese', 'anamnese', 'Como conduzir a entrevista clínica: estrutura, comunicação, fases da anamnese, revisão de sistemas e registo.', 1)
    on conflict (subject_id, slug) do nothing;
  select id into v_module from public.modules where subject_id = v_subject and slug = 'anamnese';

  -- Capítulo: Fundamentos
  insert into public.chapters (module_id, title, slug, description, position)
    values (v_module, 'Fundamentos', 'fundamentos', 'Conceitos de semiologia, estrutura da história clínica e comunicação com o paciente.', 1)
    on conflict (module_id, slug) do nothing;
  select id into v_chapter from public.chapters where module_id = v_module and slug = 'fundamentos';

  insert into public.lessons (chapter_id, course_id, title, slug, summary, content, duration_minutes, position)
    values (v_chapter, v_course, 'Introdução à semiologia', 'introducao-a-semiologia', 'O que é a semiologia, a diferença entre sinais e sintomas, e como a história clínica leva à hipótese diagnóstica.',
$md$## 🎯 Objectivos

No fim desta aula deve ser capaz de:

1. Definir **semiologia**, **propedêutica**, **semiotécnica** e **história clínica**.
2. Diferenciar **sinais** de **sintomas**.
3. Definir **sintoma cardinal** e **sintoma constitucional**, com exemplos.
4. Explicar o que é o **quadro clínico**.
5. Explicar a relação entre a anamnese e a **hipótese diagnóstica**.

---

## 📖 O que é a semiologia

A **semiologia** é a disciplina médica que estuda **como investigar, encontrar e interpretar os sinais e sintomas** através dos quais as doenças se manifestam no paciente.

É uma disciplina **propedêutica**: é a base de todas as disciplinas clínicas. Sem semiologia não há diagnóstico correcto.

> **💡 Dica clínica:** quando não há laboratório nem raio-X disponíveis, o clínico depende **só** dos sinais e sintomas para chegar a uma hipótese diagnóstica. É por isso que a semiologia é tão importante em Moçambique.

### Termos essenciais

| Termo | Significado |
| --- | --- |
| **Semiologia** | Estudo dos sinais e sintomas e da sua interpretação |
| **Semiotécnica** | Conjunto de **passos e regras** para examinar o paciente |
| **História clínica** | Conjunto da **anamnese** + **exame físico** |
| **Anamnese** | O relato do paciente, obtido através de perguntas do clínico |
| **Exame físico** (exame objectivo) | A pesquisa directa dos sinais no corpo do paciente |

> **⚠️ Atenção:** em Moçambique, "história clínica" pode significar só a anamnese. Neste curso usamos o termo para o **conjunto** anamnese + exame físico.

---

## 🗣️ A anamnese

É o **resumo sistemático** do que o paciente (e/ou acompanhantes) conta sobre:

- a doença actual;
- o passado médico;
- os antecedentes familiares;
- outros factores que influenciam o diagnóstico.

É feita através de uma **conversa**, com perguntas **gerais** e **direccionadas**, e o resultado é escrito no processo clínico.

### Para que serve

1. Obter o máximo de informação sobre a queixa, para chegar ao **diagnóstico**.
2. Criar uma **relação de confiança** entre o clínico e o paciente.
3. Perceber **como o paciente está a lidar** com a sua doença.
4. Apoiar o **manejo**: tratamento, controlo de doenças crónicas, educação para a saúde e prevenção.

A anamnese muda conforme o **tipo de paciente** (adulto, criança, grávida, idoso…) e a **queixa principal**.

---

## 🩺 O exame físico

É a pesquisa **imediata e directa** dos sinais de doença. O clínico usa os sentidos:

| Sentido | Exemplo |
| --- | --- |
| 👀 Vista | palidez, icterícia, edema |
| 👂 Ouvido | sopros, fervores, sibilos |
| ✋ Tacto | massas, temperatura da pele, pulso |
| 👃 Olfacto | hálito cetónico, odor de feridas infectadas |

- A anamnese e o exame físico **complementam-se**: um **não substitui** o outro.
- Normalmente o exame físico **segue** a anamnese, que indica onde concentrar a atenção, **sem deixar de examinar todos os aparelhos**.
- **Excepção:** no paciente **inconsciente** ou que **não consegue comunicar**, o exame físico vem **primeiro**.

---

## 🔍 Sinais e sintomas

| | **Sintoma** | **Sinal** |
| --- | --- | --- |
| Natureza | **Subjectiva**: o que o doente **sente** | **Objectiva**: o que o clínico **detecta** |
| Quem identifica | Só o doente | O clínico (às vezes também o doente) |
| Exemplos | dor, mal-estar, anorexia | icterícia, pressão arterial, pulso |

Alguns achados são **sintoma e sinal ao mesmo tempo**, porque o doente sente e o clínico observa: **convulsões, sibilância, emagrecimento**.

### Tipos de sintomas

**Pela importância:**

- **Cardinais**: os sintomas principais, que orientam o diagnóstico. Ex.: tosse, hemoptises, dispneia, diarreia.
- **Constitucionais**: sintomas gerais, que afectam o **corpo inteiro**. Ex.: febre, mal-estar, anorexia, emagrecimento.

**Pela duração:**

| Tipo | Característica |
| --- | --- |
| Iniciais (de apresentação) | Os que levaram o paciente à consulta |
| Agudos | Aparecem de repente |
| Crónicos | Presentes há **mais de 2 semanas** |
| Remitentes | Aparecem e desaparecem com alguma regularidade |

### Sinais

- **Normais**: mostram o funcionamento normal de um aparelho.
- **Anormais**: mostram um mau funcionamento.
- No diagnóstico, avaliam-se **todos**, normais e anormais.

> **💡 Dica clínica:** alguns sinais apontam para um aparelho (ex.: **tosse** → respiratório). Outros podem ter várias origens (ex.: **edema** → coração, rim, fígado, desnutrição…). Não feche o raciocínio cedo demais.

### Síndrome e quadro clínico

- **Síndrome**: conjunto de sinais e sintomas que aparecem **juntos** e definem uma condição. O mesmo síndrome pode ter **causas diferentes**.
- **Quadro clínico** (manifestações clínicas): o conjunto de sinais e sintomas recolhidos na anamnese e no exame físico.

---

## 🧠 Da anamnese à hipótese diagnóstica

1. **Anamnese + exame físico** → quadro clínico.
2. A interpretação do quadro → **hipóteses diagnósticas**: as doenças que mais provavelmente explicam o quadro (pode haver várias).
3. Entre elas, a mais provável é a **hipótese diagnóstica principal**.
4. **Diagnóstico diferencial**: o processo de decidir, entre as hipóteses, qual é a mais provável.
5. **Exames auxiliares** (laboratório, radiologia) ajudam a confirmar ou excluir.

> **⚠️ Atenção:** é um processo **contínuo**. A hipótese é confirmada ou excluída à medida que se reavalia o paciente e chegam os resultados.

---

## 📝 Pontos-chave

- **Semiologia** = encontrar e interpretar sinais e sintomas para chegar ao diagnóstico.
- **Sintoma** = subjectivo (o doente refere). **Sinal** = objectivo (o clínico detecta).
- **História clínica** = anamnese + exame físico.
- **Quadro clínico** = todos os sinais e sintomas recolhidos.
- A interpretação do quadro dá a **hipótese diagnóstica**. O **diagnóstico diferencial** escolhe a mais provável.

---

*Fonte: Ministério da Saúde de Moçambique. Manual da Disciplina de Semiologia, Curso de Técnicos de Medicina Geral, 2012 (Aula 1). Reprodução permitida com citação da fonte. Conteúdo reorganizado para estudo.*
$md$,
      15, 1)
    on conflict (chapter_id, slug) do nothing;
  get diagnostics v_n = row_count; v_new := v_new + v_n;

  insert into public.lessons (chapter_id, course_id, title, slug, summary, content, duration_minutes, position)
    values (v_chapter, v_course, 'Estrutura da história clínica', 'estrutura-da-historia-clinica', 'As condições para uma boa anamnese e os 8 componentes da anamnese abrangente, do primeiro cumprimento à revisão de sistemas.',
$md$## 🎯 Objectivos

No fim desta aula deve ser capaz de:

1. Indicar as **condições básicas** para recolher uma boa anamnese.
2. Identificar os **factores do paciente** que influenciam a entrevista.
3. Enumerar, **pela ordem certa**, os **8 componentes** da anamnese abrangente.

---

## 🤝 Antes de começar: as condições para uma boa anamnese

A qualidade da informação depende da **relação de confiança**. Um paciente que se sente **acolhido e em mãos seguras** conta tudo, com detalhe e sem medo.

> **💡 Dica clínica:** a **primeira impressão** que o paciente tem de si influencia se ele vai **confiar** nos seus conselhos, **tomar os comprimidos** e **voltar** à consulta de seguimento.

### ✅ Checklist do ambiente da consulta

- [ ] **Espaço** confortável para o paciente
- [ ] **Privacidade**: sala com a porta fechada
- [ ] **Apresentação** do clínico: bata limpa e arrumada
- [ ] **Tempo** suficiente para a entrevista
- [ ] **Acesso à informação**: o paciente consegue falar, ou está acompanhado
- [ ] **Perguntas simples**, adaptadas à situação (emergência ou não) e à idade
- [ ] **Linguagem corporal** que mostra interesse, abertura e empatia
- [ ] **Confidencialidade** garantida

### Factores do paciente a ter em conta

Cada paciente é diferente. Isto muda **a forma** e **o tipo** de perguntas:

| Factor | Exemplo do impacto |
| --- | --- |
| Cultura, etnia, raça | Formas diferentes de descrever a doença |
| Religião | Crenças sobre a causa e o tratamento |
| Idade | Criança, adolescente ou idoso pedem abordagens diferentes |
| Orientação sexual | Perguntas sobre a vida sexual feitas sem julgamento |
| Acompanhante | Marido, sogra ou pais presentes podem inibir certas respostas |
| Doença suspeita | Temas sensíveis (ex.: ITS) exigem mais privacidade |

---

## 🧩 Os 8 componentes da anamnese abrangente

Memorize a sequência. É a **estrutura padrão** para um adulto:

| # | Componente | O que se recolhe |
| --- | --- | --- |
| 1 | **Apresentação** | Cumprimentar, dizer quem é e qual é o seu papel |
| 2 | **Identificação** | Dados básicos do paciente |
| 3 | **Queixa principal** | O motivo da consulta, **nas palavras do paciente** |
| 4 | **História da doença actual** | Os detalhes de cada sintoma actual |
| 5 | **História médica pregressa** | A saúde desde o nascimento até agora |
| 6 | **História familiar** | Doenças nos familiares |
| 7 | **História pessoal e social** | Condições de vida e hábitos |
| 8 | **Revisão de sistemas** | Sintomas de **todos** os aparelhos, um a um |

### 1. Apresentação

- Apresente-se **antes** de qualquer pergunta e explique o seu papel.
- Se houver acompanhante, cumprimente-o e esclareça logo **a relação** com o paciente. Pergunte também **ao paciente** quem é a pessoa.

### 2. Identificação

Recolhe-se na **primeira consulta**, antes de entrar no problema. Confirma-se e actualiza-se em **cada** consulta.

**Dados essenciais:** nome · idade · sexo · cor (raça) · estado civil · profissão (actual e anteriores) · local de trabalho · naturalidade · residência.

**Dados adicionais:**

- data e **hora** da consulta (importante em emergências e internamentos);
- contacto do paciente e de uma **pessoa de referência**;
- **fonte da anamnese**, se não for o paciente. Ex.: *"anamnese recolhida através do marido"*;
- **fonte de encaminhamento**. Ex.: *"paciente referido da enfermaria de pneumologia"*.

> **⚠️ Atenção:** em **emergência**, ou com um paciente que não consegue falar e está sozinho, a identificação pode ficar para depois.

### 3. Queixa principal

- Pergunte **porque veio** e **deixe o paciente falar**. Só depois faça perguntas específicas.
- Pode haver **mais de uma** queixa, relacionadas ou não.
- Registe **entre aspas**, com as palavras do paciente. Ex.: *"tenho tosse há 3 semanas"*.

### 4. História da doença actual (HDA)

Para **cada sintoma**, investigue (quando se aplica):

1. **Cronologia**: início, duração e periodicidade
2. **Localização** no corpo
3. **Qualidade**: as características
4. **Quantidade** ou gravidade
5. **Factores** que pioram ou melhoram, e a evolução
6. **Sintomas associados**
7. **Situação actual** do sintoma
8. **Contacto com doentes** (se a doença pode ser transmissível)
9. **Tratamentos** já feitos
10. Perguntas sobre o **aparelho** relacionado com o sintoma principal

### 5. História médica pregressa

Tudo sobre a saúde física e mental **desde o nascimento até ao início da queixa actual**:

alergias · vacinas · doenças da infância · doenças do adulto · internamentos e cirurgias · acidentes e traumas · história obstétrica.

### 6. História familiar

| Grupo | Exemplos |
| --- | --- |
| Hereditárias / tendência familiar | alergias, diabetes, hipertensão, gota, obesidade, albinismo |
| Infecciosas transmissíveis | tuberculose, HIV e outras ITS, gripe |
| Congénitas | malformações, HIV de transmissão vertical |
| Outros | internamentos, diagnósticos, **causas de morte** |

### 7. História pessoal e social

Tudo o que o paciente faz afecta a sua saúde, para o bem ou para o mal.

- **Condições socioeconómicas e culturais:** ocupação, escolaridade, habitação, rendimentos, crenças, vida familiar e conjugal, fontes de stress.
- **Estilo de vida e hábitos:** alimentação, actividade física, **álcool, tabaco, outras drogas**, sono, viagens recentes, **medicina tradicional/alternativa**.

### 8. Revisão de sistemas

Pesquisa de sintomas em **cada aparelho**, mesmo os que não estão relacionados com a queixa. Serve para:

- completar a história do problema actual;
- descobrir **outras doenças** que o paciente não referiu.

**Sequência a seguir:**

1. Sintomas gerais
2. Cabeça e pescoço
3. Pele e anexos
4. Mamas
5. Respiratório
6. Cardiovascular
7. Digestivo
8. Génito-urinário
9. Hemolinfopoiético
10. Endócrino
11. Músculo-esquelético
12. Nervoso
13. Psíquico

> **💡 Dica clínica:** os sintomas do aparelho **da queixa principal** exploram-se logo na **HDA**. Na revisão de sistemas pesquisam-se os **restantes** aparelhos.

---

## 📝 Pontos-chave

- A anamnese é o **primeiro passo** do diagnóstico e orienta o exame físico e os exames complementares.
- A **relação de confiança** é o primeiro objectivo do encontro e influencia a **adesão** ao tratamento.
- Garanta **privacidade, tempo, confidencialidade** e uma boa **apresentação**.
- Estrutura: **Apresentação → Identificação → Queixa principal → HDA → História pregressa → História familiar → História pessoal/social → Revisão de sistemas.**

---

*Fonte: Ministério da Saúde de Moçambique. Manual da Disciplina de Semiologia, Curso de Técnicos de Medicina Geral, 2012 (Aula 2). Reprodução permitida com citação da fonte. Conteúdo reorganizado para estudo.*
$md$,
      15, 2)
    on conflict (chapter_id, slug) do nothing;
  get diagnostics v_n = row_count; v_new := v_new + v_n;

  insert into public.lessons (chapter_id, course_id, title, slug, summary, content, duration_minutes, position)
    values (v_chapter, v_course, 'Comunicação com o paciente', 'comunicacao-com-o-paciente', 'Técnicas verbais e não verbais para conduzir a entrevista, como apoiar o paciente, e como fazer a anamnese através de acompanhantes e em situações difíceis.',
$md$## 🎯 Objectivos

No fim desta aula deve ser capaz de:

1. Aplicar as **4 categorias** de técnicas de comunicação.
2. Distinguir **perguntas abertas** de **perguntas directas** e saber quando usar cada uma.
3. Recolher a anamnese através de um **acompanhante**.
4. Saber o **mínimo indispensável** a perguntar numa emergência.
5. Conhecer os **princípios éticos** da relação clínico-paciente.

---

## 🗣️ As 4 categorias de técnicas de comunicação

1. **Criar um bom relacionamento**
2. Técnicas **não verbais**
3. Técnicas **verbais**: saber conduzir a entrevista
4. **Apoiar** o paciente

As técnicas de comunicação **aprendem-se com a prática**: paciência, vontade de aprender e flexibilidade.

### 1. Criar um bom relacionamento

- [ ] Garantir a **privacidade**
- [ ] Estar **bem vestido** (bata limpa)
- [ ] **Cumprimentar** o paciente e o acompanhante
- [ ] **Apresentar-se** e explicar porque vai fazer perguntas
- [ ] Dizer **quanto tempo** tem para a consulta e evitar longas esperas
- [ ] Tratar o paciente **pelo nome**
- [ ] Usar **palavras simples** e evitar termos médicos
- [ ] Mostrar **respeito** pelo paciente e pela família
- [ ] Garantir **confidencialidade**
- [ ] Garantir o **conforto** do paciente
- [ ] Ter consciência das diferenças de **sexo e idade** entre si e o paciente

### 2. Técnicas não verbais

As pessoas comunicam **com e sem palavras**.

| Técnica | Como se faz |
| --- | --- |
| **Escuta activa** | Ouvir **o que** o paciente diz e **como** o diz |
| **Encorajar com o corpo** | Sentar-se **ao nível dos olhos**, olhar para o paciente, **acenar com a cabeça** |
| **Observar o paciente** | Como reage às perguntas? E quando o acompanhante fala? |
| **Controlar o seu comportamento** | Clínico **calmo** → paciente calmo. Clínico **ansioso** → paciente ansioso |

### 3. Técnicas verbais: conduzir a entrevista

**Encorajar a narrativa**

- Deixe o paciente explicar **com as suas palavras**, sem o interromper.
- Use frases curtas de incentivo: *"Compreendo"*, *"Sim, continue"*.
- **Repita** as frases-chave por outras palavras para obter mais detalhes.

**Começar aberto, depois direccionar**

| Tipo | Quando | Exemplos |
| --- | --- | --- |
| **Perguntas abertas** | No **início** | *"Fale-me da sua preocupação. O que está a sentir?"* · *"Pode descrever a dor no peito?"* |
| **Perguntas directas** | **Depois** de o paciente contar a história | *"A dor é constante ou vem e vai?"* · *"Mostre-me onde dói."* |

**Outras técnicas**

- **Eco / silêncio:** deixe momentos de silêncio para o paciente organizar as ideias.
- **Empatia:** mostre que percebe o que ele sente. *"Compreendo como se está a sentir."*
- **Resumir:** no fim, resuma o que ouviu para confirmar que percebeu bem.

### 4. Apoiar o paciente

A anamnese tem **valor terapêutico**: o paciente fala dos seus medos e esperanças. Apoie-o com **palavras** e com **atitude**:

- *"Deve ter sido difícil suportar tudo isso."*
- *"Deve ter ficado preocupado quando a dor no peito começou."*

---

## 👥 Anamnese através de outra pessoa

O **paciente é a melhor fonte**. Mas às vezes é preciso a ajuda de um familiar ou cuidador:

- **crianças** (menores);
- **idosos** que não conseguem comunicar bem;
- doença **psíquica**, uso de **substâncias**, doença descompensada;
- **trauma** ou doença que impede a comunicação.

**Regras:**

1. Registe **a fonte** no processo. Ex.: *"anamnese colhida através da tia"*.
2. Se o paciente **puder** participar, é **obrigatório** falar com ele, **mesmo que seja menor**.
3. Os passos são os mesmos, mas a informação pode ficar **incompleta**, conforme o que o acompanhante sabe.
4. Acompanhantes diferentes podem dar **versões diferentes**: recolha o essencial e actualize a anamnese quando necessário.

---

## 🚨 Situações em que não dá para fazer a anamnese completa

| Situação | Exemplos |
| --- | --- |
| **Emergência** médica ou cirúrgica, trauma | É preciso agir **já** |
| Paciente **sozinho** que não consegue comunicar | Idoso confuso, doença psíquica, intoxicação, traumatismo craniano recente (perda de memória) |
| Acompanhante que **não conhece** o paciente | Vizinho, desconhecido que o trouxe |

### ✅ O mínimo indispensável

- [ ] **Nome**, **idade** e **sexo** (a conduta muda com a idade e o sexo)
- [ ] **Queixa principal**: o motivo da urgência
- [ ] **História pregressa** relacionada com o evento actual
- [ ] **Doenças crónicas**
- [ ] **Tratamentos** em curso
- [ ] **Alergias a medicamentos**
- [ ] Depois de estabilizar: **nome e contacto de um familiar**, se o paciente veio sozinho

> **⚠️ Atenção:** assim que for possível, complete a história com a família ou com quem conhece o paciente.

> **💡 Dica clínica:** tenha sempre consigo um **guião de anamnese**. Consulte-o para não se esquecer de nenhuma pergunta, mas **não o leia em voz alta** à frente do paciente.

---

## ⚖️ Ética na relação clínico-paciente

A relação ideal é a **aliança terapêutica**: o clínico orienta e o paciente **participa activamente** nas decisões.

**Qualidades do clínico:** profissionalismo · integridade · respeito · compaixão.

**Princípios bioéticos:**

| Princípio | Significado |
| --- | --- |
| **Autonomia** | Respeitar o direito do paciente a decidir |
| **Beneficência** | Procurar o máximo benefício |
| **Não-maleficência** | Não fazer mal |
| **Sigilo** | Manter a confidencialidade |
| **Justiça** | Tratar todos com equidade |

---

## 📝 Pontos-chave

- Comunicar bem = **relação + técnicas não verbais + técnicas verbais + apoio**.
- Comece com **perguntas abertas** e depois passe às **directas**.
- Com acompanhante: registe **a fonte** e **ouça sempre o paciente**, se ele puder falar.
- Na emergência: **identificação, queixa, história relacionada, doenças crónicas, tratamentos e alergias**.

---

*Fonte: Ministério da Saúde de Moçambique. Manual da Disciplina de Semiologia, Curso de Técnicos de Medicina Geral, 2012 (Aula 3). Reprodução permitida com citação da fonte. Conteúdo reorganizado para estudo.*
$md$,
      20, 3)
    on conflict (chapter_id, slug) do nothing;
  get diagnostics v_n = row_count; v_new := v_new + v_n;

  raise notice 'Aulas novas importadas: % (de 3 no ficheiro)', v_new;
end
$import$;

-- Verificação: módulos, capítulos e aulas desta disciplina
select m.position as mod, m.title as modulo, c.position as cap, c.title as capitulo, count(l.id) as aulas
  from public.modules m
  join public.subjects s on s.id = m.subject_id
  join public.courses co on co.id = s.course_id
  left join public.chapters c on c.module_id = m.id
  left join public.lessons l on l.chapter_id = c.id
 where lower(trim(co.title)) = lower('Técnico de medicina geral') and lower(trim(s.title)) = lower('Semiologia')
 group by 1, 2, 3, 4 order by 1, 3;
