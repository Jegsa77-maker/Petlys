"use client";

import { useState } from "react";
import { inviteCoTutorByEmail } from "@/lib/actions/pets";
import { UserPlus } from "lucide-react";

type Tutor = { tutor_profile_id: string; full_name: string };

export function CoTutorsSection({ petId, tutors }: { petId: string; tutors: Tutor[] }) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await inviteCoTutorByEmail(petId, email);
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setEmail("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-black">Tutores vinculados</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-teal font-semibold hover:underline"
        >
          <UserPlus size={14} /> Adicionar
        </button>
      </div>

      <ul className="flex flex-col gap-2 mb-2">
        {tutors.map((t) => (
          <li
            key={t.tutor_profile_id}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-black"
          >
            {t.full_name}
          </li>
        ))}
      </ul>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            A pessoa precisa já ter uma conta na plataforma com esse e-mail.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail do co-tutor"
            className="input"
          />
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          {success && <p className="text-xs text-teal">Co-tutor adicionado.</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Adicionando..." : "Adicionar co-tutor"}
          </button>
        </form>
      )}
    </div>
  );
}
