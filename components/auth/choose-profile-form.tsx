"use client";

import { useState } from "react";
import { chooseProfile } from "@/lib/actions/auth";
import { chooseProfileSchema } from "@/lib/validations/auth";

type Role = "tutor" | "profissional";

export function ChooseProfileForm({
  existingRoles = [],
  existingBirthDate = "",
  existingCpfCnpj = "",
}: {
  existingRoles?: Role[];
  existingBirthDate?: string;
  existingCpfCnpj?: string;
}) {
  const [roles, setRoles] = useState<Role[]>(existingRoles);
  const [birthDate, setBirthDate] = useState(existingBirthDate);
  const [cpfCnpj, setCpfCnpj] = useState(existingCpfCnpj);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleRole(role: Role) {
    if (existingRoles.includes(role)) return; // já tem esse papel, não dá pra desmarcar aqui
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = chooseProfileSchema.safeParse({
      roles,
      birthDate,
      cpfCnpj: roles.includes("profissional") ? cpfCnpj : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    setIsSubmitting(true);
    const result = await chooseProfile(parsed.data);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    }
    // Sucesso: chooseProfile já redireciona para /inicio.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <p className="block text-sm font-medium text-black mb-2">
          Como você quer usar a plataforma? (pode escolher os dois)
        </p>
        <div className="flex flex-col gap-2">
          {(["tutor", "profissional"] as const).map((role) => {
            const isLocked = existingRoles.includes(role);
            return (
              <label
                key={role}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors
                  ${roles.includes(role) ? "border-teal bg-teal/5" : "border-gray-300"}
                  ${isLocked ? "cursor-default opacity-70" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  disabled={isLocked}
                  className="h-4 w-4 accent-teal"
                />
                <span className="text-sm font-medium text-black">
                  {role === "tutor" ? "Tutor — quero contratar serviços pet" : "Profissional — quero oferecer serviços pet"}
                  {isLocked && " (já é seu)"}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="birthDate" className="block text-sm font-medium text-black mb-1">
          Data de nascimento
        </label>
        <input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base
                     focus:outline-none focus:ring-2 focus:ring-teal"
        />
        <p className="text-xs text-gray-500 mt-1">É preciso ter 18 anos ou mais.</p>
      </div>

      {roles.includes("profissional") && (
        <div>
          <label htmlFor="cpfCnpj" className="block text-sm font-medium text-black mb-1">
            CPF ou CNPJ
          </label>
          <input
            id="cpfCnpj"
            type="text"
            inputMode="numeric"
            placeholder="Só números"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base
                       focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <p className="text-xs text-gray-500 mt-1">
            Necessário para futuramente receber pagamentos pela plataforma.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || roles.length === 0}
        className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white
                   hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {isSubmitting ? "Salvando..." : "Continuar"}
      </button>
    </form>
  );
}
