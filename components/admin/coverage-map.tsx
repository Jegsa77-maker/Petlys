"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type CoveragePoint = {
  cityLabel: string;
  uf: string | null;
  lat: number;
  lng: number;
  tutores: number;
  profissionais: number;
};

// Mesma técnica de components/search/results-map.tsx (divIcon em vez do
// marcador padrão do Leaflet, que não resolve certo com o bundler do
// Next.js) — aqui o círculo já carrega o número dentro, em vez de esconder
// a contagem num popup (pedido do usuário: "com números totais").
function countIcon(count: number, color: string) {
  const size = Math.min(46, Math.max(24, 20 + count * 2));
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};color:white;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      font-size:${size > 32 ? 13 : 11}px;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const TUTOR_COLOR = "#0b4d52"; // teal da marca, mesmo tom do pin de busca
const PROFISSIONAL_COLOR = "#c2410c"; // laranja queimado — bem distinto do teal

/**
 * Mapa de cobertura do dashboard do Admin: um marcador por cidade pra
 * tutores e outro pra profissionais (levemente deslocados, cores
 * diferentes, número visível no próprio círculo) — pra identificar visualmente
 * regiões com demanda/oferta e regiões "fora do radar" pra investimento em
 * marketing. Pontos já vêm agregados por cidade da RPC
 * admin_kpi_geo_coverage (nunca um pino por pessoa).
 */
export function CoverageMap({ points }: { points: CoveragePoint[] }) {
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [-14.235, -51.9253]; // centro do Brasil, fallback neutro.
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [points]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: TUTOR_COLOR }} />
          Tutores
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: PROFISSIONAL_COLOR }} />
          Profissionais
        </span>
      </div>
      <div className="h-[480px] w-full overflow-hidden rounded-lg border border-gray-200">
        <MapContainer center={center} zoom={4} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.flatMap((p) => {
            const markers: React.ReactNode[] = [];
            // Deslocamento pequeno em longitude pra não sobrepor os dois
            // círculos quando a cidade tem tutor e profissional.
            const offset = 0.06;
            if (p.tutores > 0) {
              markers.push(
                <Marker
                  key={`${p.cityLabel}-tutor`}
                  position={[p.lat, p.lng - offset]}
                  icon={countIcon(p.tutores, TUTOR_COLOR)}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-black">{p.cityLabel}</p>
                      {p.uf && <p className="text-xs text-gray-500">{p.uf}</p>}
                      <p className="text-xs text-teal font-semibold mt-1">{p.tutores} tutor(es)</p>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            if (p.profissionais > 0) {
              markers.push(
                <Marker
                  key={`${p.cityLabel}-prof`}
                  position={[p.lat, p.lng + offset]}
                  icon={countIcon(p.profissionais, PROFISSIONAL_COLOR)}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-black">{p.cityLabel}</p>
                      {p.uf && <p className="text-xs text-gray-500">{p.uf}</p>}
                      <p className="text-xs font-semibold mt-1" style={{ color: PROFISSIONAL_COLOR }}>
                        {p.profissionais} profissional(is)
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return markers;
          })}
        </MapContainer>
      </div>
    </div>
  );
}
