/**
 * Bandeau d'état de la connexion et de la synchronisation.
 *
 * Remplace les toasts « Hors ligne » que l'intercepteur d'`api.ts` déclenchait
 * à chaque requête échouée : hors réseau, le planning et le sondage des
 * notifications en produisaient une rafale.
 *
 * Trois états, par ordre de priorité :
 *  - hors ligne (avec le nombre de modifications en attente) ;
 *  - en ligne mais des modifications restent à envoyer ;
 *  - en ligne et des modifications ont définitivement échoué.
 */
import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useIsOnline } from "../../lib/offline/network";
import { useOutboxSync } from "../../lib/offline/useOutboxSync";
import { retryFailed } from "../../lib/offline/outbox";
import { isOfflineSupported } from "../../lib/offline/storage";

type Props = { topInset?: number };

export function OfflineBanner({ topInset = 0 }: Props) {
  const online = useIsOnline();
  const { pending, failed, refresh } = useOutboxSync();

  if (!isOfflineSupported) return null;

  const hasFailed = failed.length > 0;
  const nothingToShow = online && pending === 0 && !hasFailed;
  if (nothingToShow) return null;

  const plural = (n: number) => (n > 1 ? "s" : "");

  // Hors ligne
  if (!online) {
    return (
      <Bar
        topInset={topInset}
        background="#1E293B"
        icon={<CloudOff size={14} color="#E2E8F0" />}
        text={
          pending > 0
            ? `Hors ligne — ${pending} modification${plural(pending)} en attente`
            : "Hors ligne — les données affichées peuvent dater"
        }
      />
    );
  }

  // En ligne, des échecs définitifs à traiter.
  // La raison est affichée : sans elle, l'utilisateur ne peut que réessayer à
  // l'aveugle, et le développeur n'a aucun élément de diagnostic.
  if (hasFailed) {
    const reason = failed.find((f) => f.lastError)?.lastError;
    const what = failed[0]?.label;
    return (
      <Bar
        topInset={topInset}
        background="#7F1D1D"
        icon={<AlertTriangle size={14} color="#FECACA" />}
        text={
          `${failed.length} modification${plural(failed.length)} non enregistrée${plural(failed.length)}` +
          (what ? ` — ${what}` : "") +
          (reason ? ` (${reason})` : "")
        }
        action={{
          label: "Réessayer",
          onPress: async () => {
            await retryFailed();
            await refresh();
          },
        }}
      />
    );
  }

  // En ligne, synchronisation en cours
  return (
    <Bar
      topInset={topInset}
      background="#1D4ED8"
      icon={<ActivityIndicator size="small" color="#DBEAFE" />}
      text={`Synchronisation de ${pending} modification${plural(pending)}…`}
    />
  );
}

function Bar({
  topInset,
  background,
  icon,
  text,
  action,
}: {
  topInset: number;
  background: string;
  icon: React.ReactNode;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View
      style={{
        paddingTop: topInset,
        backgroundColor: background,
        paddingHorizontal: 14,
        paddingVertical: 7,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}
      <Text style={{ flex: 1, color: "#F8FAFC", fontSize: 12, fontWeight: "600" }}>
        {text}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        >
          <RefreshCw size={12} color="#F8FAFC" />
          <Text style={{ color: "#F8FAFC", fontSize: 11, fontWeight: "700" }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
