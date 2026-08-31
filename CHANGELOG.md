# Changelog — Plataforma Pet (Pilar 1)

Este arquivo é a fonte de verdade sobre decisões, achados e ajustes do projeto — **não a memória de conversas do Claude**. Toda sessão de trabalho relevante deve adicionar uma entrada aqui, commitada junto com o código a que se refere. Ordem cronológica reversa (mais recente no topo).

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

- [ ] Corrigir os achados de segurança do Supabase (funções `SECURITY DEFINER` expostas).
- [ ] Ativar proteção contra senha vazada no Supabase Auth.
- [ ] Anexar `Especificacao_Pilar_1_Jornadas_v1_2_backup_2026-08-22.docx` ao Project do Claude.ai.
- [ ] Conectar o repositório à Vercel.
- [ ] Escrever testes automatizados reais (Fase 4).
- [ ] Módulo financeiro / Pagar.me — aguardando decisões comerciais (percentuais, condições) listadas na seção 13.3 da Especificação v1.2.
