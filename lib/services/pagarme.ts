/**
 * Client HTTP do Pagar.me (API v5) — Onda 3 (financeiro real).
 *
 * Primeiro `lib/services/*` do projeto: até aqui toda integração externa era só
 * Supabase. Ponto único de contato com o gateway — nenhum outro arquivo deve
 * montar uma URL de api.pagar.me diretamente.
 *
 * Status: escrito contra a documentação oficial (docs.pagar.me), sem chave de
 * sandbox disponível ainda pra exercitar de ponta a ponta — ver `CHANGELOG.md`
 * (entrada "Onda 3, fundação sem gateway") pra detalhe de cada achado citado nos
 * comentários abaixo. Os pontos marcados com ⚠️ precisam de confirmação com uma
 * chamada real assim que a chave existir, antes do checkpoint de cada etapa.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";

export class PagarmeError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly gatewayCode?: string
  ) {
    super(message);
    this.name = "PagarmeError";
  }
}

function authHeader(): string {
  const key = process.env.PAGARME_API_KEY;
  if (!key) {
    throw new PagarmeError(
      "PAGARME_API_KEY não configurada — onboarding financeiro indisponível até a chave existir."
    );
  }
  // Basic Auth: secret key como usuário, senha vazia (confirmado na doc oficial).
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

async function pagarmeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Fora do try/catch de rede de propósito: se a chave não estiver configurada,
  // o erro precisa chegar como "chave não configurada", não ser mascarado como
  // falha de rede genérica (bug real encontrado e corrigido durante o teste
  // manual desta etapa — o catch abaixo estava engolindo esse throw).
  const authorization = authHeader();

  let response: Response;
  try {
    response = await fetch(`${PAGARME_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        ...init?.headers,
      },
    });
  } catch {
    throw new PagarmeError("Falha de rede ao chamar o Pagar.me.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && String(body.message)) ||
      `Pagar.me respondeu ${response.status}`;
    throw new PagarmeError(message, response.status, body?.errors?.[0]?.type);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Recebedores (onboarding financeiro do Profissional — Etapa 1)
// ---------------------------------------------------------------------------

export type CreateRecipientInput = {
  /** CPF ou CNPJ — já coletado no cadastro (profiles.cpf_cnpj). */
  document: string;
  documentType: "individual" | "company";
  name: string;
  email: string;
  bankAccount: {
    bankCode: string;
    agencia: string;
    agenciaDv?: string;
    conta: string;
    contaDv: string;
    contaTipo: "conta_corrente" | "conta_poupanca";
  };
};

export type RecipientResult = {
  id: string;
  status: string;
};

/**
 * Cria o recebedor no gateway. O Profissional NUNCA cria conta própria no
 * Pagar.me — isso é feito por nós via API, uma vez, com os dados coletados no
 * formulário de onboarding (spec 9.1).
 *
 * ⚠️ Os nomes exatos dos campos aninhados de `register_information` (pessoa
 * física vs jurídica) precisam ser confirmados na primeira chamada real —
 * a doc pública resume os campos (documento, nome, renda, endereço...) mas não
 * publica o schema JSON completo. Ajustar aqui, não espalhar pelo resto do código
 * (é por isso que essa forma existe atrás de um client único).
 */
export async function createRecipient(input: CreateRecipientInput): Promise<RecipientResult> {
  const body = {
    name: input.name,
    email: input.email,
    document: input.document,
    type: input.documentType,
    transfer_settings: {
      transfer_enabled: false, // saque só sob solicitação (spec 9.2) — nunca automático
    },
    default_bank_account: {
      holder_name: input.name,
      holder_document: input.document,
      bank: input.bankAccount.bankCode,
      branch_number: input.bankAccount.agencia,
      branch_check_digit: input.bankAccount.agenciaDv,
      account_number: input.bankAccount.conta,
      account_check_digit: input.bankAccount.contaDv,
      type: input.bankAccount.contaTipo,
    },
  };

  const result = await pagarmeFetch<{ id: string; status: string }>("/recipients", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { id: result.id, status: result.status };
}

export async function getRecipient(recipientId: string): Promise<RecipientResult> {
  const result = await pagarmeFetch<{ id: string; status: string }>(`/recipients/${recipientId}`);
  return { id: result.id, status: result.status };
}

// ---------------------------------------------------------------------------
// Split (compartilhado entre cobrança Pix/cartão e estorno — Etapas 2/3/4)
// ---------------------------------------------------------------------------

export type SplitRule = {
  recipientId: string;
  /** Em reais — convertido pra centavos na montagem do payload (Pagar.me usa centavos). */
  amount: number;
  type: "flat" | "percentage";
  liable?: boolean;
  chargeProcessingFee?: boolean;
  chargeRemainderFee?: boolean;
};

function toGatewaySplit(rules: SplitRule[]) {
  return rules.map((r) => ({
    amount: r.type === "flat" ? Math.round(r.amount * 100) : r.amount,
    recipient_id: r.recipientId,
    type: r.type,
    options: {
      liable: r.liable ?? false,
      charge_processing_fee: r.chargeProcessingFee ?? false,
      charge_remainder_fee: r.chargeRemainderFee ?? false,
    },
  }));
}

// ---------------------------------------------------------------------------
// Cobrança — Pix (Etapa 2) e cartão à vista via checkout hospedado (Etapa 3)
// ---------------------------------------------------------------------------

export type CreatePixOrderInput = {
  requestId: string;
  amountReais: number;
  split: SplitRule[];
  customerName: string;
  customerDocument: string;
};

export type PixOrderResult = {
  gatewayOrderId: string;
  qrCode: string;
  qrCodeUrl: string;
};

export async function createPixOrder(input: CreatePixOrderInput): Promise<PixOrderResult> {
  const body = {
    items: [
      {
        amount: Math.round(input.amountReais * 100),
        description: `Atendimento Petlys #${input.requestId}`,
        quantity: 1,
      },
    ],
    customer: { name: input.customerName, document: input.customerDocument },
    payments: [{ payment_method: "pix", pix: { expires_in: 3600 }, split: toGatewaySplit(input.split) }],
  };

  const result = await pagarmeFetch<{
    id: string;
    charges: Array<{ last_transaction: { qr_code: string; qr_code_url: string } }>;
  }>("/orders", { method: "POST", body: JSON.stringify(body) });

  const transaction = result.charges[0]?.last_transaction;
  if (!transaction) {
    throw new PagarmeError("Pagar.me não retornou os dados do Pix.");
  }

  return { gatewayOrderId: result.id, qrCode: transaction.qr_code, qrCodeUrl: transaction.qr_code_url };
}

export type CreateCardCheckoutInput = {
  requestId: string;
  amountReais: number;
  split: SplitRule[];
  successUrl: string;
};

export type CardCheckoutResult = {
  gatewayCheckoutId: string;
  paymentUrl: string;
};

/**
 * Checkout hospedado — decisão do usuário: sem parcelamento (à vista, 1x). O
 * Pagar.me cuida de PCI-DSS; nunca tocamos número de cartão.
 *
 * ⚠️ Nome exato do parâmetro que trava parcelamento em 1x no checkout hospedado
 * não está confirmado na doc pública — validar no início da Etapa 3.
 */
export async function createCardCheckoutOrder(input: CreateCardCheckoutInput): Promise<CardCheckoutResult> {
  const body = {
    items: [
      { amount: Math.round(input.amountReais * 100), description: `Atendimento Petlys #${input.requestId}`, quantity: 1 },
    ],
    payments: [
      {
        payment_method: "checkout",
        checkout: {
          accepted_payment_methods: ["credit_card"],
          success_url: input.successUrl,
          credit_card: { installments: [{ number: 1, total: Math.round(input.amountReais * 100) }] },
        },
        split: toGatewaySplit(input.split),
      },
    ],
  };

  const result = await pagarmeFetch<{ id: string; checkouts?: Array<{ id: string; payment_url: string }> }>(
    "/orders",
    { method: "POST", body: JSON.stringify(body) }
  );

  const checkout = result.checkouts?.[0];
  if (!checkout) {
    throw new PagarmeError("Pagar.me não retornou a URL do checkout.");
  }

  return { gatewayCheckoutId: checkout.id, paymentUrl: checkout.payment_url };
}

// ---------------------------------------------------------------------------
// Estorno com split de estorno (cancelamento/no-show — Etapa 4)
// ---------------------------------------------------------------------------

export type RefundChargeInput = {
  gatewayChargeId: string;
  amountReais: number;
  /** Split de estorno — recurso real e documentado (docs.pagar.me/v4/reference/estorno-parcial-com-split),
   * não uma suposição: permite descontar só de um recipient específico. */
  split?: SplitRule[];
};

export async function refundCharge(input: RefundChargeInput): Promise<{ status: string }> {
  const body: Record<string, unknown> = { amount: Math.round(input.amountReais * 100) };
  if (input.split) {
    body.split = toGatewaySplit(input.split);
  }

  const result = await pagarmeFetch<{ status: string }>(`/charges/${input.gatewayChargeId}/refund`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { status: result.status };
}

// ---------------------------------------------------------------------------
// Transferências / saque (Etapa 5) — rota nova (/transfers), não a depreciada
// /recipients/{id}/withdrawals. Sem webhook de confirmação: precisa de polling
// (ver getTransferStatus, chamado pelo job da Etapa 5).
// ---------------------------------------------------------------------------

export async function createTransfer(recipientId: string, amountReais: number): Promise<{ id: string; status: string }> {
  const result = await pagarmeFetch<{ id: string; status: string }>("/transfers", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId, amount: Math.round(amountReais * 100) }),
  });
  return result;
}

export async function getTransferStatus(transferId: string): Promise<{ status: string; failureReason?: string }> {
  const result = await pagarmeFetch<{ status: string; error?: string }>(`/transfers/${transferId}`);
  return { status: result.status, failureReason: result.error };
}

// ---------------------------------------------------------------------------
// Webhook — assinatura (Etapa 2)
// ---------------------------------------------------------------------------

/**
 * ⚠️ NÃO CONFIRMADO na doc pública oficial do Pagar.me — precisa ser validado
 * no painel/doc autenticada do sandbox do usuário antes da Etapa 2 (nome exato
 * do header e algoritmo). Implementado com o padrão mais comum do mercado
 * (HMAC-SHA256 sobre o corpo cru, header `X-Hub-Signature`) como ponto de
 * partida — não tratar como confirmado até testar contra um evento real.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.PAGARME_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");

  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
