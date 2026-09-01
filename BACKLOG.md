# Backlog — itens adiados conscientemente

Este arquivo lista funcionalidades que foram **deliberadamente adiadas** durante a implementação de uma história — coisas que apareceram no escopo, foram avaliadas e ficaram de fora por decisão explícita, não por esquecimento. Não é o roadmap completo (isso é a seção 12 da `Especificacao_Pilar_1_Jornadas_v2.docx`) nem as decisões de negócio pendentes (seção 14 do mesmo documento) — é a lista de "isso ficou pra depois" que normalmente ficaria perdida em rodapés de entradas antigas do `CHANGELOG.md`.

Cada item deve dizer: de onde veio, por que ficou de fora, e o tamanho aproximado do esforço quando isso for retomado. Ao puxar um item da lista pra trabalhar, mova-o pra cá como "concluído" com a data, ou simplesmente apague a linha e registre a entrega no `CHANGELOG.md` normalmente.

---

## Onda 2 — Descoberta e contratação negociada

- **Chat com mídia (fotos, vídeos, documentos)** — item 3 da Onda 2 (seção 12.1 da Especificação v2.0). Hoje o chat da solicitação (`components/requests/chat-panel.tsx`, `messages` table) só aceita texto. Adiado em 2026-09-01 a pedido do usuário ("não é necessário agora"), sem crítica técnica — só não é prioridade no momento. Esforço estimado: bucket de storage próprio (padrão já estabelecido em `pet-documents`/`pet-photos`), RLS espelhando `messages_select`/`messages_insert`, componente de upload reaproveitando `FileUploadField`, e ajuste de `chat-panel.tsx` pra renderizar anexos por tipo (imagem inline, vídeo, link de documento).

- **Mapa visual na busca** — parte do item 2 da Onda 2 (busca avançada), que já entregou os filtros de preço/nota/subcategoria/espécie e favoritos (ver CHANGELOG 2026-09-01). Adiado por trazer uma dependência nova (Leaflet + tiles OpenStreetMap, sem custo de API key, mas é uma peça técnica própria com bundle size e componente client-only). Esforço estimado: `npm install leaflet react-leaflet`, componente de mapa com pins usando `professional_service_areas.center_lat/center_lng` (já existe), toggle lista/mapa em `/buscar`.

- **Tela dedicada `/favoritos`** — hoje favoritos só existem como filtro (`?favoritos=1`) dentro de `/buscar`, não como uma listagem própria. Baixo esforço quando for retomado — é basicamente `/buscar?favoritos=1` com um título diferente e sem os outros filtros.

## Onda 0 — Reconciliar e proteger a base

- **Achados de segurança do Supabase** — funções `SECURITY DEFINER` expostas como RPC público (`apply_account_suspension`, `enforce_and_log_status_transition`, etc.), `search_path` não fixo em `distance_km`/`set_updated_at`, proteção contra senha vazada desligada no Auth. Identificados em 2026-08-31, nunca corrigidos — aparecem em todo `get_advisors` desde então sem regressão nova. Esforço estimado: revisar cada função uma a uma (a maioria deveria ser `SECURITY INVOKER` ou só chamável via trigger, não via API REST), mais um `alter function ... set search_path = public` nas duas funções auxiliares.

- **Testes automatizados + CI/CD** — não existe nenhum teste unitário, de integração ou E2E no projeto, nem pipeline de CI. Esforço estimado: é o maior item desta lista — precisa de decisão de ferramenta (Vitest + Playwright é o par mais comum no ecossistema Next.js) antes de começar.

---

*Última atualização: 2026-09-01.*
