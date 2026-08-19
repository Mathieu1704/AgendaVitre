import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

export const COMPANY_SETTINGS_KEY = ["company-settings"];

/**
 * Réglages globaux de l'entreprise, synchronisés en temps réel.
 *
 * `hide_cash` masque les montants en espèces sur TOUS les appareils à la fois :
 * le changement doit donc se propager immédiatement, pas au prochain montage
 * d'écran. C'était assuré jusqu'ici par un sondage à 500 ms depuis l'écran
 * Réglages (~120 requêtes/minute pour lire un booléen), qui pouvait en prime
 * écraser la mise à jour optimiste du bouton par une réponse déjà en vol.
 *
 * On passe par le canal Realtime de Supabase : chaque appareil reçoit le
 * changement en push, sans sondage. Un rafraîchissement lent (60 s) reste en
 * filet de sécurité si la réplication n'est pas active côté base — 1 requête
 * par minute au lieu de 120.
 *
 * À monter une seule fois, dans `app/(app)/_layout.tsx`.
 */
export function useCompanySettingsSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("company-settings-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_settings" },
        (payload) => {
          const next = payload.new as { hide_cash?: boolean } | null;
          if (!next || typeof next.hide_cash !== "boolean") {
            // Charge utile inattendue (DELETE, ou REPLICA IDENTITY non
            // configurée) : on redemande la valeur plutôt que de deviner.
            void queryClient.invalidateQueries({ queryKey: COMPANY_SETTINGS_KEY });
            return;
          }
          queryClient.setQueryData(COMPANY_SETTINGS_KEY, (prev: any) => ({
            ...(prev ?? {}),
            ...next,
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Lecture des réglages. La fraîcheur est assurée par `useCompanySettingsSync`. */
export function useCompanySettings() {
  return useQuery({
    queryKey: COMPANY_SETTINGS_KEY,
    queryFn: async () => (await api.get("/api/settings/company")).data,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
  });
}
