"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

export function UseMyLocationButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocalização não disponível neste navegador.");
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", position.coords.latitude.toString());
        params.set("lng", position.coords.longitude.toString());
        router.push(`/buscar?${params.toString()}`);
      },
      () => {
        setIsLoading(false);
        setError("Não foi possível acessar sua localização.");
      },
      { timeout: 8000 }
    );
  }

  const active = searchParams.has("lat");

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
          active ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-600"
        }`}
      >
        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
        {active ? "Perto de mim" : "Usar minha localização"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
