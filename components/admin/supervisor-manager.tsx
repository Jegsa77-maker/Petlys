"use client";

import { useState } from "react";
import { createSupervisor, revokeSupervisor } from "@/lib/actions/admin";
import { createSupervisorSchema } from "@/lib/validations/admin";
import { PasswordInput } from "@/components/shared/password-input";

export function CreateSupervisorForm() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = createSupervisorSchema.safeParse({ fullName, username, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createSupervisor(parsed.data);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(`Conta criada. Usuário de login: ${username}`);
      setFullName("");
      setUsername("");
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-black">Nova conta de Supervisor</p>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="input" />
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário (mais de 5 caracteres)" className="input" />
      <PasswordInput value={password} onChange={setPassword} placeholder="Senha (mín. 8 caracteres)" className="input" />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {success && <p className="text-sm text-black bg-green px-3 py-2 rounded-lg">{success}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Criando..." : "Criar conta"}
      </button>
    </form>
  );
}

type Supervisor = { profile_id: string; full_name: string; internal_username: string | null };

export function SupervisorList({ supervisors }: { supervisors: Supervisor[] }) {
  const [items, setItems] = useState(supervisors);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  async function handleRevoke(profileId: string) {
    setIsSubmitting(profileId);
    await revokeSupervisor(profileId);
    setIsSubmitting(null);
    setItems((prev) => prev.filter((s) => s.profile_id !== profileId));
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum Supervisor cadastrado ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => (
        <li
          key={s.profile_id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
        >
          <div>
            <p className="text-sm font-semibold text-black">{s.full_name}</p>
            <p className="text-xs text-gray-500">@{s.internal_username}</p>
          </div>
          <button
            onClick={() => handleRevoke(s.profile_id)}
            disabled={isSubmitting === s.profile_id}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Revogar
          </button>
        </li>
      ))}
    </ul>
  );
}
