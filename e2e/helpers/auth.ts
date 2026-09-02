import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Loga o `page` do Playwright como `email` via /dev-login (rota que só
 * existe fora de produção, ver app/(auth)/dev-login/route.ts) — evita
 * depender do fluxo real de OTP/OAuth, que não dá pra automatizar sem
 * SMS/provedor social de verdade. Mesma técnica usada nos testes de RLS
 * (tests/rls/helpers.ts) e manualmente a sessão inteira.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(url, serviceKey);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.email_otp) {
    throw new Error(`generateLink falhou pra ${email}: ${linkError?.message}`);
  }

  const anon = createClient(url, anonKey);
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError || !verifyData.session) {
    throw new Error(`verifyOtp falhou pra ${email}: ${verifyError?.message}`);
  }

  const { access_token, refresh_token } = verifyData.session;
  await page.goto(
    `/dev-login?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`
  );
}
