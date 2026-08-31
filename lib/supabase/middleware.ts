import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login", "/callback"];

/**
 * Renova a sessão do Supabase a cada requisição e aplica o controle de
 * acesso por rota:
 *  - Sem sessão -> redireciona para /login (exceto rotas públicas).
 *  - Sessão sem telefone/e-mail verificado -> força /verificar-telefone
 *    (seção 2.1: conta só é considerada ativa após os dois).
 *  - Sessão sem nenhum papel escolhido -> força /escolher-perfil.
 *  - Rotas /admin e /supervisor exigem o papel correspondente.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_verified_at, email_verified_at")
      .eq("id", user.id)
      .single();

    const isVerified = !!profile?.phone_verified_at && !!profile?.email_verified_at;

    if (!isVerified && path !== "/verificar-telefone") {
      const url = request.nextUrl.clone();
      url.pathname = "/verificar-telefone";
      return NextResponse.redirect(url);
    }

    if (isVerified && path !== "/escolher-perfil") {
      const { data: roles } = await supabase
        .from("account_roles")
        .select("role")
        .eq("profile_id", user.id)
        .eq("active", true);

      if (!roles || roles.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = "/escolher-perfil";
        return NextResponse.redirect(url);
      }

      const roleNames = roles.map((r) => r.role);

      if (path.startsWith("/admin") && !roleNames.includes("administrador")) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }

      if (
        path.startsWith("/supervisor") &&
        !roleNames.includes("supervisor") &&
        !roleNames.includes("administrador")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
