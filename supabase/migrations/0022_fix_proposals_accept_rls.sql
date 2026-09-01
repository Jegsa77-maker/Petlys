-- ============================================================================
-- 0022_fix_proposals_accept_rls.sql
-- Corrige bug pré-existente: `proposals` nunca teve política de UPDATE.
-- Com RLS habilitado e nenhuma política pra UPDATE, o Postgres nega por
-- padrão — `acceptProposal` (lib/actions/requests.ts) sempre atualizava
-- ZERO linhas quando o Tutor aceitava: `requests.status` avançava pra
-- 'aguardando_pagamento' normalmente, mas `proposals.accepted_at` nunca
-- era gravado de fato. Descoberto ao testar a agenda flexível (0021),
-- que depende de ler `proposed_scheduled_at` logo após o accept.
--
-- A restrição de que só `accepted_at` pode ser tocado (não preço/escopo)
-- fica por conta da aplicação, não da RLS — mesmo padrão já usado em
-- reviews_update_response (0009_rls_policies.sql).
-- ============================================================================

create policy proposals_update_accept on public.proposals
  for update using (
    exists (
      select 1 from public.requests r
      where r.id = proposals.request_id and r.tutor_id = auth.uid()
    )
  );

-- RLS só filtra LINHAS — sem isso, a policy acima deixaria o Tutor alterar
-- qualquer coluna da proposta via API direta (inclusive price/scope), não
-- só accepted_at. Restringe em nível de coluna, complementando a RLS.
revoke update on public.proposals from authenticated;
grant update (accepted_at) on public.proposals to authenticated;
