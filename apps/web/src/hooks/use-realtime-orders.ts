import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

function apiBaseUrl(): string {
  const fromEnv = import.meta.env["VITE_API_BASE_URL"];
  if (!fromEnv || String(fromEnv).trim() === "") return "";
  return String(fromEnv).replace(/\/+$/, "");
}

/**
 * Assina eventos SSE do estabelecimento e invalida caches de pedidos/mesas/analytics.
 * Fallback: polling a cada 10s se SSE não conectar.
 */
export function useRealtimeOrders(
  establishmentId: string | null | undefined,
  onNewOrder?: () => void,
) {
  const qc = useQueryClient();
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  useEffect(() => {
    if (!establishmentId) return;

    const invalidate = (isCreate = false) => {
      void qc.invalidateQueries({ queryKey: ["orders", establishmentId] });
      void qc.invalidateQueries({ queryKey: ["tables", establishmentId] });
      void qc.invalidateQueries({ queryKey: ["analytics", establishmentId] });
      if (isCreate) onNewOrderRef.current?.();
    };

    const base = apiBaseUrl();
    if (!base) {
      const poll = setInterval(() => invalidate(false), 10_000);
      return () => clearInterval(poll);
    }

    let closed = false;
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const startPoll = () => {
      if (poll || closed) return;
      poll = setInterval(() => invalidate(false), 10_000);
    };

    const connect = () => {
      if (closed) return;
      // Tenant from session cookie; establishmentId only gates enabling the hook.
      void establishmentId;
      const url = `${base}/api/v1/events`;
      source = new EventSource(url, { withCredentials: true });

      source.addEventListener("order.created", () => invalidate(true));
      source.addEventListener("order.updated", () => invalidate(false));
      source.addEventListener("table.updated", () => invalidate(false));

      source.onerror = () => {
        source?.close();
        source = null;
        startPoll();
        if (!closed) {
          retryTimer = setTimeout(() => {
            if (poll) {
              clearInterval(poll);
              poll = null;
            }
            connect();
          }, 15_000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      source?.close();
      if (poll) clearInterval(poll);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [establishmentId, qc]);
}
