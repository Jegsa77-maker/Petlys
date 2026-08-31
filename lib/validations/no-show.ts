import { z } from "zod";

export const reportNoShowSchema = z.object({
  requestId: z.uuid(),
  occurrenceId: z.uuid(),
  reportedParty: z.enum(["tutor", "profissional"]),
  minWaitConfirmed: z.boolean(),
  checkinConfirmed: z.boolean(),
  contactAttemptConfirmed: z.boolean(),
});
export type ReportNoShowValues = z.infer<typeof reportNoShowSchema>;
