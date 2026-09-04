alter table public.requests
  add column referred_professional_id uuid references public.profiles (id);

comment on column public.requests.referred_professional_id is
  'Preenchido quando o Profissional recusa/cancela e indica um colega da mesma categoria (itens 25-26 e 29). O Tutor decide se aceita via acceptReferral — nunca é aplicado automaticamente em professional_id (a RLS de requests_update não tem WITH CHECK, então a trava é 100% de desenho: nunca fazer update de professional_id numa request existente, sempre criar uma nova).';

-- origin_request_id existe desde 0012 mas nunca teve índice — passa a ser
-- consultado ativamente agora (indicação e substituição encadeiam por ele).
create index requests_origin_request_id_idx on public.requests (origin_request_id) where origin_request_id is not null;
create index requests_referred_professional_idx on public.requests (referred_professional_id) where referred_professional_id is not null;
