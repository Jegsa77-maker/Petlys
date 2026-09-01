# Changelog — Plataforma Pet (Pilar 1)

Este arquivo é a fonte de verdade sobre decisões, achados e ajustes do projeto — **não a memória de conversas do Claude**. Toda sessão de trabalho relevante deve adicionar uma entrada aqui, commitada junto com o código a que se refere. Ordem cronológica reversa (mais recente no topo).

---

## 2026-09-01 — Iniciativa de CX: M-001 (sistema responsivo) + M-002 (logo) — shell compartilhado nas 4 visões

**Contexto:** usuário trouxe um protótipo de CX-alvo (`.html`) e uma paleta de cores, pedindo pra evoluir a experiência de Tutor e principalmente Profissional sem reconstruir a plataforma. Antes de mexer em qualquer coisa, foi feita uma auditoria comparando o protótipo com o código real, e depois com a planilha de inventário (`Inventario_Pilar_1_CHANGELOG5.xlsx`, atualizada a partir deste próprio CHANGELOG) — que já vem com uma aba `Mapa_Melhorias` classificando cada área como Manter/Ajustar/Adicionar. Conclusão: só 4 itens de CX estavam pendentes, todos P0, todos "Ajustar" (sem construção nova) — **M-001, M-002, M-013 (hierarquia da tela de detalhe da solicitação) e M-007 (hierarquia do perfil + preço "a partir de")**. Esta entrada fecha os dois primeiros.

**Achado que motivou a prioridade:** o projeto inteiro tinha um único `layout.tsx` (o da raiz) — nenhuma das 4 visões (Tutor, Profissional, Admin, Supervisor) tinha header, navegação persistente ou logo. Cada página era um `<main>` avulso. Isso já explicava achados anteriores desta sessão (Admin/Supervisor sem link pra `/notificacoes` até serem adicionados manualmente).

**Decisão de padrão (validada pela aba `Matriz_Responsiva` do inventário, não inventada):** sidebar fixa com logo+nav em telas largas (≥768px), colapsando pra cabeçalho compacto + barra inferior de navegação em celular — mesmo padrão de Notion/Linear, e exatamente o que a matriz responsiva já definia ("barra lateral ou superior" no computador, "barra inferior e cabeçalho compacto" no celular, logo sempre no canto superior esquerdo).

- `public/logo-petlys.png` (novo): logo extraído do protótipo `.html` fornecido.
- `components/shell/nav-config.tsx` (novo): navegação por papel — só rotas que já existem hoje (`find app -iname page.tsx`); nada aponta pra tela ainda não construída (ex.: Financeiro do Profissional fica de fora até a Onda 3 existir).
- `components/shell/app-shell.tsx` (novo): um componente só, parametrizado por `role`, reaproveitado nas 4 visões — sidebar (`hidden md:flex`) e cabeçalho+barra inferior mobile (`md:hidden`) no mesmo componente, ativado por CSS puro (sem JS de detecção de dispositivo). Propositalmente não toca no `<main>` de nenhuma página existente — só embrulha `children`.
- `app/(tutor)/layout.tsx`, `app/(profissional)/layout.tsx`, `app/admin/layout.tsx`, `app/supervisor/layout.tsx` (novos): cada um só monta `<AppShell role="...">`.
- `components/shared/notifications-badge-link.tsx`: ganhou `iconOnly` (ícone com pontinho, pro cabeçalho mobile) — antes só existia a versão com texto.
- Limpeza: removidos os links de notificação e "ver moderação" que tinham sido adicionados manualmente em `admin/dashboard`, `admin/incidentes`, `admin/moderacao`, `supervisor/incidentes`, `supervisor/moderacao` e `(tutor)/inicio` — o shell agora cobre isso globalmente, mantê-los seria duplicar (e no caso do `/inicio`, uma segunda consulta ao banco pro mesmo dado).

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo nas 4 visões (Tutor, Profissional, Admin, Supervisor), em dois tamanhos de viewport (577px mobile e 1280px desktop): sidebar aparece corretamente em desktop com item ativo destacado, colapsa pra cabeçalho+barra inferior em mobile (confirmado via `getComputedStyle` que os elementos trocados ficam `display:none`, não só escondidos visualmente por acidente de viewport), notificação real (contagem não lida) funcionando nas duas variantes, conteúdo de cada página preservado sem nenhuma mudança.

---

## 2026-09-01 — Auditoria de pendências antigas + bug de RLS corrigido (Supervisor resolvendo incidente sozinho)

**Contexto:** a pedido do usuário, cruzei o `BACKLOG.md` com a lista de pendências mais antiga do projeto (fim desta entrada, 2026-08-31) pra achar divergências antes de seguir pra Onda 5.

**Achados:**
- Branch `sync-pilar1-fixes` já estava 100% mergeada em `main` — pendência obsoleta.
- "Módulo financeiro" virou a decisão de roadmap já registrada (Onda 3, fica por último).
- "Reagendamento escolhendo horário livre do Profissional" foi resolvido de um jeito **diferente** do texto original: qualquer parte reagenda pra qualquer horário, sem checar a agenda do profissional (decisão deliberada de "nunca bloquear a agenda", já documentada nas entradas de agenda flexível). Confirmado com o usuário que esse desenho é o que vale, não o texto antigo.
- `/dev-login` e Redirect URLs de produção seguem como pendências de pré-lançamento, sem tratamento ainda (dormem até existir domínio de produção).

**Bug de RLS real encontrado (já estava anotado desde 2026-08-31, nunca corrigido):** a policy `incidents_update` (`0009_rls_policies.sql`) liberava Admin **e** Supervisor pra qualquer mudança em qualquer incidente — a regra "só o Admin decide o encerramento final" (seção 10.2) só existia na Server Action (`resolveIncident`, `requireAdmin`), não no banco. Um Supervisor com acesso direto à API conseguiria chamar `update({status:'resolvido'})` sozinho, inclusive liberando o bloqueio de saque (o trigger de `0007_safety_and_reputation.sql` reage a qualquer update pra `resolvido`, não só ao vindo da Server Action) — mesma categoria dos outros dois bugs de RLS corrigidos na Onda 4 (proposals accept, apelação de incidente).

- `supabase/migrations/0034_fix_supervisor_resolve_incident_rls.sql`: policy dividida em duas — Admin sem restrição; Supervisor só pode levar o incidente pra `em_analise` ou `escalado`, nunca `resolvido`.

**Verificação:** `tsc --noEmit`/`eslint .` limpos (só migration, sem mudança de código TS). Testado com sessões RLS reais: Supervisor assume (`em_analise`) e escala (`escalado`) normalmente; tentativa de Supervisor resolver diretamente é bloqueada pela RLS com erro claro, status permanece `escalado`; Admin resolve normalmente.

---

## 2026-09-01 — Onda 4, item 6: "Contratar novamente" — Onda 4 completa

**Entrega:** sexto e último item da Onda 4 (seção 12.3) — reaproveitar categoria, pets, endereço e respostas por categoria de um atendimento concluído anterior, sem precisar preencher tudo de novo.

- `app/(tutor)/solicitacoes/[requestId]/page.tsx`: link "Contratar novamente" pro Tutor quando o status é `concluido` ou `avaliacao`, levando pra `/solicitacoes/nova?profissional=...&repetir=<requestId>`.
- `app/(tutor)/solicitacoes/nova/page.tsx`: quando `repetir` vem preenchido, busca a solicitação original no servidor — só reaproveita se ela é mesmo do Tutor logado e desse mesmo profissional (nunca confia só no que vem pela URL) — e pré-preenche categoria, pets e endereço/respostas.
- `components/requests/new-request-form.tsx`: novos props `initialCategory/initialPetIds/initialAddress/initialCategoryAnswers`. Data do atendimento e consentimento de compartilhar a ficha **nunca** vêm pré-preenchidos — são específicos de cada pedido novo.

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo: a partir de uma solicitação concluída, clicar em "Contratar novamente" abre o formulário com a mensagem "Trouxemos os dados do atendimento anterior", categoria e pet já marcados corretamente.

**Achado à parte (infraestrutura, não é bug do app):** o dev server (Turbopack) travou com um erro de cache do Windows/OneDrive (`EBUSY`/arquivo `.sst` em uso) no meio da sessão — resolvido apagando `.next/` e reiniciando. Não tem relação com nenhuma mudança de código desta entrega.

**Com este item, a Onda 4 (execução, segurança e reputação) está completa** — pipelines por categoria, botão "Preciso de ajuda", disputas e apelação, moderação, nota média agregada e "contratar novamente".

---

## 2026-09-01 — Onda 4, item 5: nota média agregada no perfil e na busca

**Entrega:** quinto item da Onda 4 (seção 12.3). `averageRating()` já existia (Onda 1) mas só alimentava o cálculo do **nível** (Novo/Experiente/Top) — o número de verdade nunca era mostrado em lugar nenhum. Achado mais grave: o card de cada profissional em `/buscar` mostrava **"★ novo" fixo pra todo mundo**, mesmo profissional com dezenas de avaliações 5 estrelas — não era só uma ausência, era uma informação errada na tela.

- `app/(tutor)/buscar/page.tsx`: a agregação de `reviews` por profissional, que só rodava quando o filtro de nota mínima estava ativo, passa a rodar sempre que há resultado — o card mostra `★ 4.8 (12)` de verdade, ou "novo" só quando é mesmo o caso.
- `app/(tutor)/profissional/[profissionalId]/page.tsx`: nota numérica ao lado da contagem de avaliações, no lugar do texto genérico.
- `app/(profissional)/perfil/page.tsx`: o próprio profissional passa a ver sua nota média junto do nível, ao lado do "Completude do perfil".

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo: criada uma avaliação real (Tutor avalia Profissional com nota 4.8) → busca mostra "4.8 (1)" pra esse profissional e "novo" pro outro, sem avaliação nenhuma → perfil público mostra "4.8 · 1 avaliação de atendimentos concluídos" — confirmado nas duas telas antes de reverter o dado de teste.

---

## 2026-09-01 — Onda 4, item 4: moderação de avaliações e mensagens

**Entrega:** quarto item da Onda 4 (seção 12.3). `messages.flagged_reason` já existia desde `0004_requests_and_proposals.sql`, mas nenhum código nunca escreveu nela — coluna existia, funcionalidade não.

- `supabase/migrations/0031_moderacao.sql`: `messages` ganha `flagged_by/flagged_at/hidden_at/hidden_by`; `reviews` ganha os mesmos cinco campos (incluindo `flagged_reason`, que não existia). Funções `flag_message`/`flag_review` (SECURITY DEFINER — quem sinaliza só pode mexer nessas colunas, não no conteúdo) e `set_message_hidden`/`set_review_hidden` (Admin/Supervisor).
- `supabase/migrations/0033_dismiss_flag.sql`: "Manter" na fila de moderação precisa limpar a sinalização de verdade (`dismiss_message_flag`/`dismiss_review_flag`), senão o item reaparece pra sempre a cada carregamento.
- `components/requests/chat-panel.tsx`: quem não mandou a mensagem pode sinalizar; mensagem oculta vira um aviso genérico pras duas partes.
- `components/requests/review-section.tsx`: só quem foi avaliado pode reportar a própria avaliação recebida; avaliação oculta mostra aviso no lugar do conteúdo.
- `components/admin/moderation-queue.tsx` + `/admin/moderacao` + `/supervisor/moderacao` (novas rotas): fila de conteúdo sinalizado, com "Ocultar" ou "Manter".
- Avaliação oculta passa a ser excluída do cálculo de nota média e da listagem pública em todos os 3 lugares que agregam `reviews` (perfil público do profissional, perfil próprio, busca com filtro de nota mínima).

**Gap de RLS encontrado e corrigido no processo:** `messages_select` só liberava Admin/Supervisor lerem mensagens de uma solicitação que já tivesse **incidente** — uma mensagem sinalizada numa solicitação sem incidente ficaria invisível pra quem precisa moderar. Corrigido em `supabase/migrations/0032_moderacao_visibilidade_admin.sql`, liberando leitura também quando `flagged_reason is not null`.

**Verificação:** `tsc --noEmit`/`eslint .` limpos, types regenerados. Testado com sessões RLS reais: Tutor sinaliza mensagem do Admin → Admin consegue ver (fix de RLS confirmado) → Admin oculta → mensagem reverte pra estado limpo. Auto-sinalização de mensagem própria bloqueada. Avaliação: Tutor avalia Profissional com nota baixa → Profissional (reviewee) sinaliza → Admin oculta → query de agregação de nota média confirmadamente exclui a avaliação oculta (1 avaliação total, 0 na agregação). Reviewer tentando sinalizar a própria avaliação enviada, e Tutor tentando ocultar uma mensagem, ambos bloqueados com erro claro.

---

## 2026-09-01 — Onda 4, item 3: disputas e apelação + bug de RLS corrigido

**Entrega:** terceiro item da Onda 4 (seção 3 — "Em disputa: pagamento, qualidade ou responsabilidade sob análise administrativa"). `em_disputa`/`incidente` já existiam como `request_status`, e as transições confirmado/checkin/em_andamento/finalizacao → incidente → em_disputa já estavam na tabela de transições — só nunca eram usadas de verdade, e faltava a própria parte poder apelar de uma resolução.

- `supabase/migrations/0029_disputas_apelacao.sql`: `incidents` ganha `appealed_at`/`appeal_reason`; novas transições `concluido → em_disputa` e `avaliacao → em_disputa` (qualidade só dá pra contestar depois do atendimento — gap na tabela original, não restrição intencional).
- `lib/actions/incidents.ts` (`openIncident`): agora também move `requests.status` pra `incidente` quando havia um atendimento em curso (confirmado/checkin/em_andamento/finalizacao) — antes disso não existe transição permitida, e nem faria sentido.
- `lib/actions/supervisor.ts` (`escalateIncident`): escalar pro Admin é o que caracteriza uma disputa de verdade — agora também avança `incidente → em_disputa`.
- `lib/actions/admin.ts` (`resolveIncident`): ganhou parâmetro `finalOutcome` — se a solicitação estava `em_disputa`, o Admin **precisa** escolher o resultado final (`concluido` ou `cancelado`, as únicas saídas permitidas); se estava só `incidente` (nunca virou disputa formal), a solicitação volta sozinha pra onde estava antes de parar (resume pela ocorrência atual).
- `components/requests/help-button.tsx`: ganhou apelação — quando não há incidente aberto, mostra o último resolvido com botão "Não concordo com essa resolução — apelar".
- `components/admin/incident-queue.tsx`: badge "Em disputa"; formulário de encerramento pede o resultado final quando aplicável.

**Bug de RLS encontrado e corrigido no processo:** a apelação, implementada como `update()` direto pela própria parte, "funcionava" sem erro mas afetava **0 linhas** — a policy `incidents_update` só libera Admin/Supervisor, RLS filtra linhas silenciosamente sem lançar exceção (mesma armadilha do bug de `accept` em `proposals` já corrigido nesta sessão). Corrigido com `supabase/migrations/0030_fix_appeal_incident_rls.sql`: função `appeal_incident()` `SECURITY DEFINER` que valida permissão e transição por dentro, em vez de uma policy de UPDATE nova que liberaria a linha inteira (todas as colunas, não só as da apelação) pra parte.

**Verificação:** `tsc --noEmit`/`eslint .` limpos, types regenerados. Testado de ponta a ponta com sessões RLS reais: Tutor abre incidente com atendimento `confirmado` → status vira `incidente` → Supervisor escala → `em_disputa` → Admin resolve com resultado final `concluido` → Tutor apela do resolvido (via RPC) → incidente volta a `escalado` com motivo registrado, solicitação volta a `em_disputa`. Teste negativo: um Tutor que não é parte do incidente recebe erro claro ao tentar apelar.

---

## 2026-09-01 — Onda 4, item 2: botão "Preciso de ajuda"

**Entrega:** segundo item da Onda 4 (seção 8.2 da Especificação v2.0). A tabela `incidents`, o bloqueio automático de payout por incidente aberto (trigger de `0007_safety_and_reputation.sql`) e a intervenção do Admin/Supervisor no chat como "Suporte" (`0015_staff_chat_intervention.sql`) já existiam — faltava só a porta de entrada pro próprio Tutor/Profissional abrir um incidente, e a notificação pro suporte ficar sabendo.

Discutido com o usuário antes de implementar:
- **Fluxo confirmado:** não é um chat novo — é a mesma conversa do atendimento, com o Admin/Supervisor ganhando permissão de escrever nela (aparecendo como "Suporte") só enquanto o incidente não estiver `resolvido`. Zero código novo aqui, só confirmação de que já funcionava.
- **Status do incidente:** mantido o enum existente (`aberto/em_analise/resolvido/escalado`), sem um "cancelado" separado — um incidente aberto por engano é só `resolvido` com uma nota no campo `resolution`.
- **Tipo + urgência + SLA:** lista de tipos fixa no código (`lib/domain/incident-types.ts`) — Agressão/comportamento perigoso, Emergência médica, Dano à propriedade, Descumprimento do combinado, Comportamento inadequado, Outro — cada um com uma urgência padrão, escolhida automaticamente (não é mais uma decisão manual de quem abre o incidente, um campo a menos num momento de estresse). O que fica configurável pelo Admin sem deploy é o **SLA em horas por tipo**, via `platform_parameters` (mesmo padrão de `comissao_percentual`/`retencao_nao_comparecimento_percentual`) — a lista de tipos em si não é editável pelo Admin, é código.

- `supabase/migrations/0028_preciso_de_ajuda.sql`: `incidents` ganha `description` (relato obrigatório em texto livre, além da classificação); trigger `incidents_notify` que notifica todo Admin/Supervisor ativo (`account_roles`) quando um incidente é aberto — ninguém é responsável designado ainda nesse momento, então é broadcast, não notificação individual.
- `lib/domain/incident-types.ts`, `lib/validations/incidents.ts`, `lib/actions/incidents.ts` (`openIncident`): a RLS de insert já existia (`incidents_insert`, `0009_rls_policies.sql`) permitindo a própria parte abrir — a action só valida e traduz erro.
- `components/requests/help-button.tsx`: botão "Preciso de ajuda" dentro do card "Atendimento atual"; quando já existe um incidente aberto, mostra acompanhamento (tipo, status, relato, resposta do suporte) no lugar do botão, evitando abrir dois incidentes pro mesmo problema.
- **Gap fechado de brinde:** Admin e Supervisor não tinham nenhum jeito de chegar em `/notificacoes` (só a Home do Tutor linkava pra lá) — `components/shared/notifications-badge-link.tsx` (novo) adiciona o link com contagem de não lidas nas telas `/admin/dashboard`, `/admin/incidentes` e `/supervisor/incidentes`. `components/shared/notification-list.tsx` ganha rótulo amigável pro tipo `incidente_aberto` (antes cairia no fallback genérico, mostrando o nome técnico do evento).

**Verificação:** `tsc --noEmit`/`eslint .` limpos, types regenerados. Testado ao vivo com sessões reais: Tutor abre incidente ("Comportamento inadequado da outra parte") → urgência `media` gravada automaticamente → notificação criada pra Admin e Supervisor → aparece na fila `/admin/incidentes` e em `/notificacoes` com contagem de não lida e rótulo amigável → Admin acessa a solicitação como suporte e envia mensagem no chat → mensagem aparece rotulada "Suporte" pro Tutor. Achado de metodologia de teste (não bug do app): `form_input` não disparou o `onChange` do React nesse input específico de mensagem — trocado por digitação real (`computer type`), confirmando que o app sempre funcionou certo.

---

## 2026-09-01 — Onda 4, item 1: pipeline de execução por categoria no card do Kanban

**Entrega:** primeiro item da Onda 4 (execução, segurança e reputação — seção 12.3 da Especificação v2.0). Discutido com o usuário antes de implementar: o enum `occurrence_status` continua único e genérico (`agendado/checkin/em_andamento/finalizacao/concluido`), cumprindo o critério de aceite da seção 15 ("um único modelo de status e histórico") — só o **rótulo exibido no card** muda por categoria de serviço, sem migration nem lógica de transição nova.

- `lib/domain/occurrence-pipeline.ts` (novo): mapa `STAGE_LABEL_BY_CATEGORY` com o nome específico de cada fase por categoria (ex.: passeador usa "Pet recebido/Passeio iniciado/Retorno"; hospedagem usa "Entrada/Hospedado/Preparando saída/Entregue"; banho e tosa usa "Pronto pra retirada/Entregue"), com fallback genérico ("Início do atendimento/Em andamento/Finalização/Concluído") pra quando a categoria não tem nome próprio pra uma fase.
- "Buscado"/"Entregue" não virou um estado novo — é o mesmo `concluido` de sempre, só nomeado do ponto de vista de quem usa o Kanban (o profissional entrega o pet de volta); banho/tosa e hospedagem compartilham essa leitura porque são fisicamente o mesmo caso.
- `components/kanban/kanban-board.tsx`: as colunas continuam genéricas (mesmo texto pra todo mundo); o card individual ganha um rótulo da fase atual (exceto em `agendado`, que já tem seu próprio aviso, e em `concluido`, que já tem o badge terminal) e os botões de avançar fase passam a dizer "Marcar: {nome da fase}" em vez de um verbo fixo.

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo no Kanban real: forçado temporariamente (e revertido) a categoria de uma solicitação concluída pra `hospedagem_creche` — o card passou a mostrar "Entregue" em vez de "Concluído", confirmando que o mapa de rótulos por categoria funciona de ponta a ponta.

---

## 2026-09-01 — Decisão de roadmap (revista duas vezes no mesmo dia): Onda 3 (financeiro real) fica pro final

**Contexto:** usuário perguntou se o financeiro real (Onda 3, seção 12.2 da Especificação v2.0) precisa esperar o investimento fechar, ou se dá pra construir sem contratar o Pagar.me. Resposta técnica: a maior parte é construível em modo sandbox (chaves de teste gratuitas, sem CNPJ aprovado nem negociação comercial) — onboarding de recebedor, Pix/cartão, split, webhooks, extrato reconciliado e saque manual funcionam de ponta a ponta em sandbox. O que realmente depende de investimento/negociação são as decisões já registradas na seção 14 (conta de recebedor real com KYC, taxa de Pix negociada, prazo de liquidação, percentuais de comissão).

**Primeira decisão:** adiar a Onda 3 pro final do roadmap.

**Segunda decisão:** depois de entender que o sandbox não depende de investimento nem contrato, o usuário reverteu — a Onda 3 entraria imediatamente, construída contra o sandbox do Pagar.me. Um plano de "Fase 1" foi desenhado (checkout Pix + split + webhook + extrato básico, deixando cartão de crédito e o efeito financeiro de cancelamento/no-show pra uma "Fase 2" futura, registrada como backlog).

**Decisão final (a que vale):** ao ver esse plano fatiado, o usuário apontou dois problemas e revertou de novo — desta vez pra ficar: **(1)** o Pilar 1 é pra ser entregue 100%, não em fatias que empurram cartão/cancelamento/no-show pra um backlog permanente — são parte do mesmo pacote financeiro, não itens opcionais; **(2)** os percentuais de comissão/taxa usados no plano eram só placeholders — na prática isso é configurado pelo Admin (`platform_parameters` + `components/admin/parameters-manager.tsx`, já existentes), e falta antes de tudo pensar numa **tela de conciliação para o Admin** que evite problemas de pagamento (duplicidade, split errado, saque liberado indevidamente) — a complexidade real exige um desenho único e completo, não uma entrega incremental. **A Onda 3 fica de fato pro final do roadmap, e será desenhada e construída inteira de uma vez** (Pix + cartão + split + webhooks + extrato + conciliação do Admin + cancelamento + no-show + saque) quando chegar sua vez — nenhum código foi escrito nas duas primeiras tentativas desta decisão, só a pesquisa da API do Pagar.me v5 (autenticação Basic Auth com secret key, criação de recebedor com split, cobrança Pix, webhooks) fica registrada aqui como contexto útil para quando a onda for retomada.

---

## 2026-09-01 — Onda 2 completa: itens 4, 5, 6 e 7 (solicitação contextual, ajuste de proposta, visita inicial, recorrência avançada)

**Entrega:** fecha a Onda 2 por completo — os quatro itens restantes do plano (Especificação v2.0, seção 12.1), depois da agenda flexível (item 5, parte) já ter sido entregue em entrada anterior deste changelog.

**Item 4 — Solicitação contextual completa:**
- `supabase/migrations/0023_solicitacao_contextual.sql`: `requests` ganha `address` (texto livre, opcional) e `category_answers` (jsonb); nova tabela `request_attachments` (RLS: leitura pra parte da solicitação ou admin/supervisor; inserção só por quem é parte) + bucket privado `request-attachments` (mesmo padrão de path `{request_id}/arquivo` das entregas anteriores).
- `lib/domain/category-questions.ts`: uma pergunta específica por categoria de serviço (ex.: pet sitter pergunta acesso à residência; veterinário domiciliar pergunta sintomas) — nenhuma é obrigatória no schema, é só contexto a mais que o Profissional recebe já na solicitação.
- `components/requests/request-attachments-section.tsx`: upload/visualização de anexos da solicitação (reaproveita `FileUploadField` da Onda 1), com URL assinada pra visualização (bucket privado).
- Formulário de nova solicitação (`components/requests/new-request-form.tsx`) e página de detalhe ganham os campos de endereço, perguntas por categoria e anexos.

**Item 5 (conclusão) — Propostas completas:**
- `supabase/migrations/0024_proposta_ajuste.sql`: libera a transição de status `proposta_enviada → em_conversa` na máquina de estados (`request_status_transitions_allowed`) — sem isso, "pedir ajuste" seria bloqueado pelo trigger de transição.
- `lib/actions/requests.ts` (`requestAdjustment`): Tutor pede ajuste numa proposta ainda não aceita — grava o feedback como mensagem no chat e volta o status pra `em_conversa`, sem preço/escopo novo ainda (o Profissional reenvia uma nova versão pelo fluxo normal de proposta).
- `acceptProposal` ganha checagem de expiração (`validity_at`) antes de aceitar — bloqueia aceite de proposta vencida.
- `components/requests/proposal-panel.tsx`: histórico de versões anteriores com diff de preço (`<details>` colapsável), badge de "Proposta expirada", botão "Pedir ajuste" com formulário inline.

**Item 6 — Visita inicial como jornada própria:**
- `supabase/migrations/0025_visita_inicial_config.sql`: `professional_profiles` ganha `visita_inicial_enabled/price/duration_minutes/modality/deductible` — o Profissional configura se oferece visita inicial, preço (nulo = gratuita), duração, modalidade e se é abatido do primeiro contrato fechado.
- Perfil do Profissional (`app/(profissional)/perfil/page.tsx` + form) ganha o bloco de configuração; perfil público do Profissional (`app/(tutor)/profissional/[profissionalId]/page.tsx`) mostra um card "Solicitar visita inicial" com preço/duração/modalidade quando habilitado, linkando pra `/solicitacoes/nova?...&visitaInicial=1`.
- `createRequest` faz auto-link silencioso: se o Tutor já teve uma visita inicial concluída/avaliada com o mesmo Profissional, a nova solicitação grava `origin_request_id` automaticamente — sem UI extra, é só contexto de histórico entre visita e contrato completo.

**Item 7 — Recorrência avançada:**
- `supabase/migrations/0026_recorrencia_avancada.sql`: `requests.recurrence_interval` passa a ser persistido (antes só existia no momento da criação, sem ficar salvo).
- `lib/actions/requests.ts` (`rescheduleOccurrence`): reagenda uma ocorrência específica (`request_occurrences.status = 'agendado'`) pra qualquer parte da solicitação, sem aprovação da contraparte — "nunca bloqueia a agenda", mesmo princípio já usado na agenda flexível.
- `lib/actions/requests.ts` (`updateRecurrence`): edita a frequência dali pra frente — recalcula só as ocorrências com `status = 'agendado'`, ancorando na primeira pendente; ocorrências já `concluido`/`cancelado` nunca são tocadas (verificado com checagem direta no banco: ocorrência concluída manteve a data, as `agendado` foram recalculadas).
- Timezone: avaliado e descartado como item separado — a matemática de data já usada em todo o projeto é UTC-safe (mesmo padrão da agenda flexível), não havia bug a corrigir.

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessões reais (RLS), incluindo os quatro fluxos ponta a ponta na UI real (não só via script): solicitação com endereço + pergunta de categoria + visita inicial pré-marcada via link; profissional envia proposta → tutor pede ajuste → status volta pra "Em conversa" e a mensagem aparece no chat; reagendar uma ocorrência específica sem afetar as demais; editar recorrência de semanal pra quinzenal recalculando só as ocorrências futuras. Upload de anexo testado com sessão RLS real, incluindo checagem negativa (um Tutor que não é parte da solicitação não enxerga o anexo).

---

## 2026-09-01 — Criação do IDEIAS_FUTURAS.md

**Contexto:** usuário quis registrar duas ideias de funcionalidade pra Onda 5 (CRM) antes de continuar a Onda 2, pra não perdê-las: (1) Kanban reordenável manualmente pelo Profissional, evoluindo pra sugestão de rota mais rápida entre atendimentos com integração de trânsito, e estimativa de chegada em tempo real conforme o horário se aproxima; (2) post automático no Instagram, com selo Petlys e comentário do Tutor, usando uma foto do relatório do atendimento escolhida pelo Profissional.

**Entrega:** novo `IDEIAS_FUTURAS.md` — diferente do `BACKLOG.md` (que é só pra itens adiados no meio de uma implementação em andamento), este é pra ideias de produto de ondas que ainda não começaram, sem desenho técnico fechado. Cada ideia já lista as dependências que evidencia (ex.: a ideia de rota depende de endereço estruturado por atendimento, que é o item 4 da Onda 2, e de um fornecedor de trânsito ainda não escolhido; a ideia do Instagram depende de um consentimento de imagem específico, diferente do consentimento de prontuário já existente).

---

## 2026-09-01 — Decisão de produto/arquitetura: CRM do Profissional como módulo da Onda 5

**Contexto:** usuário propôs ter na plataforma só as funcionalidades básicas pro Profissional e um CRM à parte, com funcionalidades avançadas, mesmo banco de dados, camada extra sobre o Profissional.

**Decisão:**

1. **O CRM avançado do Profissional fica dentro do escopo existente — é a Onda 5** ("Retenção e ferramentas do Profissional", seção 12.4 da Especificação v2.0), não um pilar/plataforma novo. A ideia do usuário vira, na prática, a resposta a uma decisão que já estava listada como pendente na seção 14: *"modelo econômico do cliente próprio, recorrência, mensalidade"* — o CRM avançado passa a ser modelado como **tier/assinatura paga** sobre a Onda 5.
2. **Mesmo app, novas rotas — não um repositório/deploy separado.** O CRM será construído como uma área nova dentro do mesmo Next.js (ex.: `/crm/*`), com acesso controlado por uma flag de assinatura (RLS + checagem na aplicação), reaproveitando profiles/services/reviews/histórico já existentes. Decisão explícita contra separar em outro app/subdomínio: duas bases de código escrevendo migrations no mesmo Supabase é exatamente o problema que essa sessão já teve que reconciliar uma vez (sessões desalinhadas do Claude Code editando o mesmo banco sem saber uma da outra, ver entrada de 2026-09-01 "Reconciliação"). Um app separado só voltaria a ser considerado se houver time dedicado só ao CRM e disciplina de migration compartilhada.

**Não decidido ainda (fica para quando a Onda 5 começar):** o modelo de preço da assinatura em si, quais funcionalidades específicas ficam do lado "básico" vs. "CRM avançado", e a atualização formal da Especificação v2.0 refletindo essa decisão (hoje só registrada aqui).

---

## 2026-09-01 — Agenda flexível na proposta + bug crítico corrigido (aceite de proposta nunca gravava)

**Contexto:** discussão de produto sobre como o Profissional deveria poder negociar horário sem ficar travado por um sistema rígido de agenda — o Tutor pede um horário, o Profissional pode manter, propor outro horário exato, ou só um período do dia (manhã/tarde/noite) quando ainda não sabe a hora certa. Decisão confirmada com o usuário: negociação dentro da própria proposta formal (não uma etapa separada), com período em opções fixas (não texto livre nem faixa de horário).

- `supabase/migrations/0021_agenda_flexivel_proposta.sql`: `proposals` ganha `proposed_scheduled_at` (horário exato) e `proposed_period` (manha/tarde/noite), mutuamente exclusivos (constraint). Ao aceitar uma proposta com horário exato, **todas** as ocorrências do contrato são deslocadas pela mesma diferença de tempo (preserva o espaçamento de contratos recorrentes) — proposta só com período não mexe em nada, fica só como informação visível pro Tutor, o horário exato se resolve pelo chat sem travar ninguém.
- `components/requests/proposal-panel.tsx`: formulário de nova proposta ganha o seletor de horário (manter / horário exato / período); card de proposta exibe "Novo horário proposto" ou "Período proposto" quando aplicável.

**Bug crítico encontrado e corrigido no processo:** a tabela `proposals` nunca teve política de RLS para `UPDATE` desde a criação (`0009_rls_policies.sql`) — o comentário original dizia "nova versão é sempre um novo insert, não edição", mas `acceptProposal` (que já existia) faz um `UPDATE` pra gravar `accepted_at`. Sem policy de UPDATE, o Postgres nega por padrão: **toda vez que um Tutor clicava em "Aceitar proposta", a solicitação avançava de status normalmente, mas `proposals.accepted_at` nunca era gravado de verdade** — silenciosamente, sem erro. Descoberto ao testar a agenda flexível, que precisa ler esse campo logo depois do accept.

- `supabase/migrations/0022_fix_proposals_accept_rls.sql`: adiciona a policy de UPDATE (só o Tutor da solicitação, e só depois de confirmar que é ele). Como RLS filtra linhas mas não colunas, a policy sozinha deixaria o Tutor alterar `price`/`scope`/etc. via API direta — corrigido com `revoke update ... / grant update (accepted_at) ...`, restringindo em nível de coluna. Testado explicitamente: tentativa de um Tutor baixar o próprio preço via update direto agora retorna "permission denied", e aceitar (só `accepted_at`) continua funcionando.

**Verificação:** `tsc --noEmit`, `eslint .` limpos. Testado com sessões reais (RLS): horário exato desloca todas as ocorrências corretamente, período não mexe em nada, constraint bloqueia os dois campos juntos, tentativa de tamper de preço bloqueada. Fluxo completo testado na UI real: Profissional envia proposta com período "Manhã", Tutor vê "Período proposto: Manhã" e clica "Aceitar proposta" — pela primeira vez de forma confirmada, o card realmente muda pra "Proposta aceita" (antes do fix, isso nunca acontecia de verdade).

---

## 2026-09-01 — Criação do BACKLOG.md

**Contexto:** a pedido do usuário, o item 3 da Onda 2 ("chat com mídia") foi adiado ("não é necessário agora") e ele pediu pra documentar essa lista de itens adiados pra revisão futura, em vez de deixar isso só registrado numa conversa.

**Entrega:** novo `BACKLOG.md` na raiz do repositório — lista curada de funcionalidades **deliberadamente adiadas** durante a implementação (não o roadmap completo, que é a seção 12 da Especificação v2.0, nem as decisões de negócio pendentes, que são a seção 14). Cada item registra origem, motivo do adiamento e esforço estimado pra quando for retomado. Populado com: chat com mídia (Onda 2, item 3, adiado nesta entrada), mapa visual na busca e tela dedicada `/favoritos` (já adiados em 2026-09-01 na entrega de busca avançada), e os dois itens pendentes da Onda 0 (achados de segurança do Supabase, testes automatizados/CI) que já existiam soltos em entradas antigas deste changelog.

---

## 2026-09-01 — Onda 2, item 2: busca avançada — filtros e favoritos (Especificação v2.0, seção 12.1)

**Entrega:** segunda história da Onda 2 — filtros de preço, nota mínima, subcategoria e espécie em `/buscar`, mais favoritos do Tutor. Mapa visual (a outra parte do item do plano) fica pra um sub-item à parte — traz uma biblioteca nova (Leaflet) e é tecnicamente independente do resto.

- `supabase/migrations/0020_favoritos.sql`: nova tabela `tutor_favorites` (par tutor+profissional, RLS restrita ao próprio Tutor).
- `lib/actions/favorites.ts`: `toggleFavorite` — favorita/desfavorita, sem tabela de estado prévio no cliente (o próprio banco decide se é insert ou delete).
- `components/search/favorite-button.tsx`: coração reutilizável (usado dentro de `<Link>` na lista de busca — por isso `preventDefault`/`stopPropagation`, senão o clique também navegaria pro perfil — e sozinho no cabeçalho do perfil público).
- `components/search/search-filters-form.tsx`: painel de filtros que mescla parâmetros na URL (`useSearchParams` + `router.push`, mesmo padrão de `UseMyLocationButton`) — preço min/max, nota mínima, subcategoria (dependente da categoria escolhida, reaproveitando `lib/domain/service-catalog.ts` da Onda 2 item 1), espécie e "somente favoritos".
- `app/(tutor)/buscar/page.tsx`: aplica os filtros na query (`gte`/`lte` de preço, `eq` de subcategoria, `.or()` de espécie aceitando também serviços sem restrição declarada) e, pra nota mínima, agrega `reviews` por profissional em memória (reaproveitando `averageRating` da Onda 1) — profissional sem nenhuma avaliação não atende um filtro de nota mínima explícito.

**Verificação:** `tsc --noEmit`, `eslint .` limpos. Testado com sessões reais (RLS): Tutor favorita o próprio, tentativa de favoritar em nome de outro Tutor bloqueada, outro Tutor não enxerga favorito alheio; filtros de preço/subcategoria/espécie testados via query direta (incluindo o caso "espécie X não deve aparecer pra serviço que só aceita espécie Y"). Fluxo completo testado na UI real: abrir painel de filtros, aplicar preço mínimo (resultado mudou corretamente), favoritar um card sem sair da página, marcar "somente favoritos" e ver a lista reduzir ao esperado.

**Não incluído nesta história:** mapa visual (Leaflet + OpenStreetMap, sem custo de API key — fica pra um próximo sub-item), tela dedicada `/favoritos` (hoje só dá pra filtrar por favoritos dentro de `/buscar`, não existe uma lista separada).

---

## 2026-09-01 — Onda 2, item 1: catálogo de serviços flexível (Especificação v2.0, seção 12.1)

**Entrega:** primeira história da Onda 2 — subcategoria, duração, espécies/porte atendidos, restrições e adicionais com preço próprio para cada serviço publicado. "Perguntas por categoria" (a outra metade do item do plano) fica pra história de solicitação contextual (item 4 da Onda 2) — é sobre o que se pergunta ao Tutor, não sobre o que o Profissional cadastra.

- `supabase/migrations/0019_service_catalog_flexivel.sql`: `professional_services` ganha `subcategory`, `duration_minutes`, `species_accepted`, `min_size`/`max_size` (com constraint `min_size <= max_size`) e `restrictions`. Nova tabela `professional_service_addons` (nome + preço, RLS espelhando a visibilidade do serviço-pai: público se ativo, senão só dono/admin/supervisor).
- `lib/domain/service-catalog.ts` (novo): subcategorias sugeridas por categoria mantidas em código, não em tabela administrável — catálogo editável pelo Admin é escopo maior, fora desta história.
- `lib/validations/services.ts` / `lib/actions/services.ts`: `createServiceSchema` cobre os novos campos; `createService` grava o serviço e os adicionais numa sequência (adicionais dependem do id gerado).
- `components/services/service-form.tsx`: subcategoria como select dependente da categoria, espécies como checkboxes, porte min/máx, restrições, e uma lista dinâmica de adicionais (nome + preço, adicionar/remover linha).
- `components/services/service-list.tsx`, `app/(tutor)/profissional/[profissionalId]/page.tsx`: exibem os novos campos onde o catálogo já aparecia (painel do profissional e vitrine pública) — filtros de busca por esses campos ficam para o item 2 da Onda 2.

**Verificação:** `tsc --noEmit`, `eslint .` limpos. Testado com sessões reais (RLS): criação com todos os campos, adicional só pode ser inserido pelo dono do serviço (RLS bloqueou tentativa de outro profissional), leitura pública inclui os adicionais, constraint de porte rejeita `min_size > max_size`. Fluxo completo também testado na UI de verdade (não só script): categoria → subcategoria dependente aparecendo/mudando corretamente, adicional criado, serviço publicado e listado.

**Nota de processo:** a verificação na UI ficou intermitente por um bom tempo (formulário não reagia, submit não chegava ao servidor) — não era bug de código, era o servidor de desenvolvimento (rodando desde o início desta sessão longa) com módulo novo (`service-catalog.ts`) não totalmente atualizado via HMR. Reiniciar o `next dev` resolveu; guardado aqui porque é o tipo de sintoma que engana (parece bug de React, é cache de dev server).

---

## 2026-09-01 — Especificação Funcional v2.0 (substitui a v1.2)

**Contexto:** perguntado se existia uma especificação com escopo fechado e atualizada do Pilar 1. Resposta honesta: não — a v1.2 (`.docx`) estava desatualizada (não refletia a decisão de adotar o plano 100% nem nada entregue na Onda 1), e o `PETLYS_PILAR1_PLANO_100_PERCENT.md` não é um documento fechado (tem ~16 decisões de produto/negócio ainda em aberto na própria seção 7 dele, e é estruturado como plano evolutivo, não especificação congelada). Pedido do usuário: consolidar tudo em um único documento — a v2.0 — como fonte de verdade única a partir de agora.

**Entrega:** `Especificacao_Pilar_1_Jornadas_v2.docx`, salvo em `PetApp/Novo/` ao lado da v1.1 e da v1.2 (mantidas intactas, regra de versionamento do projeto). 29 páginas.

- Seções 1–10 (núcleo de marketplace) preservadas com a **mesma numeração da v1.2** — dezenas de comentários no código (migrations, actions) referenciam "seção X.Y" diretamente; renumerar quebraria essa rastreabilidade. Conteúdo atualizado só onde a implementação real trouxe uma decisão mais específica (termos versionados, requisitos dinâmicos do prontuário, consentimento por solicitação, habilitação por categoria regulamentada, selos/nível de carreira).
- **Seção 11 (nova):** ledger de implementação — cada tópico das seções 1–10 marcado como Implementado / Especificado-não implementado / Não implementado, sem eufemismo.
- **Seção 12 (nova):** absorve o escopo do plano 100% (Espaços, seguro, backup, retenção do profissional, operação regional, qualidade/segurança) organizado pelas mesmas Ondas 2–7 já em uso neste changelog.
- **Seção 14:** consolida as decisões pendentes da v1.2 (§13.3) com as da seção 7 do plano 100% — uma lista única, todas explicitamente marcadas como não resolvidas.
- **Seção 16 (nova):** histórico executivo de como o escopo evoluiu (v1 → v1.1 → v1.2 → reconciliação → decisão de escopo integral → Onda 1), resumindo este `CHANGELOG.md` em nível de produto, não o substituindo.

**Processo:** conteúdo redigido em Markdown, convertido para `.docx` via `pandoc` (skill `docx`), renderizado para PDF via LibreOffice e conferido visualmente página por página antes da entrega — não só gerado e assumido correto.

**Não incluído:** revisão jurídica do texto de Termos/Privacidade (placeholder, já sinalizado dentro do próprio documento); as ~16 decisões da seção 14 continuam sem dono nem prazo — a v2.0 as lista, não as resolve.

---

## 2026-09-02 — Onda 1: fechamento (termos, requisitos por categoria, upload real, habilitações e selos)

**Entrega:** últimas quatro histórias da Onda 1, encerrando a onda — termos versionados (6.1), requisitos dinâmicos do prontuário + consentimento de compartilhamento (6.2/6.4), upload real de arquivo (6.1/6.2/6.3) e habilitações/selos do profissional (6.3). Migration única `0018_terms_consent_documents_certifications.sql`.

- **Termos e privacidade (6.1):** nova tabela `terms_acceptances` (aceite versionado — `CURRENT_TERMS_VERSION` em `lib/domain/terms.ts`). Gate obrigatório em `lib/supabase/middleware.ts`, entre a verificação de telefone/e-mail e a escolha de papel: sem aceite da versão vigente, qualquer rota redireciona pra `/aceitar-termos` (novo). Texto de Termos/Privacidade é um placeholder funcional — precisa de revisão jurídica antes de produção (documentado no próprio arquivo).
- **Requisitos dinâmicos por categoria + consentimento (6.2/6.4):** `lib/domain/category-requirements.ts` mapeia cada categoria de serviço às seções do prontuário que ela exige (ex.: passeador exige comportamento; hospedagem exige rotina). `NewRequestForm` avisa quais pets estão incompletos pra categoria escolhida e bloqueia o envio até resolver; `createRequest` valida de novo no servidor (RLS não cobre isso, é regra de produto). Checkbox obrigatório "Autorizo compartilhar a ficha..." grava `requests.prontuario_shared_at` (nova coluna) no momento da criação.
- **Upload real de arquivo (6.1/6.2/6.3):** `components/shared/file-upload-field.tsx` (novo, genérico) substitui os campos de URL por upload de verdade em 4 lugares: avatar do profissional (bucket `avatars`, já existia), foto do pet (bucket novo `pet-photos`, público), carteira de vacinação/documento do pet (bucket novo `pet-documents`, privado — só tutor/co-tutores/profissional com solicitação vinculada/admin-supervisor) e documento de habilitação do profissional (bucket novo `professional-certifications`, privado — só o dono e admin/supervisor).
- **Habilitações e selos (6.3):** nova tabela `professional_certifications` — profissional envia documento por categoria regulamentada (`lib/domain/regulated-categories.ts`, hoje só `veterinario_domiciliar`), fica `pendente` até Admin/Supervisor aprovar/rejeitar em `/admin/habilitacoes` (novo). `createService` bloqueia publicar serviço em categoria regulamentada sem habilitação aprovada. Selo "Documentação verificada" e nível de carreira (`lib/domain/professional-reputation.ts` — Novo/Experiente/Top Petlys, calculado por atendimentos concluídos + média de avaliações) aparecem em `/perfil` e `/profissional/[id]`.
- `types/database.ts` regenerado; aliases de conveniência reaplicados no fim do arquivo (mesma rotina de toda regeneração — ver entrada anterior).

**Verificação:** `tsc --noEmit`, `eslint .` e `next build` limpos (32 rotas, incluindo `/aceitar-termos` e `/admin/habilitacoes`). Testado com sessões reais (RLS, não bypass): aceite de termos bloqueia e libera navegação corretamente; tentativa de um usuário aceitar termos por outro é bloqueada; profissional não consegue se auto-aprovar habilitação (0 linhas afetadas — RLS correta); outro profissional não enxerga certificação alheia; tutor sobe foto/documento do próprio pet, profissional sem solicitação vinculada não lê o documento; outro profissional não lê certificação alheia. Fluxo completo testado no browser: gate de termos (checkbox → redirect), formulário de nova solicitação mostrando "falta Comportamento" pra Nina na categoria Passeador, sumindo ao trocar pra Banho e Tosa, envio real gravando `prontuario_shared_at`. `/perfil` mostra "Profissional experiente" e completude 100%; `/profissional/[id]` mostra os selos.

**Não incluído nesta história:** revisão jurídica real do texto de Termos/Privacidade (placeholder, documentado); catálogo administrável de requisitos por categoria (hoje é uma constante no código, não editável pelo Admin); moderação de avaliações; UI para o profissional reenviar habilitação rejeitada com um novo documento sem precisar trocar de categoria manualmente.

Com isso, a **Onda 1 do plano 100% está concluída** (identidade, papéis, perfis e prontuário). Próxima: Onda 2 (descoberta e contratação negociada).

---

## 2026-09-02 — Onda 1: perfil profissional completo (seção 6.3)

**Entrega:** segunda história da Onda 1 — "Perfil profissional" (seção 6.3 do plano). Antes, a única informação de um profissional visível ao Tutor era o nome e os serviços publicados; não existia bio, foto, experiência, especializações, idiomas ou políticas próprias, nem indicador de completude pro profissional saber o que falta pra converter mais na busca.

- `supabase/migrations/0017_professional_profile_details.sql` (aplicada via MCP): nova tabela `professional_profiles` (1:1 com `profiles`, chave `profile_id`) com `bio`, `experience_years`, `specializations text[]`, `languages text[]`, `policies`, `avatar_url`. RLS: leitura própria, de Admin/Supervisor, ou pública quando o profissional tem serviço ativo (mesma regra de `profiles_select_public_professional`); escrita só do próprio dono. Bucket de storage `avatars` (público) criado junto, com policies escopadas por pasta `{auth.uid()}/...`, mesmo sem upload real ainda implementado na tela.
- `lib/validations/professional-profile.ts` e `lib/actions/professional-profile.ts` (novos): `upsertProfessionalProfile` valida e grava via `upsert` (`onConflict: profile_id`), revalida `/perfil` e `/profissional/[id]`.
- `app/(profissional)/perfil/page.tsx` (novo) + `components/professional/professional-profile-form.tsx` (novo): tela do profissional pra editar o próprio perfil, com indicador de completude (%) calculado sobre 6 sinais (foto, bio, experiência, especializações, idiomas, ao menos 1 serviço ativo — nenhum obrigatório pra publicar) e link "Ver como o Tutor vê".
- `app/(tutor)/profissional/[profissionalId]/page.tsx`: passa a buscar `professional_profiles` e exibir avatar (com fallback de ícone), bio, resumo de experiência/especializações/idiomas e políticas — antes só mostrava nome, serviços e avaliações.
- `lib/supabase/middleware.ts` e `app/(profissional)/dashboard/page.tsx`: `/perfil` adicionada às rotas exclusivas de Profissional; novo atalho "Meu perfil" no painel.
- `types/database.ts`: regenerado via `generate_typescript_types` (MCP) pra incluir `professional_profiles`. Os aliases de conveniência (`AppRole`, `ServiceCategory` etc.) que esse arquivo carregava à mão foram reaplicados no fim do arquivo, agora derivados de `Database["public"]["Enums"][...]` em vez de string literal solta — sobrevive a uma próxima regeneração sem precisar lembrar de re-digitar.

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real (RLS, não bypass): insert e update do próprio perfil funcionam; leitura pública funciona só quando há serviço ativo; tentativa de outro usuário sobrescrever o perfil alheio é bloqueada pela RLS (`new row violates row-level security policy`). Telas `/perfil` (completude 100% com dados de teste) e `/profissional/[id]` (avatar, bio, experiência, políticas) renderizadas e conferidas com sessão de Profissional/Tutor de teste.

**Não incluído nesta história:** upload real de foto (hoje é só campo de URL — o bucket `avatars` já existe pra quando isso for implementado), selos/níveis de qualidade e habilitações/documentos exigidos (seção 6.3 também menciona, ficam pra uma próxima história da Onda 1).

---

## 2026-09-02 — Onda 1: prontuário completo do pet (etapas 2–5)

**Contexto:** recebido `PETLYS_PILAR1_PLANO_100_PERCENT.md`, um plano bem mais amplo que a Especificação v1.2 original (incorpora Petlys Espaços, seguro, backup de emergência, operação regional, Academy — itens que a própria v1.2, seção 11, listava como fora do Pilar 1). Duas ressalvas registradas antes de executar: (1) a seção 5 desse plano ("pendências confirmadas") repete 8 itens que já tinham sido corrigidos na reconciliação de 2026-09-01 — a auditoria dele é anterior a esse merge; (2) seguir esse plano é uma mudança de escopo real (de "marketplace Tutor↔Profissional" pra "ecossistema Petlys inteiro"), confirmada explicitamente pelo usuário antes de começar a Onda 1.

**Entrega:** primeira história da Onda 1 — "Cadastro e prontuário do pet" (seção 6.2 do plano). Antes, `updatePetHealth`/`updatePetBehavior` existiam como Server Actions mas **nenhuma tela as chamava** — `/pets/[petId]` só mostrava um selo estático "Pendente/Preenchido", sem jeito de preencher. Rotina e Emergência não tinham nem action.

- `lib/validations/pets.ts`: adicionados `petRoutineSchema` e `petEmergencySchema` (etapas 4 e 5, campos da seção 4.1 da Especificação v1.2). Enriquecidos `petHealthSchema` (+ restrições, dosagem/horários) e `petBehaviorSchema` (+ agressividade, fuga, uso de guia, comportamento no carro) pra bater com o que a v1.2 já detalhava.
- `lib/actions/pets.ts`: novas `updatePetRoutine` e `updatePetEmergency` (mesmo padrão de `updatePetHealth`). Nenhuma migration necessária — `routine_info` e `emergency_info` já existiam como colunas `jsonb` desde `0002_identity_and_pets.sql`, só não eram usadas.
- `components/pets/pet-profile-section.tsx` (novo): bloco expansível genérico (título + campos + status Preenchido/Pendente) reaproveitado pelas 4 etapas — evita repetir o mesmo formulário 4 vezes.
- `app/(tutor)/pets/[petId]/page.tsx`: as 4 etapas agora renderizam com `PetProfileSection` de verdade, cada uma com seus campos e a action correspondente. Emergência inclui os dois consentimentos explícitos (autorização de transporte e de acesso à residência) como checkbox, não texto livre — são consentimento, não informação.

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real do Tutor (RLS, não bypass) — os 3 updates (`health_info`, `routine_info`, `emergency_info`) gravaram corretamente; `/pets/[petId]` renderizou os 4 selos com o status certo (3 "Preenchido", 1 "Pendente" — bate com os dados de teste).

**Não incluído nesta história** (fica pra depois, dentro da mesma seção 6.2 do plano): foto/documentos/carteira de vacinação como upload real (hoje é só texto livre descrevendo vacinas), exigência dinâmica de campos por categoria de serviço, alerta de dado desatualizado, e o fluxo de convite formal de cotutor (hoje só vincula quem já tem conta, sem convite/aceite).

---

## 2026-09-01 — Reconciliação com a sessão avulsa do Claude Code (equalização pet3108)

**Contexto:** uma sessão separada do Claude Code (rodando em `Dev/plataforma-pet_2/plataforma-pet`, sem acesso à memória desta sessão) executou uma rodada extensa de testes manuais ponta a ponta em todas as visões (Tutor, Profissional, Admin, Supervisor), achou e corrigiu 6 bugs reais, e implementou 2 features inteiras que não existiam. Esse trabalho nunca chegou ao `pet3108` nem ao GitHub — só existia naquela outra sessão. O handoff (`PETLYS_HANDOFF_CLAUDE_CODE_PET3108.md`) recebido do Claude browse redescobriu exatamente os mesmos 6 bugs de forma independente (confirma que o diagnóstico estava certo), mas propunha reconstruir do zero algo que já existia pronto e testado. Em vez de reconstruir, foi feita a reconciliação direta: diff de arquivo por arquivo entre as duas bases, cópia das partes ausentes pro pet3108, preservando os ajustes que só existiam aqui.

**Confirmado antes de mexer:** os dois projetos apontam para o **mesmo projeto Supabase** (`xewgvxzpsdesqkohapbm`). As migrations 0013–0016 abaixo já estavam aplicadas no banco ao vivo desde a sessão original — essa reconciliação só estava faltando nos arquivos versionados, não no banco.

### Bugs corrigidos (replicados via diff real, testados com RLS de verdade na sessão original — não simulação manual)

1. **Perfil de profissional invisível pro Tutor** (`0013_profiles_public_professional_select.sql`) — `profiles_select` só liberava o próprio perfil ou Admin/Supervisor; `/buscar` mostrava "Profissional" genérico e `/profissional/[id]` dava 404 pra qualquer Tutor. Corrigido com policy adicional: perfil legível quando o dono tem `professional_services` ativo.
2. **Ocorrências recorrentes empilhadas na mesma data** (`lib/actions/requests.ts`, `lib/validations/requests.ts`) — todas as ocorrências de um contrato recorrente recebiam `firstOccurrenceAt` idêntico. Adicionado campo de frequência (diária/semanal/quinzenal/mensal) no formulário (`components/requests/new-request-form.tsx`) e cálculo determinístico das datas.
3. **Kanban dessincronizado do status principal** (`lib/actions/occurrences.ts`, `components/kanban/kanban-board.tsx`) — mover um cartão só atualizava `request_occurrences`, nunca `requests.status`; o Tutor nunca via o atendimento avançar. Corrigido: cada ação do Kanban agora sincroniza os dois; ao concluir uma ocorrência intermediária de um contrato recorrente, a solicitação volta pra `confirmado` (libera check-in da próxima); ao concluir a última, avança pra `avaliacao` (`0014_recurring_occurrence_cycle.sql` libera essa transição no banco). Kanban também passou a travar check-in até a solicitação estar `confirmado` (antes deixava check-in em qualquer status).
4. **Suporte não conseguia intervir no chat** (`0015_staff_chat_intervention.sql`, `components/requests/chat-panel.tsx`, `components/admin/incident-queue.tsx`) — Admin/Supervisor só liam mensagens (e só com incidente aberto), nunca podiam responder. Agora enviam mensagem enquanto o incidente está aberto (bloqueado automaticamente após resolvido), aparecendo identificados como "Suporte" pras duas partes. Bônus: corrigido `viewerRole` em `app/(tutor)/solicitacoes/[requestId]/page.tsx`, que classificava incorretamente qualquer staff como "profissional" (mostrava botões de recusar/propor que não faziam sentido pra eles).
5. **Suspensão de conta só cosmética** (`0016_suspension_actually_blocks_access.sql`, `lib/supabase/middleware.ts`, `app/(auth)/conta-suspensa/`) — **bug crítico**: conta suspensa continuava logando normalmente e conseguia se auto-atribuir um papel novo (mesmo um que nunca teve) pela RLS de `account_roles`, voltando a ter acesso total. Corrigido em duas camadas: RLS bloqueia auto-atribuição de papel quando há suspensão aprovada; middleware redireciona qualquer rota pra `/conta-suspensa` antes de qualquer outra checagem (com cuidado extra pra não criar loop de redirecionamento com `/escolher-perfil`).
6. **Exclusão de parâmetro comercial sempre falhava** (`lib/actions/admin.ts`) — `platform_parameters_log` referencia o parâmetro sem `ON DELETE CASCADE`, e como toda criação já gera log, o `DELETE` físico batia em violação de FK sempre. Trocado por soft-delete (`status: 'substituido'`), consistente com o `parameter_lifecycle` que o próprio schema já previa.

### Features novas (não existiam em nenhuma versão anterior)

7. **Papel ativo / isolamento de visões** (`lib/supabase/middleware.ts`, `app/page.tsx`, `lib/actions/auth.ts:setActiveRole`) — conta com Tutor + Profissional agora escolhe explicitamente em `/` qual papel está usando; middleware bloqueia fisicamente rotas do outro papel; nunca troca sozinho. `app/(tutor)/solicitacoes/page.tsx` parou de sempre priorizar a visão de Profissional pra contas duplas (bug que fazia o Tutor nunca ver a própria lista).
8. **Adicionar um segundo papel depois** (`app/(onboarding)/escolher-perfil/page.tsx`, `components/auth/choose-profile-form.tsx`, links em `/inicio` e `/dashboard`) — Tutor vira também Profissional (e vice-versa) sem perder o papel atual. Corrigido no processo: o `chooseProfile` original fazia `upsert` de todos os papéis marcados, inclusive o já existente — como `account_roles` não tem policy de UPDATE pra usuário comum, isso derrubava a RLS e quebrava 100% das tentativas de adicionar um segundo papel. Agora só insere o que falta.
9. **Login e cadastro por e-mail/senha** (`components/auth/email-password-form.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/confirmar-email/`, `app/(auth)/redefinir-senha/`, `lib/actions/auth.ts`, `lib/validations/auth.ts`) — Google/Facebook viram opcionais; Tutor/Profissional cadastram por e-mail+senha; Admin/Supervisor entram pelo mesmo formulário digitando o "usuário" interno (resolvido pro e-mail sintético `@internal.plataformapet` no servidor). Inclui "Esqueci minha senha". Achado no processo: os links de confirmação de e-mail e de redefinição de senha do Supabase entregam o token no **fragmento da URL** (`#access_token=...`), não em `?code=` — a rota `/callback` existente só tratava o fluxo OAuth. `/confirmar-email` e `/redefinir-senha` tratam isso no client. Exige que as duas URLs estejam cadastradas em Authentication → URL Configuration → Redirect URLs no Supabase (feito para localhost; produção pendente de domínio Vercel).

### O que não precisou ser refeito

O handoff supunha que seria necessário reconstruir tudo isso do zero. Como já existia — testado com sessões reais e RLS real, não bypass — o trabalho desta entrada foi puramente mecânico: diff arquivo por arquivo entre as duas bases, cópia do que faltava, preservando dois ajustes de lint que só existiam no pet3108 (`let`→`const` em `app/(tutor)/buscar/page.tsx`; variável `reviewAboutMe` não utilizada removida de `components/requests/review-section.tsx`).

### Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: limpo — achou e corrigiu 3 problemas reais introduzidos pelas páginas novas (`react-hooks/set-state-in-effect` em `/confirmar-email` e `/redefinir-senha`, setState síncrono dentro do corpo do efeito; variável `isParty` declarada e nunca usada em `solicitacoes/[requestId]/page.tsx`). Correções replicadas de volta pro `plataforma-pet_2/plataforma-pet` também.
- `next build`: passa, 30 rotas geradas — inclui as 4 rotas novas de autenticação por senha (`/confirmar-email`, `/conta-suspensa`, `/dev-login`, `/redefinir-senha`).
- Alterações feitas na branch `sync-pilar1-fixes` (não mergeada em `main` nem enviada ao GitHub ainda — aguardando confirmação do usuário).

---

## 2026-08-31 — Recuperação de artefatos perdidos + primeira auditoria real do Supabase

**Contexto:** duas sessões anteriores geraram artefatos (a Especificação v1.2 completa em `.docx`, e o código-fonte da Fase 3 em `.zip`) que existiram apenas como upload/download dentro daquelas conversas e não foram salvos de forma persistente. Ambos foram dados como perdidos no início desta sessão, e depois localizados pelo usuário em backups locais.

### Especificação v1.2
- Arquivo `Especificacao_Pilar_1_Jornadas_v1_2_backup_2026-08-22.docx` localizado e validado linha a linha contra o resumo que existia (`Especificacao-v1.2-notas-de-atualizacao.md`) e contra a Fase 2 (Arquitetura). Nenhuma divergência encontrada — o resumo estava correto, só incompleto.
- Preencheu lacunas que o resumo não cobria: jornada completa do Supervisor (seção 10.2), regras financeiras exatas de cancelamento pelo profissional e não comparecimento (seções 6.3/6.4), regra de privacidade de contato (seção 2.4).
- **Ação recomendada:** anexar este `.docx` ao Project do Claude.ai como fonte oficial da v1.2, mantendo a v1.1 intacta (regra de versionamento do projeto).

### Código da Fase 3
- Arquivo `plataforma-pet.zip` localizado — snapshot de 21/08/2026, um passo **antes** da rodada final de correções descrita em `Fase3-Status-Pilar1.md` (22/08/2026).
- Validado tecnicamente neste ambiente: `npm install` → 391 pacotes ok; `next build` → build de produção passa, 24 rotas geradas; `eslint` → 2 problemas encontrados, batendo exatamente com os já catalogados.
- Correções aplicadas (as mesmas que já estavam documentadas como pendentes):
  - `components/requests/review-section.tsx`: removida variável `reviewAboutMe` não utilizada.
  - `app/(tutor)/buscar/page.tsx`: `let` → `const` em variáveis nunca reatribuídas (auto-fix do eslint).
  - `README.md`: contagem de migrações corrigida de "9" para "12"; seção "Próximos passos" corrigida para não listar como pendente o que já está implementado (Kanban, agenda, painel admin) — só ficou o que de fato falta (módulo financeiro, testes, CI/CD).
- **Confirmado:** nenhum teste automatizado existe neste código (nem unitário, nem E2E) — isso resolve, por eliminação, a contradição entre `Fase3-Status-Pilar1.md` e `Fase4-QA-Pilar1.md` sobre a existência de 85 testes Vitest + 2 specs Playwright. Eles não existem no código recuperado.
- Repositório Git inicializado localmente e enviado para `https://github.com/Jegsa77-maker/Petlys` (primeiro push bem-sucedido, 158 objetos).

### Auditoria do Supabase (projeto "Petlys", `xewgvxzpsdesqkohapbm`, região `sa-east-1`)
- **O banco já estava totalmente criado e com dados de teste** — não foi necessário rodar as 12 migrações manualmente como planejado.
- **28 tabelas no schema `public`**, todas com RLS habilitado (0 exceções). Isso é 6 tabelas a mais do que o `Fase2-Arquitetura-Pilar1.md` documenta (22): `contact_unlocks`, `account_suspensions`, `admin_audit_log`, `request_status_transitions_allowed`, `request_status_history`, `professional_service_areas`. Pelos comentários salvos nas próprias tabelas, essas parecem ser as correções de segurança já mencionadas em registros anteriores do projeto (bypass de auto-verificação, bloqueio de saque por incidente, transições de status via trigger) — aplicadas ao banco, mas nunca formalizadas de volta no documento de arquitetura.
- **Achados de segurança reais** (via `Supabase:get_advisors`, não simulação manual):
  1. **Alto interesse:** múltiplas funções `SECURITY DEFINER` (`apply_account_suspension`, `apply_incident_payout_block`, `enforce_and_log_status_transition`, `prevent_self_verification`, `log_platform_parameter_change`, entre outras) estão expostas como endpoints RPC públicos, chamáveis diretamente por `anon`/`authenticated` via API REST — deveriam rodar só internamente via trigger.
  2. **Baixo risco:** funções `distance_km` e `set_updated_at` sem `search_path` fixo.
  3. **Configuração:** proteção contra senha vazada (HaveIBeenPwned) desligada no Supabase Auth.
- **Status:** achados reportados ao usuário, correção **ainda não aplicada** — decisão pendente sobre corrigir antes ou depois do deploy na Vercel.

### Decisão de processo
- Identificado que depender de memória de conversa do Claude para rastrear decisões de engenharia é estruturalmente não confiável (memória é gerada por resumo periódico, tem viés de recência, é isolada por Project, e não é desenhada para esse propósito). Este `CHANGELOG.md` passa a ser a fonte de verdade versionada — toda sessão relevante deve adicionar uma entrada aqui.

---

## Pendências abertas ao final desta entrada

- [ ] Corrigir os achados de segurança do Supabase (funções `SECURITY DEFINER` expostas como RPC público).
- [ ] Fixar `search_path` em `distance_km` e `set_updated_at`, e revisar as demais funções `SECURITY DEFINER`.
- [ ] Garantir por RLS (não só por Server Action) que Supervisor não encerre incidente sozinho — hoje a policy `incidents_update` permite tanto Admin quanto Supervisor.
- [ ] Ativar proteção contra senha vazada no Supabase Auth.
- [ ] Reagendamento de ocorrências pelo Tutor, escolhendo horário livre do Profissional (hoje a data só é definida na criação da solicitação).
- [ ] Escrever testes automatizados reais (unitário/integração/E2E) — não existem no projeto.
- [ ] Configurar Redirect URLs de produção no Supabase quando o domínio Vercel existir.
- [ ] Módulo financeiro / Pagar.me — aguardando decisões comerciais (percentuais, condições) listadas na seção 13.3 da Especificação v1.2.
- [ ] Decidir se a rota `/dev-login` (bypass de autenticação só pra teste local, sem efeito em produção via checagem de `NODE_ENV`) deve ser removida antes do deploy ou mantida — revisar antes de ir pra produção.
- [ ] Revisar e mergear a branch `sync-pilar1-fixes` em `main`, e enviar ao GitHub.
