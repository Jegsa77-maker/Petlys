"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserByAdmin } from "@/lib/actions/admin";
import { createUserByAdminSchema } from "@/lib/validations/admin";
import { PasswordInput } from "@/components/shared/password-input";
import type { AppRole } from "@/types/database";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "tutor", label: "Tutor" },
  { value: "profissional", label: "Profissional" },
  { value: "supervisor", label: "Supervisor" },
  { value: "administrador", label: "Administrador" },
];

/**
 * Cria uma conta de qualquer papel direto pelo Admin (createUserByAdmin) —
 * mesmo mecanismo de usuário+senha interno já usado só pra Supervisor,
 * generalizado pra qualquer um dos 4 papéis.
 */
export function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("tutor");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createUserByAdminSchema.safeParse({ fullName, username, password, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createUserByAdmin(parsed.data);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-semibold text-black">Nova conta</p>

      <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="input">
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="input" />
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Usuário (mais de 5 caracteres)"
        className="input"
      />
      <PasswordInput value={password} onChange={setPassword} placeholder="Senha (mín. 8 caracteres)" />

      <p className="text-xs text-gray-500">
        Conta interna (usuário/senha, sem e-mail real) — mesmo tipo já usado pra Supervisor. A pessoa entra digitando
        esse usuário na tela de login.
      </p>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

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
