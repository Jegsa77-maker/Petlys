-- Chat direto entre Tutor e Profissional antes de existir uma solicitação
-- formal — reaproveita requests/messages (mesmo padrão de is_visita_inicial),
-- nenhuma policy/trigger nova precisa: is_party_of_request() não olha status,
-- enforce_and_log_status_transition() já permite rascunho->cancelado (0012),
-- auto_flag_suspicious_message() (0040) é agnóstica a request_id.

alter table public.requests
  add column is_conversa_previa boolean not null default false;

comment on column public.requests.is_conversa_previa is
  'true quando este rascunho nasceu do botão "Conversar" (chat livre antes de
   formalizar uma solicitação completa) — diferencia de um rascunho comum
   abandonado no meio do formulário completo (createRequest), que nunca deve
   aparecer em lista nem contar como pendente.';

-- No máximo uma conversa-rascunho aberta por par (tutor, profissional) por vez.
create unique index requests_one_open_prechat_idx
  on public.requests (tutor_id, professional_id)
  where status = 'rascunho' and is_conversa_previa;
