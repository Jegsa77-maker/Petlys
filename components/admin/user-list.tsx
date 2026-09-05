"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Search } from "lucide-react";
import { CreateUserForm } from "@/components/admin/create-user-form";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  internalUsername: string | null;
  roles: { role: string; active: boolean }[];
};

const ROLE_LABEL: Record<string, string> = {
  tutor: "Tutor",
  profissional: "Profissional",
  administrador: "Administrador",
  supervisor: "Supervisor",
};

const ROLE_FILTERS = ["todos", "tutor", "profissional", "administrador", "supervisor"] as const;

/**
 * Tela de Usuários — reaproveitada por Admin (CRUD completo, `canCreate`)
 * e Supervisor (só ver/buscar, sem criar conta — pedido explícito do
 * usuário). Lista + busca ficam aqui; criar é um formulário próprio
 * (CreateUserForm); editar/bloquear/excluir vivem na página de detalhe
 * de cada usuário (`{basePath}/[profileId]`).
 */
export function UserList({
  users,
  basePath,
  canCreate = false,
}: {
  users: UserRow[];
  basePath: string;
  canCreate?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("todos");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === "todos" || u.roles.some((r) => r.role === roleFilter);
      const matchesQuery =
        q === "" ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.internalUsername ?? "").toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, query, roleFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou usuário"
              className="input pl-9"
            />
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:opacity-90 whitespace-nowrap"
            >
              <Plus size={16} /> Novo usuário
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                roleFilter === r ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
              }`}
            >
              {r === "todos" ? "Todos" : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {canCreate && showCreateForm && <CreateUserForm onCreated={() => setShowCreateForm(false)} />}

      <ul className="flex flex-col gap-2">
        {filtered.map((u) => {
          const isProfissionalAtivo = u.roles.some((r) => r.role === "profissional" && r.active);
          return (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4 hover:border-teal transition-colors"
            >
              <Link href={`${basePath}/${u.id}`} className="flex-1 min-w-0">
                <p className="font-semibold text-black truncate">{u.fullName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {u.internalUsername ? `@${u.internalUsername}` : u.email}
                </p>
              </Link>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-1">
                  {u.roles
                    .filter((r) => r.active)
                    .map((r) => (
                      <span
                        key={r.role}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal/10 text-teal capitalize"
                      >
                        {ROLE_LABEL[r.role] ?? r.role}
                      </span>
                    ))}
                  {u.roles.every((r) => !r.active) && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray text-gray-400">
                      Sem papel ativo
                    </span>
                  )}
                </div>

                {isProfissionalAtivo && (
                  <Link
                    href={`/profissional/${u.id}`}
                    target="_blank"
                    title="Ver perfil público"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-teal hover:text-teal"
                  >
                    <Eye size={14} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário encontrado com esses filtros.</p>
        )}
      </ul>
    </div>
  );
}
