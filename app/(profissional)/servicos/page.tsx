import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/components/services/service-form";
import { ServiceList } from "@/components/services/service-list";

export default async function ServicosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: services } = user
    ? await supabase
        .from("professional_services")
        .select("id, category, base_price, active, multi_pet_discount_percent")
        .eq("professional_id", user.id)
        .order("category")
    : { data: [] };

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Serviços e preços</h1>

        {services && services.length > 0 && <ServiceList services={services} />}

        <ServiceForm />
      </div>
    </main>
  );
}
