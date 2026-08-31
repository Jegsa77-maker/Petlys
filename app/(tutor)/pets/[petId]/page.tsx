import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PawPrint } from "lucide-react";
import { CoTutorsSection } from "@/components/pets/co-tutors-section";

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const supabase = await createClient();

  const { data: pet } = await supabase.from("pets").select("*").eq("id", petId).single();

  if (!pet) {
    notFound();
  }

  const { data: tutorLinks } = await supabase
    .from("pet_tutors")
    .select("tutor_profile_id, profiles(full_name)")
    .eq("pet_id", petId);

  const tutors = (tutorLinks ?? [])
    .filter((t) => t.profiles)
    .map((t) => ({ tutor_profile_id: t.tutor_profile_id, full_name: t.profiles!.full_name }));

  const healthFilled = Object.keys(pet.health_info ?? {}).length > 0;
  const behaviorFilled = Object.keys(pet.behavior_info ?? {}).length > 0;

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gray flex items-center justify-center overflow-hidden shrink-0">
            {pet.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
            ) : (
              <PawPrint size={28} className="text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">{pet.name}</h1>
            <p className="text-sm text-gray-500">
              {pet.species} · {pet.breed} · {pet.sex === "femea" ? "Fêmea" : "Macho"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <InfoCard label="Porte" value={pet.size ?? "—"} />
          <InfoCard label="Peso" value={pet.weight ? `${pet.weight} kg` : "—"} />
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <ProgressRow label="Saúde" done={healthFilled} />
          <ProgressRow label="Comportamento" done={behaviorFilled} />
        </div>

        <CoTutorsSection petId={pet.id} tutors={tutors} />

        <p className="text-xs text-gray-500 mt-6">
          As etapas de saúde, comportamento, rotina e emergência são
          opcionais para começar, mas algumas categorias de serviço podem
          pedir informações específicas antes de você enviar uma solicitação.
        </p>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-black capitalize">{value}</p>
    </div>
  );
}

function ProgressRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <span className="text-sm text-black">{label}</span>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          done ? "text-black bg-green" : "text-gray-400 bg-gray"
        }`}
      >
        {done ? "Preenchido" : "Pendente"}
      </span>
    </div>
  );
}
