import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./pagarme";

/**
 * Único pedaço de lib/services/pagarme.ts testável sem chave real e sem
 * rede: a verificação de assinatura é lógica pura sobre uma string. O
 * mecanismo em si (header/algoritmo) ainda não está confirmado com o
 * gateway de verdade — ver comentário no arquivo fonte.
 */
describe("verifyWebhookSignature", () => {
  const secret = "segredo-de-teste";

  beforeAll(() => {
    process.env.PAGARME_WEBHOOK_SECRET = secret;
  });

  afterAll(() => {
    delete process.env.PAGARME_WEBHOOK_SECRET;
  });

  it("aceita uma assinatura válida", () => {
    const body = JSON.stringify({ type: "charge.paid" });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${signature}`)).toBe(true);
  });

  it("rejeita assinatura incorreta", () => {
    const body = JSON.stringify({ type: "charge.paid" });
    expect(verifyWebhookSignature(body, "sha256=0000000000000000")).toBe(false);
  });

  it("rejeita quando não há header nenhum", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejeita quando o corpo foi alterado depois de assinado", () => {
    const signature = createHmac("sha256", secret).update("corpo-original").digest("hex");
    expect(verifyWebhookSignature("corpo-alterado", `sha256=${signature}`)).toBe(false);
  });
});
