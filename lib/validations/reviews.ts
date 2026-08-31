import { z } from "zod";

export const submitReviewSchema = z.object({
  requestId: z.uuid(),
  revieweeId: z.uuid(),
  qualidade: z.coerce.number().int().min(1).max(5),
  comunicacao: z.coerce.number().int().min(1).max(5),
  pontualidade: z.coerce.number().int().min(1).max(5),
  aderenciaCombinado: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export type SubmitReviewValues = z.infer<typeof submitReviewSchema>;

export const respondReviewSchema = z.object({
  reviewId: z.uuid(),
  response: z.string().trim().min(1, "Escreva uma resposta").max(500),
});
export type RespondReviewValues = z.infer<typeof respondReviewSchema>;
