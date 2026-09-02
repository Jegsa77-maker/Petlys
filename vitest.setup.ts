// Carrega .env.local pros testes de RLS (tests/rls/**) terem acesso a
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SUPABASE_SERVICE_ROLE_KEY — os
// mesmos nomes já usados por lib/supabase/server.ts. Em CI, as
// variáveis viriam de secret do GitHub Actions, sem arquivo nenhum —
// por isso o try/catch, não é erro faltar o arquivo.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local (ex.: CI) — assume que as env vars já vieram de outro lugar.
}
