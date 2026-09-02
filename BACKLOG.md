# Backlog — itens adiados conscientemente

Este arquivo lista funcionalidades que foram **deliberadamente adiadas** durante a implementação de uma história — coisas que apareceram no escopo, foram avaliadas e ficaram de fora por decisão explícita, não por esquecimento. Não é o roadmap completo (isso é a seção 12 da `Especificacao_Pilar_1_Jornadas_v2.docx`) nem as decisões de negócio pendentes (seção 14 do mesmo documento) — é a lista de "isso ficou pra depois" que normalmente ficaria perdida em rodapés de entradas antigas do `CHANGELOG.md`.

Cada item deve dizer: de onde veio, por que ficou de fora, e o tamanho aproximado do esforço quando isso for retomado. Ao puxar um item da lista pra trabalhar, mova-o pra cá como "concluído" com a data, ou simplesmente apague a linha e registre a entrega no `CHANGELOG.md` normalmente.

---

**Nota de escopo (2026-09-02):** a Onda 5 (retenção do Profissional, incluindo CRM) e os itens ainda pendentes da Onda 6 (Petlys Espaços, Operação regional, Seguro/garantia, Backup de emergência) saíram do escopo desta plataforma por decisão do usuário — não são mais "adiados dentro do projeto em andamento", viraram **funcionalidades futuras** (fora do que falta pra fechar o Pilar 1). Ver `IDEIAS_FUTURAS.md` e a entrada do `CHANGELOG.md` do dia pra o detalhe completo, incluindo por que o CRM saiu por completo (tratado como iniciativa separada, nem chega a ser "ideia futura desta plataforma"). Com isso, o que falta pra fechar o Pilar 1 é só a **Onda 3** (financeiro real).

## Onda 1 — Identidade, papéis, perfis e prontuário

- **Revisão jurídica de Termos/Privacidade** — o texto de `lib/domain/terms.ts` é um placeholder funcional (aceite versionado já funciona tecnicamente), nunca revisado por advogado. Usuário confirmou em 2026-09-01 que vai olhar isso pessoalmente depois ("vejo depois"), sem crítica técnica. Esforço: zero de desenvolvimento — só troca de texto + bump de `CURRENT_TERMS_VERSION` quando o texto revisado chegar.

## Onda 0 — Reconciliar e proteger a base

- **Achados de segurança do Supabase — maior parte corrigida em 2026-09-02** (`0038`/`0039_fix_security_hardening_grants.sql`): `search_path` fixado em `distance_km`/`set_updated_at`; EXECUTE revogado de `anon`/`authenticated` nas 11 funções-gatilho (nunca precisaram de grant, só o Postgres não sabia disso); `notify(uuid,text,jsonb)` — achado real, não só teórico: permitia inserir notificação falsa pra qualquer perfil sem checar remetente, corrigido revogando o EXECUTE direto; 9 RPCs de auto-serviço (`appeal_incident`, `flag_message`, etc.) tiveram o acesso de `anon` fechado, mantendo só `authenticated` (a intenção original de cada migration — um grant padrão que o Supabase aplica em toda função nova do schema `public` estava sobrepondo isso, concedendo EXECUTE direto pra `anon` e `authenticated` independente do `grant ... to authenticated` explícito já existente). Tudo testado com sessões reais pós-migration: mensagem ainda dispara notificação (trigger interno intacto), exploit direto de `notify` bloqueado (`permission denied`), RPCs de auto-serviço bloqueiam anon e continuam funcionando pra quem está logado.
  **Ainda em aberto, risco aceito conscientemente:** `has_role`, `is_admin_or_supervisor`, `is_party_of_request`, `is_tutor_of_pet`, `contact_is_unlocked` continuam expostas ao `anon` — são predicados booleanos usados dentro de dezenas de policies RLS, incluindo policies de leitura pública (ex. `professional_services_select_public`); revogar do `anon` quebraria consultas públicas via REST API direta sempre que a avaliação da policy precisasse desses predicados (erro fatal pra query inteira, não só pulando linha). Não vazam dado de terceiro (são sobre o próprio `auth.uid()` do chamador). Corrigir de verdade exigiria mover essas funções pra um schema não exposto pelo PostgREST e reescrever todas as policies que as referenciam — risco/esforço maior que o benefício por ora.
  **Também ainda em aberto:** proteção contra senha vazada (HaveIBeenPwned) desligada no Auth. Não é migration nem código — é um toggle em Authentication > Sign In / Providers > Email > "Prevent use of leaked passwords". Verificado em 2026-09-02: **só está disponível a partir do plano Supabase Pro** (hoje o projeto está em plano que não libera essa opção). Decisão de negócio (vale pagar Pro por isso e/ou pelo resto que o Pro libera junto), não técnica.

- **Migrar CI pra um projeto Supabase dedicado** — hoje os testes de RLS/E2E do CI batem no mesmo projeto remoto de desenvolvimento (funciona, confirmado rodando verde no GitHub Actions em 2026-09-02 — 55/55 testes, run `#3`, commit `1ba407d`), mas todo push vira tráfego real contra esse banco. Não é urgente — nenhuma outra parte do projeto tem separação de ambiente hoje. Vira relevante se o volume de push crescer bastante. Ver `.github/workflows/ci.yml` e `CHANGELOG.md` pro histórico completo da iniciativa de testes automatizados (concluída: 55 testes — Vitest unidade+RLS e Playwright E2E — rodando local e em CI a cada push).

---

*Última atualização: 2026-09-02.*

