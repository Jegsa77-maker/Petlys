# Backlog — itens adiados conscientemente

Este arquivo lista funcionalidades que foram **deliberadamente adiadas** durante a implementação de uma história — coisas que apareceram no escopo, foram avaliadas e ficaram de fora por decisão explícita, não por esquecimento. Não é o roadmap completo (isso é a seção 12 da `Especificacao_Pilar_1_Jornadas_v2.docx`) nem as decisões de negócio pendentes (seção 14 do mesmo documento) — é a lista de "isso ficou pra depois" que normalmente ficaria perdida em rodapés de entradas antigas do `CHANGELOG.md`.

Cada item deve dizer: de onde veio, por que ficou de fora, e o tamanho aproximado do esforço quando isso for retomado. Ao puxar um item da lista pra trabalhar, mova-o pra cá como "concluído" com a data, ou simplesmente apague a linha e registre a entrega no `CHANGELOG.md` normalmente.

---

## Onda 1 — Identidade, papéis, perfis e prontuário

- **Revisão jurídica de Termos/Privacidade** — o texto de `lib/domain/terms.ts` é um placeholder funcional (aceite versionado já funciona tecnicamente), nunca revisado por advogado. Usuário confirmou em 2026-09-01 que vai olhar isso pessoalmente depois ("vejo depois"), sem crítica técnica. Esforço: zero de desenvolvimento — só troca de texto + bump de `CURRENT_TERMS_VERSION` quando o texto revisado chegar.

## Onda 2 — Descoberta e contratação negociada

- **Mapa visual na busca** — parte do item 2 da Onda 2 (busca avançada), que já entregou os filtros de preço/nota/subcategoria/espécie e favoritos (ver CHANGELOG 2026-09-01). Adiado por trazer uma dependência nova (Leaflet + tiles OpenStreetMap, sem custo de API key, mas é uma peça técnica própria com bundle size e componente client-only). Esforço estimado: `npm install leaflet react-leaflet`, componente de mapa com pins usando `professional_service_areas.center_lat/center_lng` (já existe), toggle lista/mapa em `/buscar`.

- **Chat com mídia (fotos, vídeos, documentos)** — item 3 da Onda 2 (seção 12.1 da Especificação v2.0). Hoje o chat da solicitação (`components/requests/chat-panel.tsx`, `messages` table) só aceita texto. Adiado em 2026-09-01 a pedido do usuário ("não é necessário agora"), sem crítica técnica — só não é prioridade no momento. Esforço estimado: bucket de storage próprio (padrão já estabelecido em `pet-documents`/`pet-photos`), RLS espelhando `messages_select`/`messages_insert`, componente de upload reaproveitando `FileUploadField`, e ajuste de `chat-panel.tsx` pra renderizar anexos por tipo (imagem inline, vídeo, link de documento).

## Onda 5 — Retenção e ferramentas do Profissional

Da lista original da onda (seção 12.4 da Especificação v2.0 / seção 8 do `PETLYS_PILAR1_PLANO_100_PERCENT.md`), o usuário decidiu em 2026-09-01 manter só o CRM/ferramentas do dia a dia (clientes e pets próprios, agendamento manual, link/cartão digital/QR code, indicadores de conversão/recorrência/receita) como escopo ativo da onda agora. Os demais grupos ficam adiados:

- **Petlys Academy (trilhas e certificações) + Clube de benefícios + Programa Profissional Fundador + Comissão diferenciada por plano/nível** — grupo "carreira e engajamento". Adiado em 2026-09-01. Comissão diferenciada em particular depende de dado financeiro real (Onda 3, já adiada pro final do roadmap) pra fazer sentido — não dá pra calcular "diferenciada" sem primeiro ter a comissão padrão rodando de verdade. Academy e Clube de benefícios também dependem de decisão de conteúdo/parceria comercial antes de virarem esforço de desenvolvimento. Esforço estimado: grande — Academy precisa de modelo de conteúdo (trilhas, progresso, emissão de certificado) além do que já existe (cálculo automático de nível de carreira, seção 5); Clube de benefícios depende de parceiros externos fechados; Fundador é sobretudo critério de elegibilidade + selo, esforço pequeno isolado mas só faz sentido junto dos outros três.

- **Rede de indicação + duplas/grupos de cobertura para férias e emergências** — grupo "comunidade e resiliência". Adiado em 2026-09-01. Rede de indicação precisa de decisão de recompensa (crédito? desconto de comissão? depende de novo da Onda 3). Cobertura entre profissionais precisa de decisão operacional prévia: quem responde pelo atendimento em caso de incidente durante a cobertura, como fica o split financeiro entre o profissional titular e o substituto — não é só tela, é modelo de negócio a decidir antes (ver seção 14 da Especificação). Esforço estimado: médio-alto, mas bloqueado por decisão de produto antes de codar.

- **Suporte a múltiplos usuários por perfil de estabelecimento + serviços especializados/novas fontes de renda** — grupo "estrutural". Adiado em 2026-09-01. Múltiplos usuários por perfil exige mudança no modelo de conta hoje 1 perfil = 1 usuário (`profiles`/`account_roles`), com decisão de permissões internas (quem pode ver financeiro, quem pode responder chat, etc.) — mudança estrutural, não incremental. "Serviços especializados/novas fontes de renda" ainda nem tem definição funcional (o que seria um serviço especializado concretamente) — precisa virar história antes de virar estimativa de esforço.

## Onda 0 — Reconciliar e proteger a base

- **Achados de segurança do Supabase** — funções `SECURITY DEFINER` expostas como RPC público (`apply_account_suspension`, `enforce_and_log_status_transition`, etc.), `search_path` não fixo em `distance_km`/`set_updated_at`, proteção contra senha vazada desligada no Auth. Identificados em 2026-08-31, nunca corrigidos — aparecem em todo `get_advisors` desde então sem regressão nova. Esforço estimado: revisar cada função uma a uma (a maioria deveria ser `SECURITY INVOKER` ou só chamável via trigger, não via API REST), mais um `alter function ... set search_path = public` nas duas funções auxiliares.

- **Testes automatizados + CI/CD** — não existe nenhum teste unitário, de integração ou E2E no projeto, nem pipeline de CI. Esforço estimado: é o maior item desta lista — precisa de decisão de ferramenta (Vitest + Playwright é o par mais comum no ecossistema Next.js) antes de começar.

---

*Última atualização: 2026-09-01.*

