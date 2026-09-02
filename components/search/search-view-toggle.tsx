"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { List, Map as MapIcon } from "lucide-react";
import type { MapPin } from "@/components/search/results-map";

// Leaflet acessa `window` na hora de montar o mapa — sem isso, o
// `next/dynamic` com `ssr: false` evita o crash de SSR ("window is not
// defined") que aconteceria se o MapContainer tentasse renderizar no
// servidor antes da hidratação.
const ResultsMap = dynamic(() => import("@/components/search/results-map").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      Carregando mapa...
    </div>
  ),
});

/**
 * Alterna lista/mapa na busca (item 2 da Onda 2). A lista em si continua
 * sendo renderizada no servidor (mesmo card de sempre, com favorito e
 * distância) — só o mapa é client-only e carregado sob demanda, pra não
 * pesar o bundle de quem nunca abre o mapa.
 */
export function SearchViewToggle({
  list,
  pins,
  userLocation,
}: {
  list: React.ReactNode;
  pins: MapPin[];
  userLocation: [number, number] | null;
}) {
  const [view, setView] = useState<"lista" | "mapa">("lista");

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setView("lista")}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            view === "lista" ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
          }`}
        >
          <List size={12} /> Lista
        </button>
        <button
          type="button"
          onClick={() => setView("mapa")}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            view === "mapa" ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
          }`}
        >
          <MapIcon size={12} /> Mapa
        </button>
      </div>

      {view === "lista" ? (
        list
      ) : pins.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 border border-gray-200 rounded-lg">
          Nenhum profissional com área de atendimento configurada pra mostrar no mapa.
        </div>
      ) : (
        <ResultsMap pins={pins} userLocation={userLocation} />
      )}
    </div>
  );
}
