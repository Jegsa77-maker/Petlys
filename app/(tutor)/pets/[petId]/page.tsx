import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PawPrint } from "lucide-react";
import { CoTutorsSection } from "@/components/pets/co-tutors-section";
import { PetMediaSection } from "@/components/pets/pet-media-section";
import { PetProfileSection, type FieldDef } from "@/components/pets/pet-profile-section";
import {
  updatePetHealth,
  updatePetBehavior,
  updatePetRoutine,
  updatePetEmergency,
} from "@/lib/actions/pets";
import { prontuarioStalenessLabel } from "@/lib/domain/pet-prontuario-freshness";

const HEALTH_FIELDS: FieldDef[] = [
  { key: "veterinario", label: "Veterinário de referência" },
  { key: "clinica", label: "Clínica" },
  { key: "vacinas", label: "Vacinas em dia (quais e quando)", type: "textarea" },
  { key: "alergias", label: "Alergias", type: "textarea" },
  { key: "restricoes", label: "Restrições alimentares ou físicas", type: "textarea" },
  { key: "condicoes", label: "Condições de saúde conhecidas", type: "textarea" },
  { key: "medicamentos", label: "Medicamentos em uso", type: "textarea" },
  { key: "dosagemHorarios", label: "Dosagem e horários", type: "textarea" },
];

const BEHAVIOR_FIELDS: FieldDef[] = [
  { key: "temperamento", label: "Temperamento", type: "textarea" },
  { key: "interacaoPessoas", label: "Interação com pessoas", type: "textarea" },
  { key: "interacaoAnimais", label: "Interação com outros animais", type: "textarea" },
  { key: "medos", label: "Medos", type: "textarea" },
  { key: "agressividade", label: "Agressividade (quando ocorre)", type: "textarea" },
  { key: "fuga", label: "Tendência a fugir", type: "textarea" },
  { key: "usaGuia", label: "Usa guia/coleira?" },
  { key: "comportamentoNoCarro", label: "Comportamento no carro", type: "textarea" },
  { key: "gatilhos", label: "Gatilhos a evitar", type: "textarea" },
];

const ROUTINE_FIELDS: FieldDef[] = [
  { key: "alimentacao", label: "Alimentação", type: "textarea" },
  { key: "agua", label: "Água" },
  { key: "higiene", label: "Higiene", type: "textarea" },
  { key: "passeios", label: "Passeios", type: "textarea" },
  { key: "sono", label: "Sono", type: "textarea" },
  { key: "comandos", label: "Comandos que conhece", type: "textarea" },
  { key: "objetosPreferidos", label: "Objetos preferidos" },
  { key: "outrasPreferencias", label: "Outras preferências", type: "textarea" },
];

const EMERGENCY_FIELDS: FieldDef[] = [
  { key: "contatoEmergenciaNome", label: "Nome do contato de emergência" },
  { key: "contatoEmergenciaTelefone", label: "Telefone do contato de emergência" },
  {
    key: "limitesDecisao",
    label: "O que o profissional pode decidir sozinho numa emergência",
    type: "textarea",
  },
  { key: "autorizaTransporte", label: "Autorizo transporte do pet em caso de emergência", type: "checkbox" },
  {
    key: "autorizaAcessoResidencia",
    label: "Autorizo acesso à residência quando necessário",
    type: "checkbox",
  },
  { key: "ondeFicamChaves", label: "Onde ficam as chaves (se aplicável)" },
  { key: "outrosConsentimentos", label: "Outros consentimentos", type: "textarea" },
];

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

  // RPC em vez de join direto em profiles: profiles_select (0009) só
  // libera o próprio perfil ou Admin/Supervisor — um co-tutor nunca lia o
  // nome do outro, cada um só via a si mesmo na lista (bug encontrado ao
  // testar o convite de co-tutor, corrigido em
  // 0037_fix_co_tutor_name_visibility.sql). A função SECURITY DEFINER só
  // devolve nome, nunca e-mail/telefone/cpf do outro tutor.
  const { data: tutors } = await supabase.rpc("get_pet_co_tutor_names", { p_pet_id: petId });

  const { data: pendingInvites } = await supabase
    .from("pet_co_tutor_invites")
    .select("id, invited_email")
    .eq("pet_id", petId)
    .eq("status", "pendente");

  const stalenessLabel = prontuarioStalenessLabel(pet);

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

        <div className="mb-6">
          <PetMediaSection petId={pet.id} photoUrl={pet.photo_url} documentUrl={pet.document_url} />
        </div>

        {stalenessLabel && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 mb-4 text-xs text-amber-800">
            <strong>Revise o prontuário</strong> — {stalenessLabel}. Confirme se saúde,
            comportamento e rotina ainda refletem a realidade do {pet.name}.
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <PetProfileSection
            petId={pet.id}
            title="Saúde"
            fields={HEALTH_FIELDS}
            initialValues={(pet.health_info ?? {}) as Record<string, unknown>}
            onSave={updatePetHealth}
          />
          <PetProfileSection
            petId={pet.id}
            title="Comportamento"
            fields={BEHAVIOR_FIELDS}
            initialValues={(pet.behavior_info ?? {}) as Record<string, unknown>}
            onSave={updatePetBehavior}
          />
          <PetProfileSection
            petId={pet.id}
            title="Rotina e cuidados"
            fields={ROUTINE_FIELDS}
            initialValues={(pet.routine_info ?? {}) as Record<string, unknown>}
            onSave={updatePetRoutine}
          />
          <PetProfileSection
            petId={pet.id}
            title="Emergência e autorizações"
            fields={EMERGENCY_FIELDS}
            initialValues={(pet.emergency_info ?? {}) as Record<string, unknown>}
            onSave={updatePetEmergency}
          />
        </div>

        <CoTutorsSection petId={pet.id} tutors={tutors ?? []} pendingInvites={pendingInvites ?? []} />

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
