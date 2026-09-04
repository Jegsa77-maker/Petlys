import { createClient } from "@/lib/supabase/client";
import type { AnalyticsEventName, AnalyticsEventInput } from "./events";

function readAnonSessionId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )plys_sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Dispara um evento de analytics do client (fire-and-forget) — nunca
 * lança erro nem trava a UI. `plys_sid` é setado pro middleware
 * (lib/supabase/middleware.ts) em toda requisição, autenticada ou não;
 * se por algum motivo ainda não existir, só não registra o evento.
 */
export function trackEvent(eventName: AnalyticsEventName, input: AnalyticsEventInput = {}): void {
  const sessionId = readAnonSessionId();
  if (!sessionId) return;

  const supabase = createClient();
  supabase
    .from("analytics_events")
    .insert({ event_name: eventName, session_id: sessionId, ...input })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[analytics]", eventName, error.message);
      }
    });
}
