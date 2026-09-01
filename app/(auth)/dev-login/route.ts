import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rota temporária apenas para desenvolvimento local: estabelece uma sessão
 * a partir de um access_token/refresh_token já emitidos (ex.: magic link
 * gerado via Admin API), sem depender do fluxo OAuth. Não usar em produção.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams, origin } = new URL(request.url);
  const access_token = searchParams.get("access_token");
  const refresh_token = searchParams.get("refresh_token");

  if (!access_token || !refresh_token) {
    return NextResponse.redirect(`${origin}/login?erro=falha_no_login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=falha_no_login`);
  }

  return NextResponse.redirect(`${origin}/`);
}
