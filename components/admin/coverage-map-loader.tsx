"use client";

import dynamic from "next/dynamic";
import type { CoveragePoint } from "@/components/admin/coverage-map";

// Mesmo motivo de components/search/search-view-toggle.tsx: Leaflet acessa
// `window` ao montar — `next/dynamic` com `ssr: false` só é permitido a
// partir de um Client Component, por isso esse wrapper existe (a página do
// dashboard em si é Server Component).
const CoverageMap = dynamic(() => import("@/components/admin/coverage-map").then((m) => m.CoverageMap), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] w-full rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      Carregando mapa...
    </div>
  ),
});

export function CoverageMapLoader({ points }: { points: CoveragePoint[] }) {
  return <CoverageMap points={points} />;
}
