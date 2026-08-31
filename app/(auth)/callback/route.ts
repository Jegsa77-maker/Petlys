import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Callback do OAuth (Google/Facebook). Troca o `code` retornado pelo
 * provedor por uma sessão Supabase válida e redireciona o usuário para
 * o próximo passo — o middleware (lib/supabase/middleware.ts) decide se
 * isso é /verificar-telefone, /escolher-perfil ou /inicio.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=falha_no_login`);
}
