import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, PawPrint } from "lucide-react";

export default async function PetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: petLinks } = user
    ? await supabase
        .from("pet_tutors")
        .select("pet_id, pets(id, name, species, breed, photo_url)")
        .eq("tutor_profile_id", user.id)
    : { data: null };

  const pets = (petLinks ?? [])
    .map((link) => link.pets)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-teal">Meus pets</h1>
          <Link
            href="/pets/novo"
            className="flex items-center gap-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={16} /> Novo pet
          </Link>
        </div>

        {pets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <PawPrint size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Você ainda não cadastrou nenhum pet.</p>
            <Link href="/pets/novo" className="text-teal text-sm font-semibold underline underline-offset-2">
              Cadastrar o primeiro pet
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pets.map((pet) => (
              <li key={pet.id}>
                <Link
                  href={`/pets/${pet.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-teal transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-gray flex items-center justify-center overflow-hidden shrink-0">
                    {pet.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                    ) : (
                      <PawPrint size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-black">{pet.name}</p>
                    <p className="text-xs text-gray-500">
                      {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
