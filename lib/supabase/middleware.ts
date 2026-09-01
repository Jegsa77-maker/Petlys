import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { CURRENT_TERMS_VERSION } from "@/lib/domain/terms";

const PUBLIC_PATHS = ["/login", "/callback", "/dev-login", "/redefinir-senha", "/confirmar-email"];
const SUSPENDED_PATH = "/conta-suspensa";

// Telas exclusivas de cada papel — uma conta com os dois papéis nunca vê
// as duas misturadas, só a do "papel ativo" escolhido em / (ver
// lib/actions/auth.ts:setActiveRole e app/page.tsx).
const TUTOR_ONLY_PREFIXES = ["/inicio", "/pets", "/buscar", "/profissional"];
const PROFISSIONAL_ONLY_PREFIXES = ["/dashboard", "/agenda", "/kanban", "/servicos", "/perfil"];
// Compartilhadas entre os dois papéis (o conteúdo muda conforme o papel
// ativo), mas exigem que a conta já tenha escolhido um papel quando tem
// os dois — sem isso não há como saber qual visão renderizar.
const ROLE_AWARE_SHARED_PREFIXES = ["/solicitacoes", "/notificacoes"];

/**
 * Resolve qual papel (tutor/profissional) está "ativo" nesta sessão:
 *  - Só um dos dois papéis -> esse é o ativo, sem ambiguidade.
 *  - Os dois -> depende do cookie `active_role` (escolhido em /); null
 *    enquanto a pessoa não escolher.
 *  - Nenhum dos dois (ex.: só administrador/supervisor) -> null.
 */
function resolveActiveRole(roleNames: string[], cookieValue: string | undefined) {
  const hasTutor = roleNames.includes("tutor");
  const hasProfissional = roleNames.includes("profissional");

  if (hasTutor && hasProfissional) {
    return cookieValue === "tutor" || cookieValue === "profissional" ? cookieValue : null;
  }
  if (hasTutor) return "tutor";
  if (hasProfissional) return "profissional";
  return null;
}

/**
 * Renova a sessão do Supabase a cada requisição e aplica o controle de
 * acesso por rota:
 *  - Sem sessão -> redireciona para /login (exceto rotas públicas).
 *  - Sessão sem telefone/e-mail verificado -> força /verificar-telefone
 *    (seção 2.1: conta só é considerada ativa após os dois).
 *  - Sessão sem nenhum papel escolhido -> força /escolher-perfil.
 *  - Rotas /admin e /supervisor exigem o papel correspondente.
 *  - Telas de Tutor/Profissional exigem que esse seja o papel ativo.
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
    // Checagem mais prioritária que tudo: conta com suspensão aprovada
    // não pode fazer mais nada no app, nem re-escolher um papel (ver
    // 0016_suspension_actually_blocks_access.sql — sem essa migration a
    // pessoa suspensa conseguia simplesmente escolher um papel novo e
    // voltar a ter acesso completo).
    if (path === SUSPENDED_PATH) {
      return response;
    }

    const { data: suspension } = await supabase
      .from("account_suspensions")
      .select("id")
      .eq("target_profile_id", user.id)
      .eq("status", "aprovada")
      .limit(1)
      .maybeSingle();

    if (suspension) {
      const url = request.nextUrl.clone();
      url.pathname = SUSPENDED_PATH;
      return NextResponse.redirect(url);
    }

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

    // Aceite versionado de Termos/Privacidade (seção 6.1) — obrigatório pra
    // qualquer conta (OAuth ou e-mail/senha), antes de escolher papel.
    // Sobe a versão em lib/domain/terms.ts força novo aceite de todo mundo.
    if (isVerified && path !== "/aceitar-termos") {
      const { data: acceptance } = await supabase
        .from("terms_acceptances")
        .select("profile_id")
        .eq("profile_id", user.id)
        .eq("version", CURRENT_TERMS_VERSION)
        .maybeSingle();

      if (!acceptance) {
        const url = request.nextUrl.clone();
        url.pathname = "/aceitar-termos";
        return NextResponse.redirect(url);
      }
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

      const activeRole = resolveActiveRole(roleNames, request.cookies.get("active_role")?.value);
      // Só entra na ambiguidade tutor/profissional quem realmente tem um
      // desses dois papéis. Admin/supervisor puro (ex.: entrando pelo link
      // "Entrar na conversa" da fila de incidentes) não passa por aqui —
      // a própria página resolve como "staff" (ver
      // app/(tutor)/solicitacoes/[requestId]/page.tsx).
      const hasSwitchableRole = roleNames.includes("tutor") || roleNames.includes("profissional");

      const isTutorOnly = TUTOR_ONLY_PREFIXES.some((p) => path.startsWith(p));
      const isProfissionalOnly = PROFISSIONAL_ONLY_PREFIXES.some((p) => path.startsWith(p));
      const isRoleAwareShared = ROLE_AWARE_SHARED_PREFIXES.some((p) => path.startsWith(p));

      if (
        (isTutorOnly && activeRole !== "tutor") ||
        (isProfissionalOnly && activeRole !== "profissional") ||
        (isRoleAwareShared && hasSwitchableRole && activeRole === null)
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
