/**
 * Geocodificação de CEP -> lat/lng, usada pra popular `profiles.address_zip/
 * address_lat/address_lng` (mapa de cobertura do Admin — sem isso, tutor
 * nunca aparecia no mapa, só profissional, porque nenhum fluxo do app
 * escrevia nessas colunas até agora). Dois passos, sem API paga nem chave:
 *
 *  1. ViaCEP (viacep.com.br) resolve o CEP em endereço (logradouro/bairro/
 *     cidade/UF) — serviço público brasileiro, sem custo, sem chave.
 *  2. Nominatim (OpenStreetMap) geocodifica esse endereço em lat/lng — mesmo
 *     provedor dos tiles já usados em components/search/results-map.tsx e no
 *     mapa de cobertura do Admin, não introduz um provedor novo no projeto.
 *
 * Uso respeitoso da política do Nominatim: User-Agent identificando o app,
 * sem chamadas em paralelo/loop (só uso pontual, um CEP por vez, disparado
 * pelo próprio usuário salvando o perfil).
 */

export class GeocodingError extends Error {}

type ViaCepResponse = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

type NominatimResult = { lat: string; lon: string };

export type GeocodedAddress = {
  zip: string;
  lat: number;
  lng: number;
  city: string;
  uf: string;
};

function normalizeCep(rawCep: string): string {
  const digits = rawCep.replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new GeocodingError("CEP precisa ter 8 dígitos.");
  }
  return digits;
}

async function fetchViaCep(cep: string): Promise<ViaCepResponse> {
  // Erro de rede e "CEP não encontrado" tratados em pontos separados de
  // propósito — um catch único em volta dos dois misturaria as duas
  // mensagens (mesmo erro já documentado em lib/services/pagarme.ts:
  // "authHeader() fora do try/catch" — aqui é o mesmo cuidado).
  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch (err) {
    console.error("[geocoding] viacep fetch failed", err);
    throw new GeocodingError("Não foi possível consultar o CEP agora. Tente novamente.");
  }
  if (!response.ok) {
    throw new GeocodingError("Não foi possível consultar o CEP agora. Tente novamente.");
  }
  return response.json();
}

async function fetchNominatim(query: string): Promise<NominatimResult[]> {
  let response: Response;
  try {
    response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      // Cabecalho HTTP precisa ser ByteString puro (ASCII) - um em-dash ou
      // acento aqui quebra o fetch com "Cannot convert argument to a
      // ByteString" (bug real encontrado testando esse formulario).
      { headers: { "User-Agent": "PetlysApp/1.0 (contato via app Petlys)" } }
    );
  } catch (err) {
    console.error("[geocoding] nominatim fetch failed", err);
    throw new GeocodingError("Não foi possível localizar esse endereço no mapa agora. Tente novamente.");
  }
  if (!response.ok) {
    throw new GeocodingError("Não foi possível localizar esse endereço no mapa agora. Tente novamente.");
  }
  return response.json();
}

export async function geocodeCep(rawCep: string): Promise<GeocodedAddress> {
  const cep = normalizeCep(rawCep);
  const viaCep = await fetchViaCep(cep);

  if (viaCep.erro) {
    throw new GeocodingError("CEP não encontrado. Confira se digitou certo.");
  }

  const addressQuery = [viaCep.logradouro, viaCep.bairro, viaCep.localidade, viaCep.uf, "Brasil"]
    .filter(Boolean)
    .join(", ");

  const results = await fetchNominatim(addressQuery);
  const first = results[0];
  if (!first) {
    throw new GeocodingError("Não conseguimos localizar esse CEP no mapa. Tente um CEP diferente.");
  }

  return {
    zip: cep,
    lat: Number(first.lat),
    lng: Number(first.lon),
    city: viaCep.localidade,
    uf: viaCep.uf,
  };
}
