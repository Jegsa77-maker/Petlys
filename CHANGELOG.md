# Changelog — Plataforma Pet (Pilar 1)

Este arquivo é a fonte de verdade sobre decisões, achados e ajustes do projeto — **não a memória de conversas do Claude**. Toda sessão de trabalho relevante deve adicionar uma entrada aqui, commitada junto com o código a que se refere. Ordem cronológica reversa (mais recente no topo).

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
