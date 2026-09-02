-- ============================================================================
-- 0040_conversation_protection.sql
-- Onda 6 — proteção de conversa (seção 2.4 da Especificação v2.0), discutida
-- e desenhada com o usuário em 2026-09-02. Objetivo: resguardar a plataforma
-- contra combinação por fora (perda de comissão) e contra conteúdo impróprio
-- no chat — sem bloquear o envio (evita frustrar falso positivo) e sem punir
-- sozinho: a mensagem nasce marcada em `messages.flagged_reason` (coluna que
-- já existia desde 0004, reservada exatamente pra isso) e cai na MESMA fila
-- de moderação da Onda 4 — revisão humana do Admin/Supervisor antes de
-- qualquer ação, exatamente como a Especificação pede.
--
-- Duas categorias, tratadas com abordagens diferentes:
--   1. Contato/dado sensível (telefone, e-mail, CPF, frases de evasão) —
--      detecção por padrão (regex), alta precisão, zero custo por mensagem.
--   2. Conteúdo impróprio — lista de palavras curada (não IA): mais barato
--      e mais previsível que um classificador, ao custo de não pegar tudo.
--      Lista inicial (v1), não exaustiva — feita pra pegar o óbvio e
--      complementar (não substituir) a sinalização manual que já existe.
-- ============================================================================

create or replace function public.auto_flag_suspicious_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lower text := lower(new.content);
  v_reason text;
begin
  -- Telefone (com/sem DDI 55, com/sem separador, com/sem o 9º dígito)
  if new.content ~ '(\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}' then
    v_reason := 'Automático: possível número de telefone na mensagem';

  -- E-mail
  elsif new.content ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    v_reason := 'Automático: possível e-mail na mensagem';

  -- CPF (11 dígitos, com ou sem pontuação)
  elsif new.content ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' then
    v_reason := 'Automático: possível CPF ou dado sensível na mensagem';

  -- Frases de evasão pra fora da plataforma (redes sociais, "por fora")
  elsif v_lower ~ '(whatsapp|whats ?app|zap ?zap|meu zap|te chamo no zap|instagram|insta:|fora da plataforma|por fora|fora do app|me chama no|te chamo no|passa (seu|teu) (numero|n[uú]mero|whats|zap))' then
    v_reason := 'Automático: possível tentativa de combinar fora da plataforma';

  -- Conteúdo impróprio — lista curada v1 (ofensas, discriminação, assédio,
  -- ameaça); \y = fronteira de palavra no Postgres, evita casar substring
  -- dentro de outra palavra (ex.: não confunde "cu" com "curioso").
  elsif v_lower ~ '\y(idiota|imbecil|est[uú]pido|retardado|otario|otário|babaca|escroto|desgraçado|canalha|vagabund[ao]|safad[ao]|vadia|piranha|corno|merda|porra|caralho|foda-se|puta|cacete|bosta|fdp|arrombado|viad[oi]nho|mongol[oó]ide|manda (foto|nudes)|nudes|quero te|tes[aã]o|vou te pegar|vou te achar|vai se arrepender|sei onde voc[eê] mora)\y' then
    v_reason := 'Automático: possível conteúdo impróprio';
  end if;

  if v_reason is not null then
    new.flagged_reason := v_reason;
    new.flagged_at := now();
  end if;

  return new;
end;
$$;

create trigger messages_auto_flag
  before insert on public.messages
  for each row execute function public.auto_flag_suspicious_message();

-- Nunca precisa ser chamada direto — só via trigger (mesmo raciocínio de
-- 0038/0039_fix_security_hardening_grants.sql).
revoke execute on function public.auto_flag_suspicious_message() from anon, authenticated;
