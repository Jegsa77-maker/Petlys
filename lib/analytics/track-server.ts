import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AnalyticsEventName, AnalyticsEventInput } from "./events";

/**
 * Versão server-side de trackEvent — usada em Server Components/Actions
 * (ex.: visualização de perfil, submissão de solicitação). Mesmo
 * princípio: nunca lança erro, nunca atrasa a resposta por causa de
 * telemetria.
 */
export async function trackEventServer(eventName: AnalyticsEventName, input: AnalyticsEventInput = {}): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("plys_sid")?.value;
  if (!sessionId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("analytics_events")
    .insert({ event_name: eventName, session_id: sessionId, ...input });

  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[analytics]", eventName, error.message);
  }
}
