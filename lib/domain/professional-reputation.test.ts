import { describe, it, expect } from "vitest";
import { computeProfessionalLevel, averageRating } from "./professional-reputation";

describe("computeProfessionalLevel", () => {
  it("começa como 'novo' sem atendimento nenhum", () => {
    expect(computeProfessionalLevel(0, null)).toBe("novo");
  });

  it("não pune profissional novo sem avaliação ainda", () => {
    // seção 6.3: "sem punir recusa e com exposição para novos Profissionais"
    expect(computeProfessionalLevel(0, null)).not.toBe("top");
  });

  it("vira 'experiente' com 3+ atendimentos e nota 4+", () => {
    expect(computeProfessionalLevel(3, 4)).toBe("experiente");
    expect(computeProfessionalLevel(10, 4.2)).toBe("experiente");
  });

  it("'experiente' aceita nota null (ainda sem avaliação apesar de já ter atendido)", () => {
    expect(computeProfessionalLevel(3, null)).toBe("experiente");
  });

  it("não vira 'experiente' com nota abaixo de 4, mesmo com volume", () => {
    expect(computeProfessionalLevel(20, 3.9)).toBe("novo");
  });

  it("vira 'top' só com 15+ atendimentos E nota 4.5+", () => {
    expect(computeProfessionalLevel(15, 4.5)).toBe("top");
    expect(computeProfessionalLevel(14, 5)).toBe("experiente"); // volume insuficiente
    expect(computeProfessionalLevel(20, 4.4)).toBe("experiente"); // nota insuficiente
  });

  it("'top' nunca aceita nota null — precisa de nota real alta", () => {
    expect(computeProfessionalLevel(20, null)).toBe("experiente");
  });
});

describe("averageRating", () => {
  it("retorna null sem nenhuma avaliação", () => {
    expect(averageRating([])).toBeNull();
  });

  it("ignora avaliação com rating malformado (não é objeto)", () => {
    expect(averageRating([{ rating: null }, { rating: "5" }])).toBeNull();
  });

  it("tira a média de todos os critérios de todas as avaliações", () => {
    const reviews = [
      { rating: { qualidade: 5, comunicacao: 5 } },
      { rating: { qualidade: 3, comunicacao: 3 } },
    ];
    // (5+5+3+3)/4 = 4
    expect(averageRating(reviews)).toBe(4);
  });

  it("ignora chaves não-numéricas dentro do rating", () => {
    const reviews = [{ rating: { qualidade: 4, comentario_extra: "texto" } }];
    expect(averageRating(reviews)).toBe(4);
  });
});
