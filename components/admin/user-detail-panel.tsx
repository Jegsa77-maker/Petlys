"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { setUserRoleActive, addUserRole, updateUserProfileByAdmin, deleteUserAccount } from "@/lib/actions/admin";
import { resetInternalPassword, blockAccount, unblockAccount } from "@/lib/actions/supervisor";
import { updateUserProfileSchema, adminSuspendAccountSchema } from "@/lib/validations/admin";
import { StaffChatPanel } from "@/components/admin/staff-chat-panel";
import type { AppRole } from "@/types/database";

const ROLE_LABEL: Record<AppRole, string> = {
  tutor: "Tutor",
  profissional: "Profissional",
  administrador: "Administrador",
  supervisor: "Supervisor",
};

const ALL_ROLES: AppRole[] = ["tutor", "profissional", "supervisor", "administrador"];

type Profile = { id: string; full_name: string; email: string; phone: string | null; internal_username: string | null };
type RoleRow = { role: AppRole; active: boolean };
type SuspensionRow = { id: string; status: string; reason: string; created_at: string; decided_at: string | null };
type ChatMessage = { id: string; senderId: string; senderName: string; content: string; createdAt: string };

/**
 * Detalhe de um usuário na tela de Usuários — usado tanto pelo Admin
 * (`variant="admin"`: CRUD completo — editar perfil, papéis, senha,
 * bloqueio e exclusão) quanto pelo Supervisor (`variant="supervisor"`:
 * ver, bloquear/desbloquear, redefinir senha, ver perfil e chat — sem
 * editar papéis nem excluir, pedido explícito do usuário).
 */
export function UserDetailPanel({
  profile,
  roles,
  suspensions,
  isSelf,
  variant,
  currentUserId,
  chatMessages,
}: {
  profile: Profile;
  roles: RoleRow[];
  suspensions: SuspensionRow[];
  isSelf: boolean;
  variant: "admin" | "supervisor";
  currentUserId: string;
  chatMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const isAdmin = variant === "admin";
  const activeRoles = new Set(roles.filter((r) => r.active).map((r) => r.role));
  const rolesHeld = new Set(roles.map((r) => r.role));
  const isTargetAdmin = activeRoles.has("administrador");
  const currentSuspension = suspensions.find((s) => s.status === "aprovada");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = updateUserProfileSchema.safeParse({ profileId: profile.id, fullName, phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateUserProfileByAdmin(parsed.data);
      if (result?.error) setError(result.error);
      else router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleRole(role: AppRole, active: boolean) {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await setUserRoleActive(profile.id, role, active);
      if (result?.error) setError(result.error);
      else router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddRole(role: AppRole) {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await addUserRole(profile.id, role);
      if (result?.error) setError(result.error);
      else router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await resetInternalPassword(profile.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTempPassword(result.temporaryPassword ?? null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = adminSuspendAccountSchema.safeParse({ targetProfileId: profile.id, reason: suspendReason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Descreva o motivo");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await blockAccount(parsed.data);
      if (result?.error) setError(result.error);
      else router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnblock() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await unblockAccount(profile.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await deleteUserAccount(profile.id);
      if (result?.error) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      setDeleted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (deleted) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-black">
          Conta excluída — dados pessoais removidos e acesso bloqueado permanentemente. O histórico compartilhado
          com outras contas (solicitações, mensagens, avaliações) continua intacto.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isSelf && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Esta é a sua própria conta — algumas ações (bloquear, excluir, desativar seu próprio papel de
          Administrador) ficam bloqueadas por segurança.
        </div>
      )}

      {currentSuspension && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          <strong>Conta bloqueada.</strong> {currentSuspension.reason}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-black">Perfil</p>
          {activeRoles.has("profissional") && (
            <Link
              href={`/profissional/${profile.id}`}
              target="_blank"
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <Eye size={14} /> Ver perfil público
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-500">{profile.internal_username ? `@${profile.internal_username}` : profile.email}</p>

        {isAdmin ? (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="input" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="input" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="self-start rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Salvar
            </button>
          </form>
        ) : (
          <div>
            <p className="text-sm font-semibold text-black">{profile.full_name}</p>
            {profile.phone && <p className="text-xs text-gray-500">{profile.phone}</p>}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black">Papéis</p>
          <div className="flex flex-col gap-2">
            {ALL_ROLES.map((role) => {
              const held = rolesHeld.has(role);
              const active = activeRoles.has(role);
              const selfAdminLock = isSelf && role === "administrador";
              return (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm text-black">{ROLE_LABEL[role]}</span>
                  {held ? (
                    <button
                      type="button"
                      onClick={() => handleToggleRole(role, !active)}
                      disabled={isSubmitting || (active && selfAdminLock)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg disabled:opacity-40 ${
                        active ? "border border-gray-300 text-gray-600 hover:bg-gray-50" : "bg-teal text-white hover:opacity-90"
                      }`}
                    >
                      {active ? "Desativar" : "Ativar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddRole(role)}
                      disabled={isSubmitting}
                      className="text-xs font-semibold px-3 py-1 rounded-lg border border-teal text-teal hover:bg-teal/5 disabled:opacity-40"
                    >
                      Conceder
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {isTargetAdmin && (
            <p className="text-[11px] text-gray-400">
              O último Administrador ativo do sistema não pode ser desativado nem excluído.
            </p>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black">Papéis</p>
          <div className="flex gap-1">
            {roles
              .filter((r) => r.active)
              .map((r) => (
                <span key={r.role} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal/10 text-teal capitalize">
                  {ROLE_LABEL[r.role]}
                </span>
              ))}
            {roles.every((r) => !r.active) && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray text-gray-400">Sem papel ativo</span>
            )}
          </div>
        </div>
      )}

      {profile.internal_username && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black mb-2">Redefinir senha</p>
          {tempPassword ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">
                Senha temporária gerada — mostrada só uma vez, repasse por um canal seguro:
              </p>
              <p className="font-mono text-sm bg-gray px-3 py-2 rounded-lg text-black">{tempPassword}</p>
            </div>
          ) : (
            <button
              onClick={handleResetPassword}
              disabled={isSubmitting}
              className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
            >
              Gerar nova senha
            </button>
          )}
        </div>
      )}

      {!isSelf && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black mb-2">{currentSuspension ? "Bloqueio" : "Bloquear conta"}</p>
          {currentSuspension ? (
            <button
              onClick={handleUnblock}
              disabled={isSubmitting}
              className="text-xs font-semibold rounded-lg bg-teal text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? "Desbloqueando..." : "Desbloquear conta"}
            </button>
          ) : !showSuspendForm ? (
            <button
              onClick={() => setShowSuspendForm(true)}
              className="text-xs font-semibold rounded-lg border border-red-300 text-red-600 px-3 py-2 hover:bg-red-50"
            >
              Bloquear conta
            </button>
          ) : (
            <form onSubmit={handleBlock} className="flex flex-col gap-2">
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Motivo do bloqueio"
                rows={2}
                className="input text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs font-semibold rounded-lg bg-red-600 text-white px-3 py-2 hover:opacity-90 disabled:opacity-60"
                >
                  Bloquear
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuspendForm(false)}
                  className="text-xs font-semibold rounded-lg border border-gray-300 px-3 py-2 text-black"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!isSelf && (
        <StaffChatPanel targetProfileId={profile.id} currentUserId={currentUserId} messages={chatMessages} />
      )}

      {isAdmin && !isSelf && (
        <div className="rounded-lg border border-red-200 bg-white p-4">
          <p className="text-sm font-semibold text-black mb-2">Excluir conta</p>
          <p className="text-xs text-gray-500 mb-2">
            Remove nome, e-mail, telefone e CPF/CNPJ (vira &quot;Usuário removido&quot;) e bloqueia o acesso pra
            sempre. Solicitações, mensagens e avaliações compartilhadas com outras contas continuam existindo.
            Bloqueado se houver pagamento ou repasse pendente.
          </p>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 text-xs font-semibold rounded-lg border border-red-300 text-red-600 px-3 py-2 hover:bg-red-50"
            >
              <Trash2 size={14} /> Excluir conta
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-black">Tem certeza? Essa ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? "Excluindo..." : "Confirmar exclusão"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
