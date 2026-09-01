import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Inbox, RotateCcw } from "lucide-react";
import { REQUEST_STATUS_LABEL as STATUS_LABEL } from "@/lib/domain/request-status-labels";

export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id)
    .eq("active", true);

  const roleNames = (roles ?? []).map((r) => r.role);
  const cookieStore = await cookies();
  const activeRoleCookie = cookieStore.get("active_role")?.value;
  // Contas com um só papel não têm ambiguidade; com os dois, o middleware
  // já garante que o cookie está setado antes de chegar aqui (ver
  // lib/supabase/middleware.ts — rota está em ROLE_AWARE_SHARED_PREFIXES).
  const viewAsProfessional = roleNames.includes("profissional")
    ? !roleNames.includes("tutor") || activeRoleCookie === "profissional"
    : false;

  if (viewAsProfessional) {
    const { data: requests } = await supabase
      .from("requests")
      .select("id, category, status, created_at, request_pets(pets(name))")
      .eq("professional_id", user.id)
      .in("status", ["solicitacao_enviada", "em_conversa", "proposta_enviada", "aguardando_pagamento"])
      .order("created_at", { ascending: false });

    return (
      <main className="min-h-screen bg-offwhite px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-teal mb-6">Solicitações</h1>

          {!requests || requests.length === 0 ? (
            <EmptyState text="Nenhuma solicitação pendente no momento." />
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((request) => {
                const petNames = (request.request_pets ?? [])
                  .map((rp) => rp.pets?.name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li key={request.id}>
                    <Link
                      href={`/solicitacoes/${request.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-black text-sm">{petNames || "Solicitação"}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full">
                        {STATUS_LABEL[request.status] ?? request.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    );
  }

  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, category, status, created_at, professional_id, profiles!requests_professional_id_fkey(full_name), request_pets(pets(name))"
    )
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-6">Minhas solicitações</h1>

        {!requests || requests.length === 0 ? (
          <EmptyState text="Você ainda não fez nenhuma solicitação." />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => {
              const petNames = (request.request_pets ?? [])
                .map((rp) => rp.pets?.name)
                .filter(Boolean)
                .join(", ");
              const isFinished = ["concluido", "avaliacao", "cancelado", "recusado", "expirado"].includes(
                request.status
              );
              return (
                <li key={request.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <Link href={`/solicitacoes/${request.id}`} className="block mb-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-black text-sm">{petNames || "Solicitação"}</p>
                      <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full">
                        {STATUS_LABEL[request.status] ?? request.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {request.profiles?.full_name} · {new Date(request.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </Link>
                  {isFinished && (
                    <Link
                      href={`/solicitacoes/nova?profissional=${request.professional_id}`}
                      className="flex items-center gap-1 text-xs text-teal font-semibold hover:underline w-fit"
                    >
                      <RotateCcw size={12} /> Contratar novamente
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <Inbox size={40} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
