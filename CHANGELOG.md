# Changelog — Plataforma Pet (Pilar 1)

Este arquivo é a fonte de verdade sobre decisões, achados e ajustes do projeto — **não a memória de conversas do Claude**. Toda sessão de trabalho relevante deve adicionar uma entrada aqui, commitada junto com o código a que se refere. Ordem cronológica reversa (mais recente no topo).

---

## 2026-09-04 — Tela de Usuários: CRUD completo (Admin) + ver/bloquear/chat (Supervisor)

**Contexto:** usuário pediu uma tela no Admin com CRUD de qualquer conta, qualquer papel — inclusive outro Administrador —, com uma regra específica pra exclusão: apagar o relacionamento todo, a não ser que haja pendência financeira. No meio da implementação, pediu também que o Supervisor tivesse uma versão mais enxuta (ver, bloquear/desbloquear, redefinir senha, ver perfil) e que os dois papéis pudessem conversar com o usuário via chat a partir do perfil.

**Decisão de design mais importante — "excluir" nunca é `DELETE` físico.** `profiles.id` é referenciado por 40+ tabelas, muitas compartilhadas com OUTRA pessoa (uma avaliação que um Tutor escreveu sobre o Profissional, o histórico de mensagens de uma conversa). Perguntado diretamente, o usuário escolheu **anonimizar o lado da conta excluída, mantendo o resto**: nome/e-mail/telefone/CPF somem (vira "Usuário removido"), acesso é bloqueado pra sempre, mas solicitações/mensagens/avaliações continuam existindo normalmente — só sem os dados pessoais de quem saiu. Reaproveita o mecanismo de suspensão já existente (0011) como o bloqueio permanente, em vez de inventar um novo.

- **Excluir bloqueado por pendência financeira**: qualquer pagamento não resolvido (`pendente`/`processando`/`contestado`) numa solicitação onde a conta é tutor ou profissional, ou qualquer repasse ainda não `pago` — dinheiro em trânsito não vira órfão.
- **Criar conta de qualquer papel** (`createUserByAdmin`): generaliza o mecanismo que já existia só pra Supervisor (usuário+senha interno, sem e-mail real, sem OTP) pra também aceitar Tutor/Profissional/Administrador.
- **Papéis**: ativar/desativar/conceder qualquer papel pra qualquer conta — com trava contra desativar/excluir o **último Administrador ativo do sistema** e contra mexer na própria conta (autoexclusão/autobloqueio).
- **Bloquear/desbloquear conta** (`blockAccount`/`unblockAccount`, `lib/actions/supervisor.ts`, compartilhado entre Admin e Supervisor): direto, sem depender do fluxo de recomendação em duas etapas que já existia (que continua existindo como via alternativa). `unblockAccount` precisou de um valor novo no enum `suspension_status` (`revogada`, migration 0074) — o mecanismo de suspensão nunca teve um jeito de desfazer.
- **Chat com o usuário a partir do perfil** (migration 0075, `staff_conversation_messages`): o chat que já existia (`messages`) sempre pertence a uma solicitação (`request_id not null`) — não dava pra reaproveitar pra "falar com qualquer usuário", que não tem solicitação nenhuma por trás. Tabela nova, uma conversa por usuário-alvo, visível a todo o staff (não é DM privado). Desenhada bidirecional (o próprio usuário-alvo pode responder), mas a UI desta entrega é só do lado do staff.
- **Supervisor**: mesma tela de detalhe (`UserDetailPanel`, com prop `variant`), só que sem edição de perfil, sem gestão de papéis e sem exclusão — só visualização, bloqueio direto, redefinir senha e chat.

**Verificação:** testado ao vivo de ponta a ponta — criei uma conta Administrador de teste, ativei/desativei papéis, gerei senha nova, bloqueei e desbloqueei (confirmado no banco: papéis desativados/reativados, status da suspensão `aprovada`→`revogada`), excluí a conta (confirmado: PII zerada, papéis desativados, log de auditoria completo), e testei o bloqueio por pendência financeira criando um pagamento `pendente` de propósito (bloqueou corretamente, mensagem exata na tela) — fixture removida depois. Chat testado enviando mensagem como Admin e confirmando que o Supervisor enxerga a mesma conversa. `tsc`/`eslint`/`next build`/testes limpos (só a falha conhecida de rate-limit do Supabase Auth em 3 arquivos de RLS, esperada depois de tanto login/logout manual).

---

## 2026-09-04 — Limites da galeria do pet viram parâmetro do Admin

**Contexto:** os limites de foto/vídeo/quantidade da galeria (item 3, entrega anterior) estavam fixos no código (10MB/50MB/20 itens). Usuário pediu pra poder ajustar sem depender de deploy, e já de cara reduziu os valores: foto 1MB, vídeo 5MB, 10 itens.

**Implementação**, mesmo padrão já usado pra comissão/taxa de serviço (`platform_parameters`, sem RPC — a policy de select já é aberta pra qualquer client):
- 3 parâmetros novos, cadastrados pela tela real do Admin (não SQL direto): `galeria_pet_foto_max_mb` (1), `galeria_pet_video_max_mb` (5), `galeria_pet_max_itens` (10).
- `lib/actions/pet-media.ts`: `getGalleryLimits()` (nova) lê os 3 parâmetros com fallback pros valores default caso ainda não estejam cadastrados; `addPetMedia` passou a reconferir o tamanho do arquivo **depois** do upload (consultando o próprio Storage), porque a checagem no client é só UX — sem isso, dava pra contornar o limite chamando o Storage direto.
- `lib/domain/pet-media-limits.ts`: `validateMediaFile` deixou de usar constantes fixas, agora recebe os limites como parâmetro (continua isomórfico, sem I/O).
- Bucket `pet-gallery` mantido em 50MB de teto no Storage (é o máximo que o Supabase Free aceita por arquivo) — funciona como rede de segurança de infra, independente do valor configurado no parâmetro.

**Verificação:** testado ao vivo criando os 3 parâmetros pela tela do Admin e confirmando, via inspeção do DOM renderizado, que a galeria do pet já mostra "Foto até 1MB, vídeo até 5MB" e "0/10" — sem precisar de novo deploy. `tsc`/`eslint`/`next build`/testes limpos (8/8 no arquivo de limites, incluindo um caso novo provando que limites customizados são respeitados).

---

## 2026-09-04 — Corrige vazamento de dado sensível no perfil público do profissional

**Contexto:** achado sentado numa worktree de uma sessão anterior, nunca commitado nem aplicado no banco — reconciliei e concluí nesta sessão. `profiles_select_public_professional` (0013) é uma policy de RLS só de **linha**: quando um profissional tem `professional_services` ativo, ela libera a leitura da linha `profiles` **inteira** via PostgREST, sem filtro de coluna. `/buscar`, `/profissional/[id]` e `/favoritos` só liam `id, full_name` no código, mas a policy nunca restringiu a consulta a essas colunas — qualquer requisição com a chave anon podia pedir `phone, cpf_cnpj, birth_date, address_zip, address_lat, address_lng` do mesmo jeito. Ficou pior depois que `/meu-perfil` passou a gravar endereço residencial real do Tutor: numa conta dupla (tutor + profissional no mesmo perfil), esse endereço ficava exposto a qualquer visitante do perfil público.

**Correção:** mesmo padrão já usado em `get_pet_co_tutor_names` (0037) e `get_request_other_party_name` (0056) — função `SECURITY DEFINER` estreita (`get_public_professional_names`) que só devolve `id, full_name` pra quem tem serviço ativo, nunca a linha inteira. A policy antiga foi removida.

- `supabase/migrations/0073_narrow_public_professional_profile_read.sql`
- `app/(tutor)/buscar/page.tsx`, `app/(tutor)/favoritos/page.tsx`, `app/(tutor)/profissional/[profissionalId]/page.tsx`, `app/(shared)/solicitacoes/[requestId]/page.tsx`: trocam leitura direta de `profiles` (ou embed `profiles(...)`) pelo RPC.
- `tests/rls/public-professional-profile.test.ts` (novo, 6 casos): prova que dado sensível não vaza mais (nem pra outra conta, nem pra anon), que o RPC continua funcionando pra descoberta pública, e que o próprio dono do perfil não foi afetado.

**Verificação:** aplicado direto no banco de produção via MCP (não só planejado) — confirmado com uma leitura anônima real pós-fix: `profiles` direto devolve `null`, RPC devolve só `{id, full_name}`. `tsc`/`eslint`/`next build` limpos, teste novo passando (6/6) isoladamente.

---

## 2026-09-04 — Galeria de fotos e vídeos no fim do perfil do pet (item 3 da lista de ajustes)

**Contexto:** item 3 de uma lista de 8 ajustes/bugs que o usuário reportou navegando o app já em produção ("permitir colocar mais fotos extras e vídeos pequenos/permitir clicar e ver foto ou vídeo rodando"). Diferente da foto de perfil única (`pets.photo_url`), esse é uma lista aberta — precisava de tabela própria, não uma coluna.

**Implementação:** área aberta (mesmo espírito de `pet-photos`: não é dado sensível como a carteira de vacinação) pra anexar várias fotos e vídeos curtos do pet, com grade de miniaturas, lightbox pra ver em tamanho real e dar play no vídeo, e exclusão (referência + arquivo físico, sem deixar órfão — diferente da carteira de vacinação, que só remove a referência).

- `supabase/migrations/0072_pet_media_gallery.sql`: tabela `pet_media` (nova) + bucket `pet-gallery` (público, MIME e tamanho restritos no próprio Storage como rede de segurança — 50MB, o maior dos dois casos).
- Limites aplicados no client antes do upload (padrão comum de apps de foto/vídeo curto): foto até 10MB, vídeo até 50MB, teto de 20 itens por pet.
- RLS: leitura aberta (`using (true)`), escrita só pro(s) tutor(es) do pet.
- `components/pets/pet-gallery-section.tsx` (novo), `lib/actions/pet-media.ts` (novo), `lib/domain/pet-media-limits.ts` (novo, com testes).

**Verificação:** testado ao vivo com um vídeo real (arquivo de sistema do Windows, não fabricado) — confirmado que o vídeo carrega com duração real, `play()` funciona, e remover apaga tanto a linha do banco quanto o arquivo físico no Storage (verificado direto via `list()` pós-remoção). `tsc`/`eslint`/`next build`/testes limpos.

---

## 2026-09-04 — Busca: deduplica profissional por categoria e ordena por proximidade (itens 7-8)

**Contexto:** itens 7 e 8 da mesma lista de ajustes — "na busca perto de mim, buscar a princípio os mais próximos profissionais conforme configuração do radar" e "na busca o profissional vem múltiplas vezes por categoria... acho que possa mandar o a partir do valor mais baixo cadastrado".

**Correção**, tudo em `app/(tutor)/buscar/page.tsx`, em JS puro no server component (sem RPC novo — `distance_km`/`haversineKm` e a tabela de área de atendimento já existiam):
- Um card por profissional+categoria (não por serviço) — fica o de menor preço, que é o que a etiqueta "a partir de" já promete.
- Quando o Tutor compartilha localização, os resultados vêm ordenados do mais próximo pro mais distante (antes a ordem era a que o Postgres decidisse devolver, sem garantia nenhuma).

**Verificação:** testado ao vivo criando um serviço duplicado de propósito (mesma categoria, preços diferentes) — confirmado que só o de menor preço aparece; testado com coordenadas reais de dois profissionais — confirmado que a ordem inverte corretamente conforme a distância. Fixture de teste removida depois.

---

## 2026-09-04 — Correções de UX/bugs encontrados navegando o app (lista do usuário, itens 1-2 e 4-6)

**Contexto:** usuário navegou o ambiente já em produção (Vercel) e reportou 8 itens de uma vez. Esta entrada cobre os itens 1, 2, 4, 5 e 6 (os itens 3, 7 e 8 têm entradas próprias, por serem maiores).

- **Item 1** — botão de mostrar/ocultar senha (login, criar conta, criação de Supervisor): `components/shared/password-input.tsx` (novo).
- **Item 2** — fichas do pet (saúde/comportamento/rotina/emergência) marcavam "Preenchido" mesmo com o formulário vazio: os schemas (zod) tratam todo campo como opcional, então salvar em branco gravava um objeto cheio de `""`, que a checagem de "seção preenchida" antiga (`Object.keys(...).length > 0`) lia como conteúdo real. Corrigido em duas pontas: `lib/domain/category-requirements.ts` (`isSectionFilled` agora exige string não-vazia ou `true`) e `lib/actions/pets.ts` (`stripEmptyStrings` antes de gravar).
- **Item 4** — login não pulava a tela de escolha de perfil pra conta de papel único: a correção inicial chamava `setActiveRole` (uma Server Action) direto no render de `app/page.tsx`, o que quebrou em produção com "Cookies can only be modified in a Server Action or Route Handler" — corrigido descobrindo que nem precisava do cookie: `resolveActiveRole` (middleware) já resolve sozinho quando a conta só tem um papel.
- **Item 5** — Notificações/Sair colados no rodapé da sidebar em telas altas: era o `flex-1` na `<nav>` empurrando o resto pro fundo do viewport, independente de quantos itens de menu existiam.
- **Item 6** — carteira de vacinação: dava pra anexar mas não pra visualizar nem excluir, e aceitava qualquer tipo de arquivo (o `accept` do `<input type="file">` é só um filtro de picker do navegador, fácil de contornar). `supabase/migrations/0071_pet_documents_mime_restriction.sql` restringe o bucket a PDF/imagem de verdade (aplicado pelo Storage, não pelo client); `removePetDocument` (nova action) + botões de visualizar (URL assinada, bucket privado) e remover em `components/pets/pet-media-section.tsx`.

**Também nesta entrega**, revisados individualmente e trazidos junto — não gerados por mim, mas por um agente de teste E2E rodando em segundo plano na mesma sessão (ver seção própria de metodologia se precisar do porquê disso ser seguro):
- RLS "ovo e galinha" que impedia **qualquer** tutor de cadastrar pet (bug crítico — bloqueava toda a jornada).
- Resincronização de estado dos filtros de busca quando a URL muda sem desmontar o componente.
- Move de `app/(tutor)/solicitacoes` para `app/(shared)/solicitacoes` (conflito de rotas paralelas — a tela é usada tanto por tutor quanto por profissional, e viver sob o layout `(tutor)` fazia o Profissional ver o menu lateral errado).

**Verificação:** cada item testado ao vivo no navegador (incluindo criar/resetar contas de teste dedicadas, single-role e dual-role, pra confirmar que a tela de escolha de perfil não regrediu pra quem tem os dois papéis). `tsc`/`eslint`/`next build` limpos; suíte de testes com only a falha conhecida de rate-limit do Supabase Auth (não relacionada).

---

## 2026-09-04 — Corrige botão travado no login/cadastro/esqueci-senha após falha de rede

**Contexto:** mesmo padrão de bug já corrigido no chat (`chat-panel.tsx`, sessão anterior): `setIsSubmitting(true)` sem `try/finally` em volta do `await` da Server Action — se a chamada falhar ou for abortada (rede instável, navegação interrompida no meio), `setIsSubmitting(false)` nunca roda e o botão fica desabilitado pro resto da sessão do componente, sem nenhuma mensagem de erro visível.

Achado testando o ambiente de produção na Vercel: uma navegação minha interrompeu o POST de login em andamento (`ERR_ABORTED`) e o formulário ficou sem feedback nenhum.

**Correção:** os 3 caminhos do mesmo formulário (entrar, criar conta, esqueci a senha) em `components/auth/email-password-form.tsx` ganharam `try/finally` em volta do `await`.

---

## 2026-09-04 — Área de atendimento do profissional: raio configurável a partir do CEP

**Contexto:** usuário pediu, no cadastro do Profissional, um jeito de escolher o raio de atendimento (1/5/10/20/50 km ou "sem restrição") a partir do CEP dele. Investigando antes de construir, achei que **`professional_service_areas` era só schema e RLS desde a fundação (migration 0012) — nenhuma tela ou Server Action jamais escreveu nela.** Os 2 registros que já apareciam no mapa de cobertura do Admin vieram de insert direto via SQL, não de um fluxo real. Autorização (insert/update/delete do próprio profissional) já existia, só faltava a peça que usa isso.

- `0069_professional_service_area_radius.sql`: `radius_km` passa a aceitar `null` (= sem restrição de distância, pedido explícito do usuário — antes era `not null default 10`, sem essa opção); nova coluna `center_zip` (guarda o CEP digitado, pra reexibir no formulário); constraint única em `professional_id` (uma área por profissional, upsert em vez de múltiplas linhas — nenhum registro existente tinha mais de uma).
- `lib/actions/service-area.ts`: `upsertServiceArea` — reaproveita `lib/services/geocoding.ts` (a mesma função `geocodeCep` construída pro endereço do Tutor) pra transformar CEP em lat/lng, depois faz upsert por `professional_id`.
- `components/professional/service-area-form.tsx`: campo de CEP + chips de raio (1/5/10/20/50 km + "Sem restrição"), plugado em `app/(profissional)/perfil/page.tsx`.
- `app/(tutor)/buscar/page.tsx`: filtro de distância atualizado — `radius_km === null` agora sempre inclui o profissional na busca, independente da distância do Tutor.
- **Verificado ao vivo, incluindo um caso de falha real**: salvar com raio de 20km funcionou de primeira (CEP do Rio de Janeiro geocodificado certo). A primeira tentativa de salvar "sem restrição" falhou com timeout de rede no Nominatim (`ETIMEDOUT`, achado real via log do servidor, não bug de código — a chamada com `radiusKm: null` chegou certinha no servidor) — na segunda tentativa funcionou e `radius_km` ficou `null` no banco, confirmado por SQL direto.

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (37 rotas). `tests/rls/professional-service-area.test.ts` (novo: insert com radius null, constraint única bloqueia segunda área, upsert atualiza em vez de duplicar, outro profissional não edita área alheia) — 4/4 passando isolado. A suíte completa não fechou verde nesta sessão por causa do rate limit de auth do Supabase (achado: havia uma tarefa em background rodando em paralelo, num worktree dentro do próprio repo, também batendo na mesma auth do projeto — corrigido `vitest.config.mts` pra excluir `.claude/worktrees/**` da própria descoberta de testes, que antes rodava a suíte de lá junto com a daqui por engano). Re-conferir quando o rate limit esvaziar.

---

## 2026-09-04 — Endereço do Tutor (novo "Meu perfil"): fecha o lado que faltava no mapa de cobertura

**Contexto:** usuário reparou, olhando o mapa de cobertura ao vivo, que só apareciam profissionais, nunca tutores. Não era mock nem bug da consulta — é um gap real: `profiles.address_zip/address_lat/address_lng` existem no schema desde a fundação do projeto, mas **nenhum formulário do app jamais escreveu neles** pro Tutor (o endereço só existia como texto livre dentro de cada solicitação, nunca persistido no perfil). Profissional aparecia porque configura área de atendimento com lat/lng de verdade — fluxo que já existia antes, sem relação com este dashboard.

Descobri também, no caminho, que **o Tutor não tinha nenhuma tela de "meu perfil"** (só o Profissional tem, em `/perfil`) — essa entrega criou a primeira.

- `app/(tutor)/meu-perfil/page.tsx` (novo, adicionado a `TUTOR_ONLY_PREFIXES` no middleware) — mostra nome/e-mail (leitura) e o formulário de endereço. Link novo em "Início" (`/inicio`).
- `lib/services/geocoding.ts` (novo): CEP → endereço via ViaCEP (serviço público brasileiro, sem custo/chave) → lat/lng via Nominatim (OpenStreetMap — mesmo provedor dos tiles que o mapa já usa, não introduz um serviço novo no projeto). Sem PostGIS/API paga, mesmo espírito de `distance_km`/`cep_to_uf`.
- `lib/actions/tutor-profile.ts`: `updateTutorAddress` — só CEP, opcional (decisão do usuário: não bloquear cadastro nem fluxo atual). RLS de `profiles` já permitia o Tutor atualizar sua própria linha (`profiles_update`, 0009) — nenhuma migration nova precisou disso.
- **Bug real encontrado e corrigido ao testar ao vivo**: o `User-Agent` do fetch pro Nominatim tinha um travessão ("—") no comentário/string, e cabeçalho HTTP precisa ser puro ASCII — `fetch` falhava com `Cannot convert argument to a ByteString`. Trocado por texto sem acentuação.
- **Verificado de ponta a ponta**: CEP `01310-100` salvo pela conta de teste dupla → `profiles.address_lat/lng` gravados corretos (Avenida Paulista) → reconsultei a lógica do `admin_kpi_geo_coverage` direto no banco e o tutor já aparece agrupado em "São Paulo" junto com o profissional que já estava lá.

**Achado de segurança encontrado no caminho, sinalizado como tarefa separada (não corrigido aqui):** `profiles_select_public_professional` (0013) é uma policy só de linha — quando bate (qualquer perfil com serviço ativo), libera a leitura da linha `profiles` **inteira**, sem filtro de coluna. Numa conta dupla (tutor + profissional, mesma linha), o endereço que acabou de ganhar um jeito de ser preenchido ficaria visível pra qualquer um vendo o perfil público do profissional. É uma característica pré-existente da tabela (não introduzida por esta entrega), mas o campo novo torna o risco concreto — vale uma view (`public_professional_profiles`) só com colunas seguras, em vez de expor `profiles` inteira nesse caminho.

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (37 rotas agora). 96/96 testes (nenhum novo automatizado aqui — a chamada real a ViaCEP/Nominatim não é o tipo de coisa que vale mockar num teste de RLS; cobertura ficou na verificação manual ao vivo documentada acima).

---

## 2026-09-04 — Dashboard de KPIs do Admin (itens 19-20): as 6 áreas completas + funil de instrumentação

**Continuação da entrada anterior** (fundação + mapa de cobertura). Fechado agora o resto do dashboard: os ~4 RPCs de KPI que faltavam, a tela de 6 abas de verdade (recharts), e a instrumentação dos eventos de funil que a `analytics_events` estava esperando.

### RPCs de KPI

- `admin_kpi_summary` (`0065`): payload jsonb único com os KPIs de visão executiva/crescimento/oferta-demanda/qualidade (~26 KPIs). Cada valor vem com `delta_pct` vs. o período anterior de mesmo tamanho — é assim que "crescimento da base ativa" e o "+X%" de todo card do mockup funcionam, sem precisar de uma janela fixa separada. Recorrência do tutor e retenção do profissional usam a janela de 30 dias combinada com o usuário, calculada via `lag() over (partition by tutor/profissional order by completed_at)`.
- `admin_kpi_funnel` (`0066`): funil **por coorte de entrada** (regra explícita da especificação externa — nunca mistura eventos de períodos diferentes). Passos reais (solicitação→proposta→aceite→paga→concluída) já funcionam; os 2 passos "C" (busca→perfil, perfil→solicitação) leem de `analytics_events`, que só passou a receber dado nesta mesma entrega (ver instrumentação abaixo).
- `admin_kpi_financeiro` (`0067`): GMV/comissão/repasses/cancelamentos/chargebacks/divergências de conciliação — mesma lógica que já existia no dashboard antigo, ampliada e movida pra SQL. Continua perto de zero até a Onda 3 rodar de verdade (beta usa confirmação manual).
- `admin_kpi_timeseries` (`0068`): série semanal (`solicitacoes`/`concluidos`/`gmv`/`confirmados`) pro gráfico de barras.
- Todas seguem o padrão já estabelecido: `security definer`, checagem de `is_admin_or_supervisor()` no corpo, `revoke`/`grant` explícitos.
- Testadas contra dado real do banco (script ad-hoc com sessão de `teste.admin@plataformapet.dev`, não só a assinatura) antes de considerar prontas — sem isso o bug do `cep_to_uf`/`admin_kpi_geo_coverage` da entrega anterior teria se repetido em pelo menos uma das quatro.

### Instrumentação do funil (a tabela `analytics_events` finalmente recebe escrita)

- `lib/analytics/{events,track,track-server}.ts`: wrappers finos de insert, nunca lançam erro nem travam a UI.
- Cookie `plys_sid` (1 ano, não-httpOnly) garantido em toda requisição por `lib/supabase/middleware.ts` — é o `session_id` de todo evento, autenticado ou não. Como não existe navegação anônima no app (só `/login` é público), isso só importa mesmo pro clique em "Criar conta".
- 6 pontos de disparo: `search_result_view` (`buscar/page.tsx`), `professional_profile_view` (`profissional/[id]/page.tsx`), `request_started` (mount de `new-request-form.tsx` e `start-conversation-form.tsx`), `request_submitted` (`createRequest`, antes do redirect), `signup_started` (clique em "Criar conta", já capturando UTM de `location.search`), `signup_completed` (fim de `chooseProfile` — copia `source/medium/campaign` do `signup_started` da mesma sessão, sem precisar de join depois).

### UI — as 6 abas de verdade

- `npm install recharts` (única dependência nova).
- `app/admin/dashboard/page.tsx` reescrito: busca as 5 RPCs (+ contagem de habilitações pendentes) num `Promise.all` só, passa tudo pronto pro client. Erro de qualquer uma das 3 principais mostra uma mensagem amigável em vez de quebrar a página (usa o `error.tsx`/`loading.tsx` que o grupo `/admin` já tinha, nenhum novo precisou ser criado).
- `components/admin/dashboard-shell.tsx`: as 6 abas (Visão executiva/Crescimento/Oferta e demanda/Funil/Financeiro/Qualidade e segurança), filtros de período/região/serviço que empurram pra URL (mesmo padrão de `search-filters-form.tsx`) — dado já vem todo carregado, trocar de aba é só visibilidade local. Gráfico de barras semanal com `recharts`; funil renderizado como barras horizontais (mais fiel ao mockup do que forçar o `FunnelChart` do recharts). Mapa de cobertura (entrega anterior) agora vive dentro dessa mesma tela, visível em qualquer aba.
- `components/admin/kpi-card.tsx`: valor + delta. Sem os selos "Fonte existente/Exige regra" do mockup — só "Aguardando Onda 3" nos cards financeiros.
- Verificado ao vivo trocando de aba e de filtro (região=SP recalculou os números na hora, confirmando que o ciclo filtro→URL→RPC→render funciona de ponta a ponta).

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (ainda 36 rotas). 96/96 testes. Navegação real como `teste.admin@plataformapet.dev` confirmando as 6 abas, o gráfico semanal, o funil e a troca de filtro — tudo com número batendo com o que o script de teste ad-hoc já tinha validado direto na RPC.

**Não incluído nesta entrega:** os eventos `search_result_view`/`professional_profile_view` recém-instrumentados ainda não têm volume real pra aparecer nos KPIs "busca→perfil"/"perfil→solicitação" (aparecem como `—` até alguém navegar de verdade em produção) — é esperado, não é bug.

---

## 2026-09-04 — Dashboard de KPIs do Admin (itens 19-20): fundação + mapa de cobertura por cidade

**Contexto:** usuário trouxe um pacote do "funcional" (ChatGPT) com especificação funcional (41 KPIs em 6 áreas) e um mockup navegável pro dashboard de KPIs do Admin, que estava pausado esperando essa definição. Discutimos os pontos ambíguos antes de codar (registrado em `C:\Users\jeffe\.claude\plans\groovy-questing-nest.md`): os 3 KPIs que dependiam de rastreamento de origem/aquisição entram já na V1 (não ficam esperando o "ON"); "tutor ativo" = criou solicitação OU enviou mensagem no período; janela de recorrência/retenção = 30 dias. No meio da conversa, o usuário pediu um mapa múndi de cobertura (tutores/profissionais por cidade) — essa parte saiu primeiro, por ser a mais concreta e verificável de ponta a ponta; o restante dos ~41 KPIs (RPCs de resumo/funil/financeiro/série temporal + shell de abas) fica pra continuação.

### Fundação de schema

- `cep_to_uf(zip)` (`0060`): deriva UF a partir do CEP via faixas oficiais dos Correios — região do dashboard é **UF, não cidade** (schema não tem coluna de cidade em lugar nenhum; cidade exigiria API de geocoding ou campo novo nos formulários, nenhum dos dois feito agora). Função pura, grant público (mesmo tratamento de `distance_km`).
- Índices que faltavam pra range de data: `requests(created_at)`, `request_status_history(to_status, created_at)`, `request_occurrences(scheduled_at/completed_at)` — nenhuma dessas colunas tinha índice até agora.
- `analytics_events` (`0061`): log write-only pros KPIs de funil/aquisição que ainda vão entrar (busca→perfil, perfil→solicitação, origem dos cadastros). Insert liberado pra `anon`+`authenticated` (é só telemetria), select só Admin/Supervisor, sem update/delete (log imutável). Ainda sem instrumentação (nenhum ponto do app grava nela ainda) — isso é próxima etapa.
- `reference_cities` (`0062`): ~100 cidades brasileiras curadas (27 capitais + principais metrópoles/regiões) com lat/lng, pra rotular a cidade mais próxima de um ponto — select público, tabela sem dado de pessoa.

### Mapa de cobertura geográfica

Pedido do usuário: "mapa múndi com os pontos onde temos clientes (tutores e profissionais), cores diferentes por cidade, com números totais, pra investir em marketing em regiões fora do radar." O projeto já tinha tudo pra isso — reaproveitado o padrão de `components/search/results-map.tsx` (Leaflet + OpenStreetMap, sem chave de API).

- `admin_kpi_geo_coverage(p_category)` (`0063`, fix de bug em `0064`): casa cada tutor (`profiles.address_lat/lng`) e profissional (`professional_service_areas.center_lat/lng` — área configurada, não endereço) com a cidade de referência mais próxima via `distance_km`; ponto a mais de 50km de qualquer cidade cai num balde "UF — outras cidades" em vez de forçar errado. **Decisão:** agrega por cidade (nunca um pino por pessoa) — protege endereço residencial exato do tutor e evita poluição visual em escala de mapa múndi. `security definer`, checa `is_admin_or_supervisor()`, `revoke`/`grant` conferidos com `has_function_privilege`.
- `components/admin/coverage-map.tsx` (+ `coverage-map-loader.tsx` pro `next/dynamic({ssr:false})`, Leaflet acessa `window`): um círculo por cidade pra tutores (teal) e outro pra profissionais (laranja), levemente deslocados, com o número escrito dentro do próprio círculo — não escondido em popup.
- Adicionado ao fim de `app/admin/dashboard/page.tsx` (dashboard existente, ainda sem o redesenho de abas das 6 áreas — isso vem na próxima etapa).

**Bug pego ao testar no browser:** `column reference "lat" is ambiguous` — `RETURNS TABLE` cria variáveis PL/pgSQL com os mesmos nomes das colunas de saída (`lat`, `lng`, `uf`...), e uma CTE interna (`combined`) selecionava essas colunas sem qualificar o alias de origem. Corrigido em `0064_fix_admin_kpi_geo_coverage_ambiguous_column.sql`.

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (36 rotas). 96/96 testes (85 anteriores + 11 novos: `tests/rls/analytics-events.test.ts`, `tests/rls/admin-kpi-geo-coverage.test.ts` — grants, `cep_to_uf` com CEPs reais de 4 capitais, bloqueio de não-admin). Testado ao vivo como `teste.admin@plataformapet.dev`: confirmado via inspeção de DOM que a RPC retornou os 2 profissionais de teste (São Paulo e Osasco) e os 2 marcadores renderizaram com a contagem certa — screenshot do navegador ficou instável nessa região específica da tela (bug de captura da ferramenta, não do app; confirmado comparando `getBoundingClientRect`/`elementFromPoint` reais contra o resultado da RPC).

**Próxima etapa (não incluída aqui):** os ~4 RPCs de KPI restantes (resumo executivo/crescimento/demanda/qualidade, funil por coorte, financeiro, série temporal semanal), o shell de 6 abas + filtros (período/região/categoria), `recharts`, e a instrumentação dos 6 eventos de funil em `analytics_events` (a tabela já existe, ainda não recebe escrita de lugar nenhum).

---

## 2026-09-03 — Backlog externo: financeiro pausado, mudança de escopo pós-acordo + indicação/substituição de profissional (itens 23-29)

**Contexto:** usuário trouxe uma lista de 39 itens de backlog de uma conversa com "o funcional" (ChatGPT). Cruzamento feito item a item contra o que já estava no radar — a maior parte do financeiro (itens 1-18) já estava mapeada nas 6 etapas da Onda 3, com pedaços já construídos (onboarding, split codado, bloqueio de saque, conciliação). Decisão do usuário: **financeiro fica pro final**, depois do resto da aplicação estar pronto; itens 21-22 (origem do tutor/circulação entre profissionais, território de CRM) ficam de fora, como já decidido antes; dashboard de KPIs (19-20) aguarda especificação do usuário; infraestrutura (30-39) fica pro fim também. Entra agora: **itens 23-29**.

### Mudança de escopo pós-acordo (23-24)

Hoje só existia "pedir ajuste" ANTES do aceite (`requestAdjustment`). Nova tabela `scope_change_requests` (`supabase/migrations/0058_scope_change_requests.sql`) — bidirecional (tutor ou profissional propõe escopo/valor/data), **nunca mexe em `requests.status`**. RLS: insere quem é parte, só a **contraparte** de quem propôs responde (mesmo padrão de `0022_fix_proposals_accept_rls.sql` — restrição de coluna via `grant`, não editar o conteúdo proposto). Notificações via triggers reaproveitando `notify()` (0012).

- `lib/actions/requests.ts`: `proposeScopeChange`, `respondScopeChange`. Aceitar `data` aplica de verdade em `request_occurrences`; aceitar `escopo`/`valor` fica só como registro histórico — sem Onda 3, não tem como cobrar diferença nem reembolsar automaticamente (mesmo aviso já usado em `confirmPaymentManually`).
- `components/requests/scope-change-panel.tsx` (novo).

### Indicação e substituição de profissional (25-29)

Achado-chave da exploração: **nenhuma migration de RLS nova precisa** — a trava do item 28 ("nunca automático") já existe de graça: `requests_insert` exige `tutor_id = auth.uid()`, então o Profissional fisicamente não consegue criar a request nova em nome do Tutor. Reaproveita o padrão já usado pra visita inicial: nunca muta `professional_id` numa request existente, sempre cria uma nova vinculada via `origin_request_id`.

- `requests.referred_professional_id` (novo, `0059_referral_and_substitution.sql`) — Profissional só *sugere*, Tutor sempre decide.
- `lib/actions/requests.ts`: `declineRequest` reescrito (aceita `referredProfessionalId` opcional), `listEligibleColleagues` (mesma categoria, serviço ativo, exclui quem indicou), `acceptReferral` (cria a conversa vinculada — reaproveita `startConversation`/`is_conversa_previa`), `substituteProfessional` (pós-aceite — cancela a request original; transições `confirmado/checkin/em_andamento/finalizacao -> cancelado` já existiam desde 0012/0048, nenhuma migration de máquina de estados nova).
- **Bug real encontrado e corrigido no caminho:** `createRequest` recalculava `origin_request_id` (auto-lookup de visita inicial) toda vez, inclusive ao formalizar uma request existente (`existingRequestId`) — isso apagaria o vínculo de indicação/substituição no meio do fluxo, porque o lookup nunca acha nada pra um par tutor/novo-profissional que nunca teve visita inicial. Corrigido: quando há `existingRequestId`, o `origin_request_id` já gravado no rascunho é preservado antes de considerar o auto-lookup.
- `components/requests/{referral-card,substitute-professional-button}.tsx` (novos). `decline-request-button.tsx` ganhou seletor de "indicar colega".
- `get_pet_co_tutor_names`-style: nenhuma função nova precisou disso — o profissional indicado é sempre alguém com serviço ativo na categoria, então `profiles_select_public_professional` (0013) já libera ler o nome dele.

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (36 rotas). 85/85 testes passando (74 anteriores + 11 novos: `tests/rls/scope-change-requests.test.ts`, `tests/rls/decline-referral-substitution.test.ts`). Fluxo completo testado ao vivo no navegador com sessões reais (2 contas): profissional recusa indicando um colega → tutor vê o `ReferralCard` com o nome certo → aceita → conversa vinculada abre com `origin_request_id` apontando pra request original (confirmado no banco) → formulário de formalização já carrega com a categoria certa. Dado de teste limpo depois.

**Não incluído nesta entrega:** teste automatizado da lógica de elegibilidade (`isEligibleColleague`) em si — as Server Actions usam `next/headers`, não dá pra chamar direto de um teste Vitest fora do request lifecycle do Next; cobertura ficou na camada de RLS (que é o que realmente protege o dado) mais a verificação manual ao vivo.

---

## 2026-09-03 — 2 erros de CX achados navegando como Tutor: chat direto pré-solicitação + botão "Enviar" travado

**Contexto:** usuário navegando pessoalmente pela visão Tutor (com as contas de teste liberadas na entrada anterior) achou 2 problemas reais.

**Bug 1 — "Conversar" no perfil do profissional levava pra uma solicitação, não pra um chat.** Investigado: o botão apontava pro mesmo formulário de `/solicitacoes/nova` que "Solicitar atendimento", só com um parâmetro (`conversa=1`) que não fazia nada — os dois botões eram idênticos na prática. Perguntado ao usuário se queria só corrigir o rótulo ou ter chat de verdade antes de formalizar: **escolheu chat de verdade**.

**Entrega — "conversa prévia":** `supabase/migrations/0055_conversa_previa.sql` — `requests.is_conversa_previa` (novo) + índice único (`tutor_id, professional_id) where status='rascunho' and is_conversa_previa` (no máximo uma conversa aberta por par). **Achado-chave que evitou reescrever RLS:** `is_party_of_request()` (usada por `messages_select`/`messages_insert`) só olha `tutor_id`/`professional_id`, nunca `status` — bastou criar uma `requests` de verdade em rascunho (só com categoria, sem pets/data/endereço) pro chat já funcionar, zero policy nova. Segue o mesmo padrão já usado pra "visita inicial" (outra linha de `requests`, nunca tabela paralela).

- `lib/actions/requests.ts`: `startConversation` (cria/reaproveita o rascunho, evita duplicar em clique repetido — corrida tratada via retry no `unique_violation`), `endPreChatConversation` (`rascunho -> cancelado`; não reaproveita `declineRequest` porque `'recusado'` não é transição válida a partir de `rascunho`), `createRequest` ganhou `existingRequestId` opcional (formalizar vira `update` na mesma linha, preservando o chat, em vez de criar uma request nova).
- Nova função `get_request_other_party_name(request_id)` (security definer, mesmo padrão de `get_pet_co_tutor_names`) — o chat nunca precisou mostrar nome/avatar da outra parte até agora (pets/categoria sempre deixavam claro quem era quem); RLS normal de `profiles` não libera isso na direção Profissional→Tutor. **Mesmo achado de segurança da entrada anterior:** grant caiu em `PUBLIC` de novo, corrigido com `revoke ... from public` + `grant ... to authenticated` explícito, confirmado via `has_function_privilege`.
- Telas novas: `/solicitacoes/conversar` (escolha de categoria) + `StartConversationForm`/`EndConversationButton`. `app/(tutor)/solicitacoes/[requestId]/page.tsx`: oculta Proposta/Ajuda/Anexos numa conversa prévia, mostra "Quero solicitar de verdade" (reaproveita a request existente, mesmo padrão de "Contratar novamente") e nome da outra parte no cabeçalho do chat. Listas do Tutor e do Profissional (`/solicitacoes`, dashboard do Profissional) atualizadas pra mostrar/contar conversas prévias — sem isso o Profissional nunca ficaria sabendo que alguém quis conversar.

**Bug 2 — botão "Enviar" do chat travava desabilitado.** `components/requests/chat-panel.tsx`: `await sendMessage(...)` não estava em `try/finally` — uma exceção não tratada (rede, serialização) pulava o `setIsSubmitting(false)`, travando o botão pro resto da sessão do componente. Corrigido com `try/finally`.

**Verificação:** `tsc --noEmit`/`eslint .`/`next build` limpos (37 rotas, incluindo `/solicitacoes/conversar`). 74/74 testes passando (68 anteriores + 6 novos, `tests/rls/conversa-previa.test.ts` — inclui teste de regressão confirmando que mensagem funciona em `rascunho` e que a transição inválida `rascunho->recusado` é rejeitada pela trigger). Fluxo completo testado ao vivo no navegador com sessão real: perfil do profissional → "Conversar" → categoria → chat (nome da outra parte no cabeçalho, mensagens iam e vinham sem travar o botão) → "Quero solicitar de verdade" → formulário com categoria pré-preenchida. Dado de teste limpo depois.

---

## 2026-09-03 — Preparação de beta fechado: confirmação manual de pagamento

**Contexto:** usuário quer testar a jornada completa com pessoas reais (Tutor/Profissional) antes da Onda 3 (financeiro real) existir. Sem isso, `acceptProposal` deixa a solicitação presa em `aguardando_pagamento` pra sempre — nada avança sem o webhook do gateway confirmar, que ainda não existe.

**Entrega:** `confirmPaymentManually` (`lib/actions/admin.ts`, admin-only) — transição manual `aguardando_pagamento -> confirmado` (já permitida pela máquina de estados desde 0012, nenhuma migration nova). `ConfirmPaymentButton` aparece em `/solicitacoes/[requestId]` só pro Admin, só quando a solicitação está `aguardando_pagamento`, com aviso explícito de que é mecanismo de beta (pagamento combinado por fora entre as partes) — marcado no código pra ser removido/substituído assim que a Etapa 2 da Onda 3 (Pix) funcionar de ponta a ponta.

**Também:** senha definida nas 3 contas de teste reutilizáveis já existentes (`teste.dual@`, `teste.admin@`, `teste.supervisor@plataformapet.dev`) pra o usuário navegar o app pessoalmente pelo `localhost:3000` e procurar erros de CX, sem precisar de mim pra cada login.

**Verificação:** `tsc --noEmit`/`eslint .` limpos, 68/68 testes continuam passando (nenhum teste novo — é UI/permissão simples). Testado ao vivo: login com senha funcionando nas 3 contas.

---

## 2026-09-03 — Onda 3: fundação sem gateway (schema completo + Etapa 1 — onboarding de recebedor)

**Contexto:** decisão de começar a Onda 3 (financeiro real via Pagar.me) confirmada pelo usuário, mas a chave de sandbox ainda depende de acesso externo (onboarding comercial do lado do Pagar.me, fora do meu controle). Em vez de esperar, separei o que é **puro schema/lógica interna** (não depende de nenhuma chamada real ao gateway) do que **precisa da chave** — e construí a fundação inteira agora. Plano completo (6 etapas: onboarding → Pix → cartão → cancelamento/no-show/chargeback → saque → conciliação do Admin) documentado e revisado com pesquisa direta na documentação oficial do Pagar.me antes de qualquer código (nomes de evento, rotas, estrutura de split — não assumido de memória).

**3 achados de pesquisa que já mudaram o desenho antes de escrever qualquer linha:**
1. `charge.chargedback` está **descontinuado até 30/09/2026** — o evento certo é `chargeback.received`.
2. A rota de saque `/recipients/{id}/withdrawals` está sendo descontinuada em favor de **Transferências** (`/transfers`).
3. **Não existe webhook de transferência/saque** — confirmação de saque concluído só por polling (`GET /transfers/{id}`), diferente do resto do fluxo (Pix/cartão/chargeback), que é por webhook.

**Schema aplicado (migrations via MCP, todas gateway-independentes — puro Postgres):**
- `platform_parameters`: novo status `agendado` + função `promote_scheduled_parameters()` (security definer, chamada por `pg_cron` a cada 10 min) — resolve uma limitação real encontrada (o campo `vigencia_inicio` existia mas não tinha nenhum mecanismo de agendamento; hoje um parâmetro nasce `ativo` na hora, sem jeito de programar uma mudança futura sem já substituir o valor vigente).
- `professional_recipients` (onboarding de recebedor), `webhook_events` (idempotência de webhook via `gateway_event_id` unique), `checkout_sessions` (cartão), `chargebacks`, `reconciliation_flags` + `detect_reconciliation_issues()` (as 4 categorias de divergência da spec: duplicidade, split incorreto, webhook divergente, saque indevido — `pg_cron` de hora em hora).
- Campos novos em `payments` (método, `gateway_order_id`, valor do profissional, snapshot do split) e `payouts` (`failure_reason`).
- Corrigido um gap real na máquina de estados: faltavam as transições `em_andamento→cancelado` e `finalizacao→cancelado` — sem isso, cancelar ou reportar no-show com o atendimento já em andamento quebraria na trigger do banco assim que o efeito financeiro passasse a ser real (Etapa 4).
- Todas as tabelas novas seguem o padrão já estabelecido: RLS habilitada, sem policy de insert/update para `authenticated` nas que só devem ser escritas por `service_role`/funções internas.

**Achado de segurança novo, categoria diferente da já documentada (`BACKLOG.md`):** as duas funções `security definer` novas (`promote_scheduled_parameters`, `detect_reconciliation_issues`) apareceram expostas a `anon`/`authenticated` no `get_advisors` mesmo depois de um `revoke execute ... from anon, authenticated` dentro da própria migration. Investigado com `information_schema.routine_privileges`: desta vez o grant era pra **`PUBLIC`** (não direto a `anon`/`authenticated`, que foi o padrão descoberto em 0038/0039) — corrigido com `revoke execute ... from public`, confirmado via `has_function_privilege`.

**Etapa 1 completa (onboarding de recebedor):**
- `lib/services/pagarme.ts` (novo — primeiro `lib/services/*` do projeto): client HTTP único, todas as chamadas ao gateway isoladas aqui. Escrito contra a doc oficial, incluindo split (`split_rules`), estorno com split de estorno (recurso real e documentado, não suposição), transferência e verificação de assinatura de webhook — esta última marcada explicitamente como não confirmada (header/algoritmo exatos dependem do painel autenticado do sandbox).
- `lib/actions/payments.ts` (`submitRecipientOnboarding`, `getRecipientStatus`) + `lib/validations/payments.ts`: onboarding só grava em `professional_recipients` depois que a chamada ao gateway teria sucesso (aqui, falha com uma mensagem clara porque a chave não existe ainda — comportamento correto e testado).
- `app/(profissional)/financeiro/page.tsx` (nova rota) + `components/professional/recipient-onboarding-form.tsx`. `nav-config.tsx` e o `QuickLink` do dashboard do Profissional atualizados (o comentário que dizia "fica de fora até a Onda 3 existir" não vale mais). `/financeiro` adicionada às rotas exclusivas de Profissional no middleware.

**2 bugs reais encontrados e corrigidos durante o teste (não são achados teóricos):**
1. `pagarmeFetch` escondia o erro de "chave não configurada" dentro do `catch` genérico de falha de rede, mostrando "Falha de rede ao chamar o Pagar.me" em vez da mensagem certa — pego testando o formulário de verdade no navegador (sessão real, `/dev-login`), corrigido movendo a leitura da chave pra fora do bloco de rede.
2. Teste de `promote_scheduled_parameters()` usava o `profile_id` de um usuário de teste efêmero como `atualizado_por` — como `platform_parameters`/`platform_parameters_log` referenciam `profiles` sem `ON DELETE CASCADE`, isso deixou 3 usuários de teste presos (impossíveis de apagar) depois de rodar a suíte algumas vezes. Corrigido usando um admin real e permanente nesse campo. Achado colateral confirmado no processo: **`platform_parameters` não pode ser fisicamente apagado nunca** (a própria trigger de auditoria quebra com violação de FK ao tentar logar a exclusão de uma linha que acabou de sumir) — é por isso que `deleteParameter()` já era soft-delete only; o teste passou a fazer o mesmo (`status: 'substituido'`) em vez de tentar `DELETE`.

**Verificação:** `tsc --noEmit`, `eslint .` e `next build` limpos (35 rotas, incluindo `/financeiro`). 68/68 testes passando (55 anteriores + 13 novos: RLS de `professional_recipients`/`webhook_events`/idempotência/`promote_scheduled_parameters`, unidade de `verifyWebhookSignature`). Fluxo completo testado no navegador com sessão real (Profissional de teste, verificado e com termos aceitos via `test_verify_profile`): formulário preenchido, submetido, erro correto exibido (chave não configurada). Confirmado por SQL: zero usuário/linha residual depois da limpeza.

**Não incluído nesta entrega (dependem da chave do Pagar.me, que ainda não existe):** qualquer chamada real ao gateway (criar recebedor de fato, Pix, cartão, webhook real, estorno, saque); Etapas 2–6 continuam só com o schema pronto, sem a Server Action/UI de cada uma ainda.

---

## 2026-09-02 — Decisão de escopo: Onda 5 e Onda 6 saem da plataforma; falta só a Onda 3 pra fechar o Pilar 1

**Decisão do usuário:** remover a Onda 5 (retenção do Profissional) e os itens ainda pendentes da Onda 6 (Petlys Espaços, Operação regional, Seguro/garantia, Backup de emergência) do escopo de fechamento desta plataforma. Deixam de ser "backlog dentro do projeto em andamento" e viram **funcionalidades futuras**, registradas no `IDEIAS_FUTURAS.md` — exceto o CRM do Profissional, que sai **por completo**: não fica nem registrado como ideia futura desta plataforma, será tratado como iniciativa separada, a discutir no futuro (nem é certo que continue sendo Petlys).

Com isso, o critério de fechamento do Pilar 1 muda: falta só a **Onda 3** (financeiro real). Onda 4 e a "proteção de conversa" da Onda 6 já estavam completas; Ondas 1 e 2 também.

**Nota de consistência documental (não corrigido nesta entrada):** a `Especificacao_Pilar_1_Jornadas_v2.docx` (seção 12) e o `PETLYS_PILAR1_PLANO_100_PERCENT.md` (seção 9, "critério objetivo de Pilar 1 100%") ainda listam Petlys Espaços/seguro/backup/retenção do profissional como parte do escopo de "100%" — esses dois documentos ficam desatualizados em relação a essa decisão até serem revisados. Fica registrado aqui pra não virar divergência esquecida; atualizar a Especificação formal é tarefa separada (edição de `.docx`), não feita nesta entrada.

**Histórico completo do CRM preservado aqui, pra quando a conversa for retomada** (removido do `BACKLOG.md`, não é mais "ideia futura da plataforma", mas o contexto tem valor arquitetural real):

- **Decisão original (2026-09-01):** CRM avançado do Profissional modelado como tier/assinatura paga sobre a Onda 5; mesmo app Next.js, rotas `/crm/*`, acesso por flag de assinatura — nunca repositório/deploy separado (reconciliação de sessões desalinhadas escrevendo no mesmo banco já foi um problema real nesta sessão).
- **Visão expandida (2026-09-02):** CRM descrito como tendo 4 papéis simultâneos — ferramenta operacional (clientes/agenda, inclusive fora da Petlys), motor de aquisição (ponte pra trazer cliente externo pra dentro), privilégio de fidelidade (não liberado a todo profissional desde o dia 1), produto próprio em potencial (assinatura pra profissional fora da Petlys).
- **Decisões técnicas fechadas na discussão:** app mobile-only com PWA instalável (manifest, ícone na tela inicial); modelo de dados desacoplado do marketplace de propósito (contatos/agenda manual não tocam `requests`/`proposals`); acesso controlado por permissão própria (`crm_access`), não amarrada a "é profissional Petlys"; critério de fidelidade = nível "Profissional experiente" (reaproveitando `lib/domain/professional-reputation.ts`, já existe); preview travado com incentivo, não escondido, pra quem não é elegível.
- **Funcionalidades levantadas:** indicadores (conversão, recorrência, "valor negociado" — nunca "faturamento", já que pagamento real não existe), cartão digital/QR apontando pro perfil público já existente, contatos/clientes próprios, agenda manual.
- **Dúvidas nunca resolvidas:** o que exatamente significa "visão mais completa da plataforma"; se cliente trazido de fora vira demanda formal com proteção da plataforma ou fica sempre por fora; comissão sobre cliente trazido de fora; login do assinante externo futuro (conta Petlys ou sistema separado).
- **Riscos identificados:** canibalização do marketplace (facilitar demais o "por fora" reduz solicitação formal); LGPD mesmo pra contato que nunca vira conta Petlys; frustração com o gate de fidelidade se mal comunicado; escopo sem fim ("visão mais completa" indefinida); desconfiança se o que é grátis hoje virar pago amanhã sem aviso; duplicidade de identidade se um contato próprio depois virar Tutor de verdade.

Nenhum código mudou nesta entrada — só reorganização de escopo/documentação.

---

## 2026-09-02 — CI verificado de ponta a ponta: 2 bugs de configuração achados e corrigidos

**Contexto:** a entrega da fase 4 (abaixo) só tinha revisão manual da sintaxe do workflow — sem `act` ou executor de Actions local neste ambiente, não dava pra confirmar de verdade sem um push real. Usuário configurou os 3 secrets e pediu o push; acompanhamos juntos as execuções reais no GitHub até fechar verde.

**2 bugs reais de configuração de CI encontrados** (nenhum no código do app):
1. **`tsc` falhava em checkout limpo**: `app/layout.tsx` usa `LayoutProps`, um tipo que o Next.js só gera depois de um `next dev`/`build` já ter rodado — localmente sempre existia, num checkout limpo de CI não. Corrigido adicionando `npx next typegen` (gera só os tipos de rota, sem build completo) antes do step de typecheck. Reproduzido e confirmado localmente simulando checkout limpo (`rm -rf .next` + `tsc`).
2. **Vitest falhava com "Node.js detected but native WebSocket not found"**: `@supabase/supabase-js` inicializa o cliente Realtime dentro de `createClient()` mesmo sem nunca chamar `.channel()`, e isso exige WebSocket nativo (Node 22+). O workflow tinha `node-version: 20`. Corrigido subindo pra Node 24 (mesma versão usada localmente a sessão inteira) + adicionado `engines.node: ">=22"` no `package.json` documentando a exigência real.

Também corrigidos, no caminho, 2 seletores frágeis em `e2e/shell-smoke.spec.ts` ("Meus pets"/"Atendimentos" batiam em mais de um link na mesma tela) — trocados por seletor de `href` em vez de texto acessível, mais robusto contra link repetido.

**Resultado final confirmado no GitHub Actions**: run `#3` (commit `1ba407d`) — **Success**, 3m45s, **55/55 testes passando** (Vitest: 37 unidade + 18 RLS; Playwright: 5 E2E, incluído no mesmo job). Único aviso residual é do próprio GitHub sobre as actions padrão (`checkout@v4` etc. ainda referenciando Node 20 internamente) — infraestrutura deles, não afeta o resultado.

**Também gerados automaticamente nesse processo**: `AGENTS.md`/`CLAUDE.md` — arquivos que o próprio Next.js 16 cria via `next dev`/`typegen`, avisando agentes de IA sobre breaking changes da versão. O próprio arquivo instrui a commitar, não ignorar.

---

## 2026-09-02 — Onda 0 (backlog): testes automatizados, fase 4 (última) — CI no GitHub Actions

**Contexto:** quarta e última das 4 fases combinadas (Vitest → RLS → Playwright → CI). Formaliza como pipeline automático o que até aqui só rodava manualmente a cada entrega desta sessão.

**Entrega:** `.github/workflows/ci.yml` (novo) — roda em todo push/PR pra `main`: `tsc --noEmit` → `eslint .` → `next build` → Vitest (unidade + RLS) → instala Chromium → Playwright (E2E). Publica o relatório do Playwright como artefato só quando algo falha.

**Limitação conhecida, registrada de propósito (não escondida):** os testes de RLS e E2E batem no mesmo projeto Supabase remoto usado em desenvolvimento — não existe projeto/ambiente dedicado a CI. Cada execução cria e apaga sua própria fixture (prefixo `rls-test-*`), mas ainda é tráfego real contra o banco de produção-de-fato do projeto a cada push. Isso não é uma regressão introduzida agora — é a mesma característica que o projeto já tem desde sempre (nenhuma parte dele tem separação de ambiente); só está sendo formalizado em vez de rodado manualmente. Registrado no `BACKLOG.md` como próximo passo natural se o volume de push justificar um projeto Supabase só pra CI.

**Ação pendente do usuário (não é código, é configuração do GitHub) — deliberadamente não feita por mim:** o workflow precisa de 3 secrets no repositório (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, os mesmos valores do `.env.local`). Não configurei isso via `gh secret set` de propósito — `SUPABASE_SERVICE_ROLE_KEY` ignora toda a segurança do banco (bypassa RLS por completo), e é uma credencial sensível demais pra eu manusear/gravar em nome do usuário sem confirmação explícita. Fica em: GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret.

**Verificação:** sintaxe do workflow revisada manualmente linha a linha (sem `act` ou executor de Actions local disponível neste ambiente pra rodar de verdade) — só é possível confirmar 100% depois do primeiro push com os secrets configurados. `tsc --noEmit` e `eslint .` limpos (nenhum arquivo TypeScript novo, só o YAML).

**Com isso, as 4 fases da iniciativa de testes automatizados (item do `BACKLOG.md` desde 2026-08-31) estão completas**: 60 testes automatizados (37 unidade + 18 RLS + 5 E2E) rodando local e, assim que os secrets forem configurados, em CI a cada push.

---

## 2026-09-02 — Onda 0 (backlog): testes automatizados, fase 3 — Playwright ponta a ponta

**Contexto:** terceira das 4 fases combinadas (Vitest → RLS → Playwright → CI). Diferente dos testes de RLS (batem direto na API do Supabase), estes navegam o app de verdade no navegador, incluindo o middleware do Next.js — o que exigiu um pedaço de infraestrutura novo que os testes de RLS não precisavam.

**Entrega:**
- `playwright.config.ts` (novo): projeto único (Chromium), `workers: 1`/`fullyParallel: false` de propósito — os specs autenticados compartilham o projeto Supabase remoto (sem ambiente isolado por worker), então rodar em série evita interferência entre testes concorrentes. `webServer` reaproveita o `next dev` já rodando (`reuseExistingServer`) em vez de subir um segundo servidor.
- `e2e/helpers/auth.ts` (novo): `loginAs(page, email)` — mesma técnica de sessão real usada a sessão inteira (`generateLink` + `verifyOtp`), navegando pra `/dev-login` (rota que só existe fora de produção, `app/(auth)/dev-login/route.ts`) em vez de tentar automatizar OTP por SMS/OAuth de verdade.
- `supabase/migrations/0041_test_helper_verify_profile.sql` (novo): `test_verify_profile(p_profile_id)`, SECURITY DEFINER, só `service_role` — os testes de RLS não precisam de telefone/e-mail verificado porque isso é gate do *middleware* do Next.js, não de RLS; specs Playwright navegam o app de verdade, então precisam. Revogado de `anon`/`authenticated` (mesmo padrão de 0038/0039/0037) — nunca deveria existir uma porta de auto-verificação pra quem já está logado.
- `e2e/helpers/fixtures.ts` (novo): `provisionAppReadyUser()` — chama `provisionTestUser` (reaproveitado de `tests/rls/helpers.ts`) e completa com `test_verify_profile` + aceite de termos.
- 3 specs em `e2e/`: `shell-smoke.spec.ts` (tutor/profissional/admin chegam cada um na própria home com a navegação certa — M-001/M-002), `favoritos.spec.ts` (loop completo favoritar → ver em `/favoritos` → desfavoritar → vazio) e `search-map.spec.ts` (alterna lista/mapa, confirma que o Leaflet monta).

**Ajustes feitos durante o teste (achados de teste, não do app):**
- Conta com um papel só sempre pousa em `/` (tela de "Entrar como Tutor/Profissional") — só ganha o cookie `active_role` depois de clicar o botão; os specs precisaram desse clique antes de navegar pra rotas exclusivas do papel.
- Seletor `getByRole("link", { name: "Buscar" })` batia em dois links (o da barra lateral e o CTA "Buscar profissional" da home) — resolvido com `exact: true`. Mesma correção pra "Agenda"/"Agenda e bloqueios".
- `FavoriteButton` atualiza a UI otimisticamente antes da Server Action (via `startTransition`) terminar de gravar — navegar pra `/favoritos` logo em seguida podia chegar antes do favorito existir de verdade no banco. Corrigido com uma pequena espera antes de navegar.

**Verificação:** 5 specs, todos passando, rodados duas vezes seguidas sem flakiness. `tsc --noEmit` e `eslint .` limpos. Confirmado via SQL: zero usuário `rls-test-e2e-*` residual depois de rodar a suíte.

**Não incluído nesta entrega:** GitHub Actions CI (fase 4, última) — fica pra continuar depois. Cobertura de E2E também não é exaustiva de toda jornada do produto — só as 3 áreas de CX/features entregues nesta sessão.

---

## 2026-09-02 — Onda 0 (backlog): testes automatizados, fase 2 — RLS com sessão real

**Contexto:** segunda das 4 fases combinadas (Vitest → RLS → Playwright → CI). Estes testes existem especificamente porque testar RLS manualmente já achou 4 bugs reais nesta sessão (aceite de proposta que não gravava, Supervisor resolvendo incidente sozinho, co-tutor não vendo o outro, `notify()` exposto) — a ideia é parar de depender de eu lembrar de testar isso à mão.

**Entrega:**
- `tests/rls/helpers.ts` (novo): `provisionTestUser()` cria usuário de teste (`rls-test-*@plataformapet.dev`) com papel(éis) via `service_role`, sem passar por verificação de telefone/e-mail/termos — RLS é avaliada pelo Postgres na chamada da API, não pelo middleware do Next.js, então esses gates de rota são irrelevantes pra esse tipo de teste. `sessionClientFor()` gera sessão real via `generateLink` + `verifyOtp` (mesma técnica manual usada a sessão inteira). `anonClient()`/`serviceClient()` completam o trio de papéis testáveis.
- 5 arquivos de teste em `tests/rls/`, cada um com fixture própria criada com `service_role` e limpa no `afterAll`:
  - `pets.test.ts` — dono vê o próprio pet, outro tutor e anônimo não veem, ninguém se auto-adiciona como tutor, `created_by` não pode ser falsificado.
  - `proposals.test.ts` — **regressão do bug de 0022**: tutor consegue aceitar (`accepted_at` grava de verdade), não consegue alterar preço via update direto, tutor de outra solicitação não consegue aceitar.
  - `incidents.test.ts` — **regressão do bug de 0034**: Supervisor escala mas não resolve diretamente (RLS bloqueia, não só a Server Action), Admin resolve.
  - `co-tutors.test.ts` — **regressão do bug de 0037**: os dois co-tutores veem os dois nomes, não-tutor recebe lista vazia, anônimo é bloqueado por GRANT.
  - `security-hardening.test.ts` — **regressão de 0038/0039**: `notify()` bloqueada pra todo mundo, `flag_message` bloqueada só pra `anon`.

**Bug de teste encontrado e corrigido no processo (não do app):** a primeira versão de `pets.test.ts` montava a fixture usando o client do próprio usuário de teste (não `service_role`) — o `.insert().select()` falhava porque o `pets_select` exige `is_tutor_of_pet()`, e o vínculo em `pet_tutors` só era criado *depois* do insert do pet, numa chamada separada. Corrigido usando `service_role` pra montar a fixture (bypassa RLS de propósito — o que está sob teste é o comportamento do usuário depois, não o processo de montar o cenário). Também foi encontrado, duas vezes, o mesmo padrão de resíduo: `requests.tutor_id`/`professional_id` e `pets.created_by` não têm `ON DELETE CASCADE` até `profiles` — apagar o usuário de teste antes de apagar a linha que o referencia falha silenciosamente (`admin.auth.admin.deleteUser` retorna erro, mas nada quebra visivelmente se ninguém checar). Corrigido reordenando os `afterAll` (apaga a linha filha primeiro) e deixando `cleanupTestUser` logar um aviso em vez de engolir esse tipo de erro.

**Verificação:** 55 testes (37 unidade + 18 de RLS), 11 arquivos, todos passando. `tsc --noEmit` e `eslint .` limpos. Confirmado via SQL direto no projeto: zero usuário `rls-test-*` residual depois de rodar a suíte inteira duas vezes seguidas.

**Não incluído nesta entrega:** Playwright (fase 3) e GitHub Actions CI (fase 4) — ficam pra continuar depois. Esta suíte de RLS também não é exaustiva de toda política do schema (seria um projeto à parte) — cobre as áreas de maior histórico de bug real desta sessão, não every policy que existe.

---

## 2026-09-02 — Onda 0 (backlog): início dos testes automatizados — Vitest + unidade de domínio

**Contexto:** item do `BACKLOG.md` desde a auditoria inicial (2026-08-31) — zero teste no projeto inteiro. Primeira fase, decidida com o usuário: começar por Vitest (lógica pura), depois RLS com sessão real, depois Playwright ponta a ponta, depois CI no GitHub Actions.

**Entrega:**
- `vitest.config.mts` (novo) — resolução de path (`@/*`) nativa do Vite, sem plugin extra; roda `**/*.test.ts`, sem `jsdom` por enquanto (nada aqui testa componente React ainda).
- `package.json`: scripts `test` (`vitest run`, pra CI) e `test:watch` (pro dia a dia).
- 6 arquivos de teste, um por módulo de `lib/domain/`, cobrindo as funções puras mais centrais do produto:
  - `professional-reputation.test.ts` — cálculo de nível de carreira (novo/experiente/top) e média de avaliação.
  - `category-requirements.test.ts` — requisitos de prontuário por categoria, incluindo override vindo do Admin.
  - `pet-prontuario-freshness.test.ts` — alerta de dado desatualizado (não alerta prontuário vazio, alerta certo em meses/anos).
  - `occurrence-pipeline.test.ts` — rótulo de fase do Kanban por categoria, com fallback genérico.
  - `request-status-copy.test.ts` — inclui um teste de cobertura total: todo `RequestStatus` usado no app tem as 3 visões (tutor/profissional/staff) preenchidas, pra pegar automaticamente se alguém esquecer de adicionar copy pra um status novo.
  - `incident-types.test.ts` — rótulo/urgência de tipo de incidente, incluindo o fallback de tipo legado.

**Verificação:** 37 testes, 6 arquivos, todos passando (`npx vitest run`). `tsc --noEmit` e `eslint .` limpos incluindo os arquivos de teste novos.

**Não incluído nesta entrega:** testes de RLS com sessão real por papel, testes end-to-end (Playwright), pipeline de CI (GitHub Actions) — ficam pras próximas fases, nessa ordem, combinada com o usuário.

---

## 2026-09-02 — Onda 6: proteção de conversa (seção 2.4)

**Contexto:** discutido com o usuário — objetivo é resguardar a plataforma contra combinação por fora (perda de comissão) e contra conteúdo impróprio no chat, sem bloquear envio e sem punir sozinho: revisão humana antes de qualquer ação, como a Especificação pede.

**Decisão de desenho:** duas categorias, tratadas diferente.
1. **Contato/dado sensível** (telefone, e-mail, CPF, frases de evasão tipo "me chama no whatsapp"/"por fora") — detecção por **padrão (regex)**, alta precisão, zero custo por mensagem.
2. **Conteúdo impróprio** — lista de palavras curada (não IA/LLM): mais barata e previsível que um classificador, ao custo de não pegar tudo. Lista v1, não exaustiva, complementa (não substitui) a sinalização manual que já existe desde a Onda 4.

Rejeitado de propósito: classificador de IA por mensagem — custaria dinheiro por mensagem enviada, adicionaria dependência externa nova, e a plataforma ainda não tem volume/histórico de abuso pra justificar esse investimento agora. Fica registrado como caminho futuro se o volume real mostrar que está passando coisa batido.

**Entrega:** `supabase/migrations/0040_conversation_protection.sql` — trigger `auto_flag_suspicious_message()` (`BEFORE INSERT` em `messages`) que escreve em `messages.flagged_reason` (coluna que já existia desde `0004`, comentada como "reservado para o futuro orquestrador de IA" — reaproveitada, não criada agora) quando o conteúdo bate um dos padrões. **Zero mudança de frontend**: a fila de moderação (`/admin/moderacao`, `components/admin/moderation-queue.tsx`) já consulta só `flagged_reason is not null`, sem se importar se a sinalização foi manual ou automática — mensagem sinalizada automaticamente aparece do mesmo jeito, com os mesmos botões de Ocultar/Manter.

**Verificação:** `tsc --noEmit`, `eslint .` limpos (nenhum arquivo TypeScript tocado). Testado com sessão real (RLS): 5 mensagens enviadas por um Tutor de teste — (1) mensagem normal sobre horário de medicação **não foi marcada** (confirma que o regex de CPF não confunde "11h e 19h" com CPF); (2) telefone marcado corretamente; (3) e-mail marcado corretamente; (4) "prefiro combinar pelo whatsapp" marcado corretamente; (5) "seu idiota" marcado corretamente. Todas as 5 mensagens foram enviadas com sucesso (não bloqueadas). Confirmado visualmente em `/admin/moderacao` como Admin: as sinalizadas aparecem na fila com o motivo automático e os botões de moderação funcionando normal.

---

## 2026-09-02 — Onda 0 (backlog): achados de segurança do Supabase corrigidos (maior parte)

**Contexto:** item do `BACKLOG.md` desde 2026-08-31 (achados de `get_advisors` na auditoria inicial), nunca corrigido. Investigado função por função em vez de aplicado em bloco — o pedido genérico ("SECURITY DEFINER deveria ser SECURITY INVOKER ou só chamável via trigger") não valia igual pra todas as ~26 funções flagueadas.

**Causa raiz descoberta:** não era um grant herdado de PUBLIC — o Supabase concede EXECUTE **direto** a `anon` e `authenticated` em toda função nova do schema `public` (default privileges do projeto), independente de qualquer `grant ... to authenticated` explícito nas migrations originais. A primeira tentativa (`0038`, `revoke ... from public`) não teve efeito nenhum por esse motivo — descoberto testando com `has_function_privilege()` depois de aplicar, não assumido. Corrigido de verdade em `0039` revogando de `anon`/`authenticated` diretamente.

**Classificação de cada função antes de mexer:**
- **11 funções-gatilho** (`apply_account_suspension`, `apply_incident_payout_block`, `enforce_and_log_status_transition`, `handle_new_user`, `log_platform_parameter_change`, `notify_new_incident/message/proposal/review`, `notify_status_change`, `prevent_self_verification`, `set_updated_at`) — `returns trigger`, o Postgres já bloqueia chamada direta fora do mecanismo de trigger. Revogar EXECUTE de `anon`/`authenticated` é seguro e não muda nada (o disparo do trigger roda com o privilégio do dono, não do papel que originou o UPDATE/INSERT).
- **`notify(uuid,text,jsonb)` — achado real, não teórico:** insere notificação pra qualquer `profile_id` sem checar se quem chama tem relação com esse perfil. Só é usada internamente pelas funções de trigger acima (confirmei que nenhum código da aplicação chama `.rpc("notify", ...)` direto); estava exposta por igual pra `anon` e `authenticated` via o default privilege do Supabase. Confirmado o exploit e o fix com sessão real: antes da correção, chamar `rpc/notify` como tutor autenticado inseria a notificação falsa; depois, retorna `permission denied for function notify` — e mandar uma mensagem de verdade continua notificando normalmente (o trigger interno roda como dono, não é afetado pelo revoke).
- **9 RPCs de auto-serviço** (`accept_pending_pet_co_tutor_invites`, `appeal_incident`, `get_pet_co_tutor_names`, `flag_message`/`flag_review`, `dismiss_message_flag`/`dismiss_review_flag`, `set_message_hidden`/`set_review_hidden`) — intenção original já era "só quem está logado" (todas tinham `grant ... to authenticated` explícito desde que foram criadas), mas o default privilege do Supabase também tinha dado `anon`. Revogado só de `anon`, mantendo `authenticated` — testado com sessão real: `anon` puro recebe `permission denied`, usuário autenticado continua funcionando igual.
- **Não mexido, risco aceito e documentado no `BACKLOG.md`:** `has_role`, `is_admin_or_supervisor`, `is_party_of_request`, `is_tutor_of_pet`, `contact_is_unlocked` — predicados booleanos usados dentro de dezenas de policies RLS por todo o schema, incluindo policies de leitura pública (`professional_services_select_public` usa `active or ... or is_admin_or_supervisor()`). Revogar do `anon` quebraria consulta pública via REST API direta sempre que a avaliação da policy precisasse desse operando — erro fatal pra query inteira. Não vazam dado de terceiro (só respondem sobre o próprio `auth.uid()` do chamador). Corrigir de verdade exige mover pra um schema não exposto pelo PostgREST e reescrever todas as policies — fora de escopo por ora.
- **`distance_km`/`set_updated_at`** — `search_path` fixado com `alter function ... set search_path = public`.
- **Não corrigido — não é SQL:** proteção contra senha vazada (HaveIBeenPwned) desligada no Auth. É um toggle no dashboard do Supabase (Authentication > Policies); não encontrei ferramenta de MCP pra isso via código.

**Entrega:** `supabase/migrations/0038_security_hardening_function_grants.sql` (tentativa que não funcionou por revogar de PUBLIC em vez do grantee real — mantida no histórico com o motivo documentado) + `0039_fix_security_hardening_grants.sql` (a correção que efetivamente funcionou).

**Verificação:** `tsc --noEmit`, `eslint .` limpos (nenhum arquivo TypeScript tocado nesta entrega). `get_advisors` caiu de 55 para 20 achados — os 20 restantes são o grupo D (risco aceito, documentado) mais o toggle de senha vazada. Testado com sessões reais (RLS, não bypass): mensagem→notificação ainda funciona; exploit direto de `notify` bloqueado; RPC de auto-serviço (`get_pet_co_tutor_names`) bloqueia `anon` puro e funciona normal pra `authenticated`.

---

## 2026-09-02 — Correção: co-tutores não viam o nome um do outro

**Contexto:** achado colateral registrado na entrada anterior ("convite formal de co-tutor") — bug pré-existente da funcionalidade original de múltiplos tutores por pet (Onda 1), não introduzido pela entrega do convite, só descoberto ao testá-la com uma segunda conta real. `app/(tutor)/pets/[petId]/page.tsx` lia `pet_tutors` com join em `profiles(full_name)`; `profiles_select` (0009_rls_policies.sql) só libera leitura do próprio perfil ou por Admin/Supervisor, então o join sempre voltava `null` pro perfil do outro tutor, e o `.filter((t) => t.profiles)` descartava essa linha — cada co-tutor só via a si mesmo na lista "Tutores vinculados".

**Entrega:**
- `supabase/migrations/0037_fix_co_tutor_name_visibility.sql`: função `get_pet_co_tutor_names(p_pet_id)`, SECURITY DEFINER. Decisão deliberada de **não ampliar `profiles_select`**: RLS filtra linha inteira, não coluna — uma policy "co-tutor pode ler o perfil do outro" liberaria a linha completa via PostgREST (e-mail, telefone, CPF/CNPJ...), não só o nome. A função só devolve `tutor_profile_id` + `full_name` dos tutores de um pet específico, e só responde algo se quem chama já é tutor desse mesmo pet — do contrário retorna vazio.
- `app/(tutor)/pets/[petId]/page.tsx`: troca o join direto por `supabase.rpc("get_pet_co_tutor_names", ...)`.

**Verificação:** `tsc --noEmit`, `eslint .` e `next build` limpos (34 rotas). Testado com duas sessões reais (RLS, não bypass): pet com 2 tutores — cada um via a lista completa com os dois nomes, de ambos os lados. Testado negativo direto via RPC (script com sessão real, não SQL de admin): uma terceira conta que não é tutora desse pet recebeu array vazio, sem erro; a mesma chamada como tutor real trouxe só `tutor_profile_id`/`full_name`, nunca e-mail/telefone/CPF (estruturalmente impossível vazar mais que isso — a assinatura da função só declara essas duas colunas de retorno).

---

## 2026-09-02 — Onda 1 (pendência): convite formal de co-tutor por e-mail

**Contexto:** revisão de pendências das Ondas 1–4. `inviteCoTutorByEmail` só funcionava se a outra pessoa já tivesse conta na Petlys — a própria tela avisava isso. Não havia fluxo de convite pra quem ainda não tem cadastro.

**Entrega:**
- `supabase/migrations/0036_pet_co_tutor_invites.sql`: nova tabela `pet_co_tutor_invites` (pet_id, invited_email, invited_by, status pendente/aceito/cancelado). RLS: só tutor do pet vê/cria/cancela convites dele. `accept_pending_pet_co_tutor_invites()` — SECURITY DEFINER de propósito (mesmo padrão de `appeal_incident()`, 0030): quem aceita ainda não é tutor do pet, não tem standing pra passar numa policy normal; a função só confia no e-mail já verificado em `auth.users` do próprio chamador (`auth.uid()`), nunca em valor vindo do cliente.
- `lib/actions/pets.ts` (`inviteCoTutorByEmail`): e-mail com conta existente continua vinculando na hora (comportamento antigo); e-mail sem conta agora grava o convite e dispara `admin.auth.admin.inviteUserByEmail` — e-mail nativo do Supabase Auth, sem provedor novo. Se o envio falhar, o convite é marcado `cancelado` em vez de ficar "pendente" fantasma sem nenhum e-mail ter saído.
- `app/(tutor)/inicio/page.tsx`: chama `accept_pending_pet_co_tutor_invites()` a cada carregamento — idempotente e silencioso, vincula automaticamente quando a pessoa convidada termina o cadastro normal (telefone, termos, papel) com o mesmo e-mail.
- `components/pets/co-tutors-section.tsx`: mostra convites pendentes na lista ("aguardando cadastro"), texto do formulário atualizado (não fala mais que a pessoa precisa já ter conta).

**Dependência de infraestrutura pra produção (registrando, não implementado aqui):** o Supabase deste projeto usa o relay de e-mail compartilhado padrão, que tem um limite de envio bem baixo (esbarrei nisso durante o teste, ver abaixo) — inviável pro volume real de convites. Antes de operar de verdade, precisa configurar um provedor de SMTP próprio (Resend, Postmark, SES) nas configurações de Auth do Supabase.

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real (Tutor): convite pra e-mail sem conta grava a linha e chama a API corretamente — o teste bateu no limite de envio do relay padrão do Supabase (`over_email_send_rate_limit`), confirmando que a chamada está correta e o problema é de infraestrutura, não de código; o rollback pra `cancelado` quando o envio falha foi confirmado direto no banco. Como não dá pra receber e-mail de verdade neste ambiente, simulei o restante do fluxo criando um usuário de teste com o mesmo e-mail do convite (via Admin API) e fazendo-o passar pelas mesmas gates de sessão que qualquer conta nova (telefone/e-mail verificados, termos aceitos, papel tutor) — ao carregar `/inicio`, o convite virou `aceito` e o `pet_tutors` foi criado corretamente, confirmado via SQL e visualmente na tela do pet.

**Achado colateral (não corrigido aqui, fora do escopo desta entrega):** a lista "Tutores vinculados" só mostra o próprio nome de quem está olhando, nunca o nome do outro co-tutor — a política de RLS de `profiles` (`profiles_select`, 0009) só libera leitura do próprio perfil ou por Admin/Supervisor, sem exceção pra co-tutores do mesmo pet. Bug pré-existente da funcionalidade original de múltiplos tutores (Onda 1), não introduzido por esta entrega — descoberto ao testar o convite com uma segunda conta de verdade.

---

## 2026-09-02 — Onda 1 (pendência): alerta de dado desatualizado no prontuário do pet

**Contexto:** revisão de pendências das Ondas 1–4 — item citado desde a entrega original do prontuário (seção 6.2) como "fica pra depois", nunca implementado: nada avisava o Tutor se saúde/comportamento/rotina de um pet não eram revisados há muito tempo.

**Entrega:**
- `lib/domain/pet-prontuario-freshness.ts` (novo): `prontuarioStalenessLabel(pet)` — sem coluna de timestamp por seção, usa `pets.updated_at` (mantida por trigger genérico já existente em toda alteração do pet) como aproximação. Só alerta quando há conteúdo preenchido (reaproveita `isSectionFilled`, exportada de `category-requirements.ts` pra isso) — prontuário nunca preenchido continua mostrando "Pendente", não "desatualizado", que é um alerta diferente. Limiar de 6 meses (`PRONTUARIO_STALE_MONTHS`).
- `app/(tutor)/pets/[petId]/page.tsx`: banner amarelo acima das seções do prontuário quando aplicável ("Revise o prontuário — não é atualizado há X meses/anos").

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real e dados forçados via SQL (desabilitando o trigger de `updated_at` temporariamente pra simular idade): pet com conteúdo preenchido e 8 meses sem alteração mostrou o banner; pet com prontuário 100% vazio e 20 meses de idade não mostrou banner nenhum (mostra só "Pendente", como já era o comportamento).

---

## 2026-09-01/02 — Onda 1 (pendência): catálogo de requisitos do prontuário editável pelo Admin

**Contexto:** revisão de pendências das Ondas 1–4 a pedido do usuário. `CATEGORY_REQUIRED_SECTIONS` (seção 6.3/6.5) era uma constante fixa no código desde a entrega original da Onda 1 — mudar qual seção do prontuário cada categoria exige dependia de deploy.

**Entrega:**
- `lib/domain/service-catalog.ts`: novo `SERVICE_CATEGORY_LABEL` — achado colateral da revisão, esse rótulo estava duplicado em pelo menos 8 arquivos; consolidado aqui, mas **os 8 arquivos existentes não foram migrados** nesta entrega (fora do escopo do item), só o novo componente já nasce usando a versão única.
- `lib/domain/category-requirements.ts`: `missingProntuarioSections` ganhou um 3º parâmetro opcional (mapa de requisitos), com o default sendo a própria constante — mantém compatibilidade, mas permite injetar a versão vinda do banco.
- `lib/domain/category-requirements-store.ts` (novo): `getCategoryRequiredSections(supabase)` lê `platform_parameters` (`chave1='requisitos_prontuario'`) e monta o mapa — categoria sem nenhuma linha configurada cai no default de fábrica (nunca fica "sem exigência nenhuma" por ausência de configuração). Arquivo separado do domain puro de propósito: depende de um client do Supabase, não pode ser importado por componente client-side.
- `components/admin/prontuario-requirements-manager.tsx` (novo): matriz categoria × seção em `/admin/parametros`, reaproveitando 100% a infraestrutura de `platform_parameters` já existente (`upsertParameter`/`deleteParameter`, RLS admin-only, log de auditoria automático via trigger) — nenhuma tabela ou action nova. Desmarcar = soft-delete (`status='substituido'`, mesmo padrão de qualquer outro parâmetro).
- `supabase/migrations/0035_seed_prontuario_requirements.sql`: semeia os 11 pares categoria/seção que já valiam como default de fábrica, pra o Admin ver o estado real ao abrir a tela em vez de uma matriz vazia. Se o banco não tiver nenhum administrador ainda, o insert não grava nada (sem dono válido pra `atualizado_por`) — a aplicação continua funcionando pelo fallback de código até alguém configurar.
- `app/(tutor)/solicitacoes/nova/page.tsx` e `lib/actions/requests.ts` (`createRequest`): passam a buscar o mapa configurado via `getCategoryRequiredSections` em vez de usar a constante direto — front (aviso ao Tutor) e back (bloqueio real do envio) usam a mesma fonte.

**Bug encontrado e corrigido durante o teste:** a primeira versão do componente guardava um id "otimista" falso (`pending-categoria-secao`) pra uma linha recém-criada, sem nunca trocar pelo id real gerado pelo banco. Desmarcar essa linha em seguida chamava `deleteParameter` com um id inválido — parecia funcionar na tela (o checkbox desmarcava), mas nunca gravava no banco, e reabrir a tela mostrava a linha ainda marcada. Corrigido resincronizando o estado local a partir dos props sempre que `router.refresh()` traz a lista atualizada com os ids de verdade (padrão "ajustar estado durante a renderização" do React, não `useEffect` + `setState`, que o próprio lint acusou como anti-padrão).

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real (Admin): marcar/desmarcar uma célula grava e desfaz no banco (confirmado via SQL direto, incluindo o log de auditoria automático), estado sobrevive a reload. Testado o efeito ponta a ponta como Tutor: com "Passeador de cães" exigindo Comportamento+Emergência (config atual), formulário de nova solicitação mostrou corretamente "falta Comportamento, Emergência e autorizações" pra um pet com só Saúde preenchida.

---

## 2026-09-01 — Onda 2 (retomada do backlog): mapa visual na busca

**Contexto:** segunda metade do item 2 da Onda 2 (busca avançada) — os filtros de preço/nota/subcategoria/espécie e favoritos já tinham sido entregues; o mapa ficou registrado no `BACKLOG.md` por trazer uma dependência nova.

**Entrega:**
- `npm install leaflet react-leaflet` (+ `@types/leaflet` como dev dependency). Sem custo de API key — tiles do OpenStreetMap.
- `components/search/results-map.tsx` (novo): mapa com um pin por profissional (não por serviço), usando o centro da área de atendimento já cadastrada (`professional_service_areas.center_lat/center_lng` — não é a localização exata do profissional, é o centro que ele configurou). Ícone próprio (pin teal com pata) em vez do marcador padrão do Leaflet, que não resolve os PNGs certo com o bundler do Next.js (problema conhecido do react-leaflet). Popup com nome, categoria, preço e link "Ver perfil". Pin diferente (ponto sólido) pra localização do próprio Tutor quando ele compartilhou.
- `components/search/search-view-toggle.tsx` (novo): alterna lista/mapa como estado local (não entra na URL — é preferência transitória, não filtro compartilhável). A lista continua sendo o mesmo card renderizado no servidor; o mapa é carregado sob demanda via `next/dynamic({ ssr: false })`, porque o Leaflet acessa `window` e quebraria a renderização no servidor.
- `app/(tutor)/buscar/page.tsx`: a busca de `professional_service_areas` deixou de ser condicional a "Tutor compartilhou localização" — agora roda sempre que há resultado, porque o mapa precisa dos pins mesmo sem filtro de distância ativo (a lógica de filtro por raio continua igual, só passou a reaproveitar a mesma consulta).

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado ao vivo (sessão real): alternância lista/mapa funcionando, tiles do OpenStreetMap carregando de verdade, 2 pins renderizados (batendo com as 2 áreas de atendimento cadastradas no seed), popup mostrando nome/categoria/preço/link do profissional correto ao clicar no pin.

---

## 2026-09-01 — Onda 2 (retomada do backlog): tela dedicada `/favoritos`

**Contexto:** revisão de pendências das Ondas 1–4 a pedido do usuário. Item já registrado no `BACKLOG.md` desde a entrega de busca avançada — favoritos só existiam como filtro (`?favoritos=1`) dentro de `/buscar`, sem uma listagem própria.

**Entrega:** `app/(tutor)/favoritos/page.tsx` (novo) — lista um card por profissional favoritado (não por serviço, ao contrário de `/buscar`), reaproveitando `tutor_favorites`, `FavoriteButton` e `averageRating` já existentes. Estado vazio com CTA de volta pra busca; sem sessão, mensagem pedindo login. Link "Ver favoritos" adicionado ao cabeçalho de `/buscar`.

**Verificação:** `tsc --noEmit` e `eslint .` limpos. Testado com sessão real (RLS): card renderiza nome/categoria/preço/nota do profissional favoritado; botão de coração desfavorita e a lista atualiza (confirmado direto no banco); estado vazio confirmado após remover o único favorito; link "Ver favoritos" navega corretamente a partir de `/buscar`. Durante o teste, o dev server travou com o mesmo `EBUSY` de Turbopack/Windows já visto nesta sessão (`.next/dev/server/app-paths-manifest.json` bloqueado) — resolvido do mesmo jeito (parar servidor, apagar `.next/`, reiniciar), sem relação com o código desta entrega.

---

## 2026-09-01 — Auditoria de CX: revisão de todas as telas contra o padrão estabelecido

**Contexto:** a pedido do usuário, revisão de toda a base (não só as telas mexidas nesta sessão) contra os 4 itens de CX já entregues (M-001/M-002 shell, M-013 hierarquia, M-007 preço). Auditoria estática (grep por padrões que violam o padrão) + verificação ao vivo dos achados.

**Achados e correções:**
- **`/notificacoes` sem shell** — a única rota que não mora dentro de `(tutor)`, `(profissional)`, `admin` ou `supervisor` (é `(shared)`) tinha ficado sem logo/nav ao clicar no sino. `app/(shared)/layout.tsx` (novo): resolve o papel de exibição (admin/supervisor por `account_roles`, senão o cookie `active_role` — mesma lógica de `lib/supabase/middleware.ts`) e monta o `AppShell` certo.
- **3 cópias idênticas de `STATUS_LABEL`** (`request_status`) espalhadas em `(tutor)/solicitacoes/page.tsx`, `(tutor)/solicitacoes/[requestId]/page.tsx` e `request-timeline.tsx` — consolidadas em `lib/domain/request-status-labels.ts`, reaproveitado também em `admin/dashboard/page.tsx` (que antes mostrava o valor cru do enum em "Pedidos por status").
- **Nome técnico vazando em 3 lugares** que já tinham helper de tradução pronto mas não usavam: o badge de "Atendimento atual" na tela de detalhe (usava `.replace()` cru em vez de `occurrenceStageLabel`, perdendo inclusive o rótulo por categoria da Onda 4 item 1); o tipo e o status do incidente em `incident-queue.tsx` (fila do Admin/Supervisor); o cabeçalho "Incidente:" visível só pro staff. `INCIDENT_STATUS_LABEL` também consolidado (estava só dentro de `help-button.tsx`) em `lib/domain/incident-types.ts`.
- **Fallback de tipo de incidente sem tradução**: incidentes antigos (seed anterior a essa funcionalidade, com tipo em texto livre tipo `pet_machucado`) caíam no fallback cru do `incidentTypeLabel()`. Fallback ajustado pra pelo menos tirar o underscore (`pet machucado`) em vez de mostrar o snake_case.
- **Verificado e sem problema**: paleta (zero hex cru fora dos tokens em `app/` e `components/`), nenhuma outra tela com botão de logout duplicado do shell, telas de Admin/Supervisor não tocadas nesta sessão (`habilitacoes`, `parametros`, `supervisores`, `usuarios/[profileId]`) e as do Profissional mais antigas (`agenda`, `servicos`) já seguem o mesmo padrão de header/container — nenhuma mudança necessária nelas.

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo: `/notificacoes` com shell completo (Tutor); fila de incidentes do Admin mostrando "Comportamento inadequado da outra parte"/"Aberto" pro incidente novo e "pet machucado"/"atraso atendimento"/"duvida pagamento" (sem underscore) pros antigos; painel do Admin mostrando "Aguardando pagamento"/"Em conversa"/"Avaliação"/"Solicitação enviada" em vez do enum cru.

---

## 2026-09-01 — Iniciativa de CX: M-013 (hierarquia do detalhe da solicitação) + M-007 (preço "a partir de")

**Entrega:** fecha os dois últimos itens pendentes da iniciativa de CX (ver `Mapa_Melhorias` do inventário — M-001/M-002 já entregues antes).

**M-013 — Detalhe da solicitação:** a tela (`/solicitacoes/[requestId]`) acumulou 4 ondas de funcionalidades empilhadas com o mesmo peso visual — sem remover nada (Matriz_Responsiva: "Não fazer: remover histórico ou exceção"), duas mudanças de baixo risco:
- `lib/domain/request-status-copy.ts` (novo): frase em linguagem simples pra cada status, por papel de quem olha (ex.: "Você recebeu uma proposta — revise e decida." em vez de só o selo técnico "Proposta enviada"). O nome técnico do status continua existindo como selo pequeno ao lado — não foi substituído, só deixou de ser o único texto da tela.
- Histórico passa a vir recolhido por padrão (`<details>`) — continua tudo lá, só não compete mais visualmente com a ação atual.

**M-007 — Preço "a partir de":** em `/buscar` e `/profissional/[profissionalId]`, o preço de cada serviço passa a vir com "a partir de" acima do valor, sempre que há preço definido (não altera "Sob consulta") — o valor final sempre depende da proposta (pode ter adicionais), então a busca/perfil nunca deveriam sugerir um preço fechado. Sinais de confiança (nota, verificação) já apareciam perto do botão de ação no perfil — conferido, não precisou mudar.

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Testado ao vivo: hero de status mostrando a frase certa por papel (inclusive confirmando que uma conta com os dois papéis vê o texto certo conforme é tutor ou profissional *daquela* solicitação específica, não conforme o papel ativo da sessão); histórico fechado por padrão e expandindo corretamente ao clicar; "a partir de R$ 80"/"a partir de R$ 95" confirmados na busca e no perfil público.

---

## 2026-09-01 — Correção: logo sumindo na sidebar (contraste)

**Achado do usuário:** o logo ficava "esquisito" na sidebar do shell (M-002). Confirmado com dados: decodifiquei o PNG pixel a pixel e a pata do logo é `rgb(~0-6, 45-102, 61-117)` — quase idêntica ao teal da sidebar (`#0b4d52` = `rgb(11,77,82)`). A pata ficava praticamente invisível contra o próprio fundo, sobrando só o contorno verde com o coração branco recortado flutuando. O cabeçalho mobile não tinha esse problema (fundo branco, contraste já bom).

- `components/shell/app-shell.tsx`: logo da sidebar ganhou um chip branco arredondado por trás (`bg-white rounded-lg p-1`) — só ali, o cabeçalho mobile continua sem chip por já ter contraste correto.

**Verificação:** `tsc --noEmit`/`eslint .` limpos. Confirmado visualmente ao vivo no Profissional (desktop, 1280px).

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

## Pendências abertas ao final desta entrada — encerrada em 2026-09-02

Esta lista era do dia da primeira auditoria (2026-08-31) e parou de ser atualizada — virou uma segunda fonte de pendências desencontrada do `BACKLOG.md`. Auditada item a item nesta data; substituída pelas duas listas que já são a referência corrente do projeto.

- Resolvidos, sem pendência: achados de segurança `SECURITY DEFINER` (`0038`/`0039`), `search_path` de `distance_km`/`set_updated_at` (`0039`), RLS de Supervisor resolvendo incidente sozinho (`0034`), reagendamento de ocorrências (Onda 2, item 7 — resolvido diferente do texto original: qualquer parte reagenda pra qualquer horário, "nunca bloqueia a agenda", confirmado com o usuário), testes automatizados (60 checks — Vitest unidade+RLS e Playwright E2E, ver entradas de fase 1–4), branch `sync-pilar1-fixes` (já mergeada em `main`).
- Módulo financeiro/Pagar.me: virou a decisão de roadmap já registrada acima (Onda 3, fica pro final).
- Ainda em aberto, sem dono nesta lista: proteção contra senha vazada e o restante dos achados de segurança aceitos como risco — ver `BACKLOG.md`.
- Ainda em aberto, checklist de pré-lançamento (não bloqueiam o fechamento do Pilar 1, bloqueiam ir pra produção): Redirect URLs de produção no Supabase (depende do domínio final) e decisão sobre manter ou remover a rota `/dev-login` antes do go-live.
