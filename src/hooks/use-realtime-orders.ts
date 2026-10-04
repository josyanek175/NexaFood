import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina as mudanças de pedidos do estabelecimento e invalida os caches
 * de pedidos/mesas/analytics para que painel, KDS e dashboard fiquem vivos.
 */
export function useRealtimeOrders(establishmentId: string | null | undefined, onNewOrder?: () => void) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!establishmentId) return;

    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["orders", establishmentId] });
      void qc.invalidateQueries({ queryKey: ["tables", establishmentId] });
      void qc.invalidateQueries({ queryKey: ["analytics", establishmentId] });
    };

    const channel = supabase
      .channel(`ops-${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => {
          invalidate();
          onNewOrder?.();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, qc, onNewOrder]);
}
