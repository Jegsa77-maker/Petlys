"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/lib/actions/favorites";

export function FavoriteButton({
  professionalId,
  initialFavorited,
  size = 18,
}: {
  professionalId: string;
  initialFavorited: boolean;
  size?: number;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Botões de favorito ficam dentro de <Link> nos cards da busca — sem
    // isso, o clique também navegaria para o perfil do profissional.
    e.preventDefault();
    e.stopPropagation();

    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = await toggleFavorite(professionalId);
      if (result?.error) {
        setFavorited(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? "Remover dos favoritos" : "Favoritar"}
      aria-pressed={favorited}
      className="p-1 disabled:opacity-60"
    >
      <Heart
        size={size}
        className={favorited ? "fill-teal text-teal" : "text-gray-300"}
      />
    </button>
  );
}
