"use client";

import { useState } from "react";
import { inviteCoTutorByEmail } from "@/lib/actions/pets";
import { UserPlus, Clock } from "lucide-react";

type Tutor = { tutor_profile_id: string; full_name: string };
type PendingInvite = { id: string; invited_email: string };

export function CoTutorsSection({
  petId,
  tutors,
  pendingInvites,
}: {
  petId: string;
  tutors: Tutor[];
  pendingInvites: PendingInvite[];
}) {
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
        {pendingInvites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-500"
          >
            <Clock size={14} className="shrink-0" />
            {inv.invited_email} — convite enviado, aguardando cadastro
          </li>
        ))}
      </ul>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            Se a pessoa já tem conta na Petlys, ela é vinculada na hora. Se não tiver,
            enviamos um convite por e-mail pra ela criar a conta e virar co-tutora automaticamente.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail do co-tutor"
            className="input"
          />
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          {success && <p className="text-xs text-teal">Convite enviado.</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Adicionar co-tutor"}
          </button>
        </form>
      )}
    </div>
  );
}
