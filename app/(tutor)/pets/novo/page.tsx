import { PetForm } from "@/components/pets/pet-form";

export default function NovoPetPage() {
  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Novo pet</h1>
        <p className="text-sm text-gray-600 mb-6">
          Etapa 1 de 5 — identificação. Estes dados são obrigatórios.
        </p>
        <PetForm />
      </div>
    </main>
  );
}
