import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Lê/escreve cookies de sessão via next/headers.
 *
 * Next.js 15+/16 tornou cookies() assíncrono — por isso esta função também é.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll chamado a partir de um Server Component (sem permissão
            // de escrita). Ignorado com segurança: o middleware garante a
            // renovação de sessão nesses casos.
          }
        },
      },
    }
  );
}

/**
 * Cliente com service_role — só para uso em Server Actions que precisam
 * ignorar RLS de propósito (ex.: liberar payout após validação de negócio).
 * NUNCA importar este arquivo em código que roda no browser.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          /* service_role não usa sessão de cookie */
        },
      },
    }
  );
}
