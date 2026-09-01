import { z } from "zod";
import { INCIDENT_TYPE_OPTIONS } from "@/lib/domain/incident-types";

const INCIDENT_TYPE_VALUES = INCIDENT_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const openIncidentSchema = z.object({
  requestId: z.uuid(),
  occurrenceId: z.uuid().optional(),
  type: z.enum(INCIDENT_TYPE_VALUES, { message: "Selecione o tipo do problema" }),
  description: z
    .string()
    .trim()
    .min(10, "Conte um pouco mais sobre o que aconteceu (mínimo 10 caracteres)"),
});

export type OpenIncidentValues = z.infer<typeof openIncidentSchema>;
