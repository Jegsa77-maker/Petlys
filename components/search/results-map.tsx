"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = {
  professionalId: string;
  name: string;
  categoryLabel: string;
  basePrice: number | null;
  lat: number;
  lng: number;
};

// Ícone próprio (pin teal com pata), em vez do marcador padrão do Leaflet —
// os PNGs default do pacote não resolvem certo com bundler do Next.js
// (problema conhecido do react-leaflet), e assim já sai na cor da marca.
const petlysIcon = L.divIcon({
  html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="#0b4d52"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
});

/**
 * Mapa visual da busca (item 2 da Onda 2, parte que ficou no BACKLOG.md ao
 * lado dos filtros de preço/nota/subcategoria/espécie já entregues). Pins
 * usam `professional_service_areas.center_lat/center_lng` — não é a
 * localização exata do profissional (não existe esse dado), é o centro da
 * área de atendimento que ele mesmo configurou.
 */
export function ResultsMap({ pins, userLocation }: { pins: MapPin[]; userLocation: [number, number] | null }) {
  const center = useMemo<[number, number]>(() => {
    if (userLocation) return userLocation;
    if (pins.length > 0) return [pins[0].lat, pins[0].lng];
    return [-23.5505, -46.6333]; // São Paulo como fallback neutro sem localização nem pin.
  }, [userLocation, pins]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-gray-200">
      <MapContainer center={center} zoom={pins.length > 0 ? 11 : 10} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && (
          <Marker
            position={userLocation}
            icon={L.divIcon({
              html: `<div style="width:14px;height:14px;border-radius:9999px;background:#0b4d52;border:2px solid white;box-shadow:0 0 0 2px #0b4d52;"></div>`,
              className: "",
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          />
        )}
        {pins.map((pin) => (
          <Marker key={pin.professionalId} position={[pin.lat, pin.lng]} icon={petlysIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-black">{pin.name}</p>
                <p className="text-xs text-gray-500 mb-1">{pin.categoryLabel}</p>
                <p className="text-xs text-teal font-semibold mb-1">
                  {pin.basePrice ? `A partir de R$ ${pin.basePrice}` : "Sob consulta"}
                </p>
                <Link href={`/profissional/${pin.professionalId}`} className="text-xs font-semibold text-teal hover:underline">
                  Ver perfil
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
