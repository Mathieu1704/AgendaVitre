import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  ScrollView,
  Text,
  Platform,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Switch,
  InteractionManager,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect, Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { onDemandPrice } from "../../../src/lib/price";
import { newUuidV4 } from "../../../src/lib/uuid";
import { formatRecurrenceLabel } from "../../../src/lib/recurrence";
import { enqueue } from "../../../src/lib/offline/outbox";
import { isOnlineNow } from "../../../src/lib/offline/network";
import { newTempId } from "../../../src/lib/offline/idMap";
import {
  applyCreateReprise,
  applyEditIntervention,
  applyItemsDone,
  applyMarkDone,
  applyServiceCreate,
  applyServiceRename,
  applyServicePriceUpdate,
  applyServiceDelete,
  applyChainServiceCreate,
  applyChainServiceRename,
  applyChainServicePriceUpdate,
  applyChainServiceDelete,
} from "../../../src/lib/offline/optimistic";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
import { PaymentSplitInputs } from "../../../src/ui/components/PaymentSplitInputs";
import { validatePaymentSplit } from "../../../src/lib/payment";
import {
  PlusCircle,
  Trash2,
  Check,
  FileText,
  ChevronLeft,
  UserPlus,
  X,
  ChevronDown,
  AlertTriangle,
  Banknote,
  Wallet,
  Repeat,
  ChevronRight,
  CalendarClock,
} from "lucide-react-native";
import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { MultiSelect } from "../../../src/ui/components/MultiSelect";
import { toast } from "../../../src/ui/toast";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { MultiDatePicker } from "../../../src/ui/components/MultiDatePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dialog } from "../../../src/ui/components/Dialog";

import {
  toBrusselsDateTimeString,
  parseBrusselsDateTimeString,
} from "../../../src/lib/date";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";
import { useCompanySettings } from "../../../src/hooks/useCompanySettingsSync";
import { CityAutocomplete } from "../../../src/ui/components/CityAutocomplete";

type Client = {
  id: string;
  name: string | null;
  address: string | null;
  phone?: string | null;
};
// Le clavier "decimal-pad" n'a pas de touche "-", sur iOS comme sur Android :
// c'est un clavier purement numérique non signé sur les deux plateformes. Pour
// les champs de prix qui acceptent un montant négatif tapé directement, on
// utilise donc un clavier qui a la touche "-" (au prix d'avoir aussi des
// lettres disponibles) et on filtre le texte saisi pour ne garder que
// chiffres, séparateur décimal et signe — les lettres tapées n'apparaissent
// jamais dans le champ.
const SIGNED_PRICE_KEYBOARD = Platform.OS === "ios" ? "numbers-and-punctuation" : "default";
function sanitizeSignedPrice(text: string): string {
  const negative = text.trim().startsWith("-");
  const digits = text.replace(/[^0-9.,]/g, "");
  return negative ? `-${digits}` : digits;
}

type Item = {
  label: string;
  price: string;
  client_service_id?: string | null;
  intervention_service_id?: string | null;
  on_demand?: boolean;
  negative?: boolean;
};

// L'utilisateur tape toujours un montant positif ; le toggle "+/−" décide du
// signe final. Sert pour une prestation dont on doit rembourser le client
// (montant à déduire du total, exclu du calcul de taux horaire côté serveur).
function signedPrice(item: { price: string; negative?: boolean }): number {
  const base = Math.abs(parseFloat(item.price.replace(",", ".")) || 0);
  return item.negative ? -base : base;
}
type ClientService = {
  id: string;
  label: string;
  price: number;
  position: number;
};

function servicesAttachedToIntervention(
  source: any,
  idField: "client_service_id" | "intervention_service_id" = "client_service_id",
): ClientService[] {
  return (source?.items ?? [])
    .filter((item: any) => item[idField])
    .map((item: any, position: number) => ({
      id: String(item[idField]),
      label: item.label,
      price: Number(item.price) || 0,
      position,
    }));
}

// Préfixe des ids "en attente" : une prestation d'une intervention source
// (sans client) qui n'a encore ni client_service_id ni intervention_service_id
// — typiquement celles de sa toute première création, avant qu'une chaîne
// n'existe. Le backend les relie par libellé au catalogue dès la sauvegarde
// (voir _migrate_orphan_items_to_chain côté API) ; ce préfixe permet de les
// afficher dès maintenant comme des cases à cocher plutôt que des champs
// ad-hoc, sans attendre cet aller-retour.
const PENDING_CHAIN_PREFIX = "__pending__:";
const pendingChainId = (label: string) => `${PENDING_CHAIN_PREFIX}${label}`;
const isPendingChainId = (id: string) => id.startsWith(PENDING_CHAIN_PREFIX);

function pendingChainServices(
  source: any,
  startAt: number,
  excludeAdjustments: boolean = false,
): ClientService[] {
  return (source?.items ?? [])
    .filter((item: any) => !item.client_service_id && !item.intervention_service_id)
    .filter((item: any) => !excludeAdjustments || !item.is_adjustment)
    .filter((item: any) => Number(item.price) >= 0)
    .map((item: any, i: number) => ({
      id: pendingChainId(item.label),
      label: item.label,
      price: Number(item.price) || 0,
      position: startAt + i,
    }));
}

function mergeClientServices(
  catalogue: ClientService[],
  attached: ClientService[],
): ClientService[] {
  const merged = [...catalogue];
  const knownIds = new Set(catalogue.map((service) => String(service.id)));
  for (const service of attached) {
    if (knownIds.has(service.id)) continue;
    merged.push({ ...service, position: merged.length });
    knownIds.add(service.id);
  }
  return merged;
}
type IntervType = "intervention" | "devis" | "tournee" | "note";

const TYPE_CONFIG: Record<
  IntervType,
  { label: string; color: string; bg: string }
> = {
  intervention: { label: "Intervention", color: "#3B82F6", bg: "#EFF6FF" },
  devis: { label: "Devis", color: "#8B5CF6", bg: "#F5F3FF" },
  tournee: { label: "Tournée", color: "#F97316", bg: "#FFF7ED" },
  note: { label: "Note", color: "#64748B", bg: "#F8FAFC" },
};

const NEEDS_CLIENT: IntervType[] = ["intervention", "devis"];
const NEEDS_ITEMS: IntervType[] = ["intervention", "devis"];

type RecurrenceFreq =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "weekdays"
  | "custom";
type RecurrenceUnit = "day" | "week" | "month" | "year";
type EndType = "count" | "date" | "never";

interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  unit: RecurrenceUnit;
  daysOfWeek: number[];
  endType: EndType;
  count: number;
  endDate: string;
}

const DEFAULT_RECURRENCE: Recurrence = {
  freq: "none",
  interval: 1,
  unit: "week",
  daysOfWeek: [],
  endType: "count",
  count: 4,
  endDate: "",
};

const FR_DAYS_FULL = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function getContextualOptions(
  startStr: string,
): Array<{ freq: RecurrenceFreq; label: string }> {
  const date = parseBrusselsDateTimeString(startStr);
  if (!date) return [{ freq: "none", label: "Ne se répète pas" }];
  const dow = date.getDay();
  const dom = date.getDate();
  const nth = Math.ceil(dom / 7);
  const nthStr = nth === 1 ? "1er" : `${nth}e`;
  return [
    { freq: "none", label: "Ne se répète pas" },
    { freq: "daily", label: "Chaque jour" },
    { freq: "weekly", label: `Chaque semaine le ${FR_DAYS_FULL[dow]}` },
    { freq: "monthly", label: `Chaque mois le ${nthStr} ${FR_DAYS_FULL[dow]}` },
    {
      freq: "yearly",
      label: `Chaque année le ${dom} ${FR_MONTHS[date.getMonth()]}`,
    },
    { freq: "weekdays", label: "Chaque jour de la semaine (lun. à ven.)" },
    { freq: "custom", label: "Personnaliser..." },
  ];
}

function getRecurrenceLabel(rec: Recurrence, startStr: string): string {
  if (rec.freq === "none") return "Ne se répète pas";
  const opts = getContextualOptions(startStr);
  const found = opts.find((o) => o.freq === rec.freq);
  if (found && rec.freq !== "custom") return found.label;
  const unitLabels: Record<RecurrenceUnit, string> = {
    day: "jour",
    week: "semaine",
    month: "mois",
    year: "an",
  };
  const s =
    rec.interval > 1 && rec.unit !== "month" && rec.unit !== "year" ? "s" : "";
  return `Tous les ${rec.interval} ${unitLabels[rec.unit]}${s}`;
}

// Inverse de la conversion faite à la création (voir handleSubmit) : un rule
// stocké avec freq="day"/"week"/"month"/"year" vient du mode "custom"
// (freq = l'unité choisie), les autres valeurs sont des préréglages simples.
function parseStoredRecurrence(rule: any): Recurrence {
  if (!rule || !rule.freq) return DEFAULT_RECURRENCE;
  const bareUnits: RecurrenceUnit[] = ["day", "week", "month", "year"];
  const interval = Math.max(1, Number(rule.interval) || 1);
  if (bareUnits.includes(rule.freq)) {
    return {
      ...DEFAULT_RECURRENCE,
      freq: "custom",
      unit: rule.freq as RecurrenceUnit,
      interval,
      endType: "count",
      count: DEFAULT_RECURRENCE.count,
    };
  }
  const simpleFreqs: RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly", "weekdays"];
  if (simpleFreqs.includes(rule.freq)) {
    return {
      ...DEFAULT_RECURRENCE,
      freq: rule.freq as RecurrenceFreq,
      interval: 1,
      endType: "count",
      count: DEFAULT_RECURRENCE.count,
    };
  }
  return DEFAULT_RECURRENCE;
}

function generateDates(
  startStr: string,
  durationHours: number,
  rec: Recurrence,
  // Duplication + récurrence : la date affichée sert juste de référence (jour
  // de semaine) pour le calcul du motif, pas une occurrence à recréer — la
  // source existe déjà ce jour-là. On saute donc la première date générée.
  skipFirst: boolean = false,
): { start: Date; end: Date }[] {
  const base = parseBrusselsDateTimeString(startStr);
  if (!base) return [];
  const dur = durationHours * 3600000;
  if (rec.freq === "none")
    return skipFirst ? [] : [{ start: base, end: new Date(base.getTime() + dur) }];
  const MAX = 365;
  // "À l'infini" : horizon glissant de 10 ans plutôt qu'un nombre fixe
  // d'occurrences — sinon une récurrence quotidienne s'arrêterait après 1 an
  // mais une annuelle irait jusqu'en l'an 2391. NEVER_MAX reste un filet de
  // sécurité (~1 occurrence/jour sur 10 ans) pour ne jamais surcharger la
  // création en masse côté serveur (voir MAX_RECURRING_BULK_OCCURRENCES).
  const NEVER_MAX = 4000;
  const targetCount =
    (rec.endType === "count" ? Math.max(1, Math.min(rec.count, MAX)) : NEVER_MAX) +
    (skipFirst ? 1 : 0);
  const endDate =
    rec.endType === "date" && rec.endDate
      ? new Date(rec.endDate + "T23:59:59")
      : rec.endType === "never"
        ? new Date(base.getFullYear() + 10, base.getMonth(), base.getDate(), 23, 59, 59)
        : null;
  const dates: { start: Date; end: Date }[] = [];
  if (rec.freq === "weekdays") {
    let cur = new Date(base);
    while (dates.length < targetCount) {
      if (endDate && cur > endDate) break;
      const d = cur.getDay();
      if (d >= 1 && d <= 5)
        dates.push({
          start: new Date(cur),
          end: new Date(cur.getTime() + dur),
        });
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 1);
    }
    return skipFirst ? dates.slice(1) : dates;
  }
  for (let i = 0; i < targetCount; i++) {
    const s = new Date(base);
    if (i > 0) {
      if (rec.freq === "daily") s.setDate(s.getDate() + i);
      else if (rec.freq === "weekly") s.setDate(s.getDate() + 7 * i);
      else if (rec.freq === "monthly") s.setMonth(s.getMonth() + i);
      else if (rec.freq === "yearly") s.setFullYear(s.getFullYear() + i);
      else if (rec.freq === "custom") {
        if (rec.unit === "day") s.setDate(s.getDate() + rec.interval * i);
        else if (rec.unit === "week")
          s.setDate(s.getDate() + 7 * rec.interval * i);
        else if (rec.unit === "month")
          s.setMonth(s.getMonth() + rec.interval * i);
        else if (rec.unit === "year")
          s.setFullYear(s.getFullYear() + rec.interval * i);
      }
    }
    if (endDate && s > endDate) break;
    dates.push({ start: s, end: new Date(s.getTime() + dur) });
  }
  return skipFirst ? dates.slice(1) : dates;
}

export default function AddInterventionScreen() {
  const router = useRouter();
  const {
    id,
    reprise_of,
    duplicate_of,
    convert_devis,
    from_view,
    from_date,
    from_zone,
    pending_not_done,
    pending_adjustments,
    pending_not_done_notes,
  } = useLocalSearchParams<{
    id?: string;
    reprise_of?: string;
    duplicate_of?: string;
    // "1" quand on arrive depuis le bouton "Changer en intervention" d'un
    // devis : réutilise le mécanisme de duplication (prestations, client,
    // prix pré-remplis) mais force le type "Intervention" au lieu de copier
    // "Devis" — voir l'effet de pré-remplissage plus bas.
    convert_devis?: string;
    from_view?: string;
    from_date?: string;
    from_zone?: string;
    // Checklist de clôture pas encore enregistrée : transmise depuis la fiche
    // intervention, à n'appliquer que si cette reprise (ou "pas de reprise")
    // est réellement confirmée ici — voir handleSubmit.
    pending_not_done?: string;
    pending_adjustments?: string;
    pending_not_done_notes?: string;
  }>();
  const isEditMode = !!id && !reprise_of && !duplicate_of;
  const isRepriseMode = !!reprise_of;
  const isConvertingDevis = !!duplicate_of && convert_devis === "1";
  // Duplication : même mécanisme de pré-remplissage que la reprise (catalogue,
  // taux horaire, prestations), mais sans le suivi "reprise prise/pas prise"
  // (ce n'est pas un RDV de suite, juste une copie sur un autre jour — utile
  // pour un chantier étalé sur plusieurs jours, ex: 3 jours x 8h).
  const isDuplicateMode = !!duplicate_of;
  const repriseSourceId = reprise_of || duplicate_of;

  const pendingNotDoneIds: string[] = useMemo(() => {
    if (!pending_not_done) return [];
    try {
      const parsed = JSON.parse(pending_not_done);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [pending_not_done]);
  const pendingAdjustmentItems: { label: string; price: number }[] = useMemo(() => {
    if (!pending_adjustments) return [];
    try {
      const parsed = JSON.parse(pending_adjustments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [pending_adjustments]);
  const pendingNotDoneNotes: Record<string, string> = useMemo(() => {
    if (!pending_not_done_notes) return {};
    try {
      const parsed = JSON.parse(pending_not_done_notes);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [pending_not_done_notes]);
  const hasPendingChecklist =
    pendingNotDoneIds.length > 0 || pendingAdjustmentItems.length > 0;

  const { isAdmin, isSubcontractor, userZone } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { isDark } = useTheme();
  const [isFormRenderReady, setIsFormRenderReady] = useState(isWeb);

  useEffect(() => {
    if (isWeb) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setIsFormRenderReady(true);
    });
    return () => task.cancel();
  }, [isWeb]);

  const { employees } = useEmployees();

  const { data: hourlyRates } = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: async () => (await api.get("/api/settings/hourly-rates")).data,
    enabled: isAdmin,
  });

  const { data: companySettings } = useCompanySettings();
  const hideCash = companySettings?.hide_cash ?? false;

  const { data: clients, refetch: refetchClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/api/clients")).data as Client[],
  });

  // Données pour edit normal
  const { data: interventionData, isLoading: isLoadingIntervention } = useQuery(
    {
      queryKey: ["intervention", id],
      queryFn: async () => {
        if (!id) return null;
        return (await api.get(`/api/interventions/${id}`)).data;
      },
      enabled: isEditMode,
      // La mise à jour optimiste après édition (applyEditIntervention) écrit
      // le payload d'envoi dans le cache, pas la forme exacte renvoyée par le
      // serveur (ex: items sans id/done) — sans "always", rouvrir le même RDV
      // dans les 30s (staleTime global) pouvait réhydrater le formulaire
      // depuis cette forme approximative plutôt que l'état réellement enregistré.
      refetchOnMount: "always",
    },
  );

  // Repli hors ligne : la fiche de détail vient d'être consultée pour arriver
  // ici ("Intervention terminée"), donc l'intervention source est déjà dans le
  // cache — soit sous ["intervention", id] (la fiche), soit dans une des
  // listes du planning. Sans ce repli, cette requête échouait silencieusement
  // hors réseau et le formulaire de reprise s'affichait entièrement vide
  // (client, titre, prestations non pré-remplis).
  const repriseSourceFromCache = useCallback(() => {
    if (!repriseSourceId) return undefined;
    const fromDetail = queryClient.getQueryData<any>(["intervention", repriseSourceId]);
    if (fromDetail) return fromDetail;
    const lists = queryClient.getQueriesData<any[]>({ queryKey: ["interventions"] });
    for (const [, data] of lists) {
      if (!Array.isArray(data)) continue;
      const found = data.find((i) => i?.id === repriseSourceId);
      if (found) return found;
    }
    return undefined;
  }, [queryClient, repriseSourceId]);

  // Données pour reprise/duplication (source originale)
  const { data: repriseSource, isLoading: isLoadingReprise } = useQuery({
    queryKey: ["intervention-reprise", repriseSourceId],
    queryFn: async () => {
      if (!repriseSourceId) return null;
      return (await api.get(`/api/interventions/${repriseSourceId}`)).data;
    },
    initialData: repriseSourceFromCache,
    initialDataUpdatedAt: 0,
    enabled: isRepriseMode || isDuplicateMode,
  });

  // --- States formulaire ---
  const [intervType, setIntervType] = useState<IntervType>("intervention");
  const [zone, setZone] = useState<"hainaut" | "ardennes">("hainaut");

  // --- Stats planning pour coloration jours (reprise) ---
  const [calendarMonth, setCalendarMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  });

  // Accumule toutes les stats chargées pour ne jamais perdre un mois déjà coloré
  const [allStats, setAllStats] = useState<Record<string, any>>({});

  const monthKey = (y: number, m: number) =>
    `${y}-${String(m).padStart(2, "0")}`;

  // Mois frontière = calendarMonth + 4
  const horizonMonthKey = useMemo(() => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const d = new Date(y, m + 3, 1); // +4 mois (m est 1-indexed, +3 en 0-indexed = +4 réel)
    return monthKey(d.getFullYear(), d.getMonth() + 1);
  }, [calendarMonth]);

  // Charge le mois frontière (un seul mois) quand on navigue
  const { data: horizonStats } = useQuery({
    queryKey: ["horizon-stats", zone, horizonMonthKey],
    queryFn: async () => {
      const [y, m] = horizonMonthKey.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return (await api.get(`/api/planning/range-stats?start_str=${start}&end_str=${end}&zone=${zone}`)).data as Record<string, any>;
    },
    enabled: isRepriseMode || isDuplicateMode,
    staleTime: 5 * 60 * 1000,
  });

  // Charge les 5 premiers mois une seule fois au montage
  const { data: initialStats } = useQuery({
    queryKey: ["initial-stats-reprise", zone],
    queryFn: async () => {
      const today = new Date();
      const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const d = new Date(today.getFullYear(), today.getMonth() + 5, 0);
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return (await api.get(`/api/planning/range-stats?start_str=${start}&end_str=${end}&zone=${zone}`)).data as Record<string, any>;
    },
    enabled: isRepriseMode || isDuplicateMode,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => { if (initialStats) setAllStats(prev => ({ ...prev, ...initialStats })); }, [initialStats]);
  useEffect(() => { if (horizonStats) setAllStats(prev => ({ ...prev, ...horizonStats })); }, [horizonStats]);

  const dayColors = useMemo(() => {
    if (Object.keys(allStats).length === 0) return undefined;
    const colors: Record<string, "green" | "orange" | "red"> = {};
    for (const [date, s] of Object.entries(allStats)) {
      const planned = (s as any).planned_hours ?? 0;
      const capacity = (s as any).capacity_hours ?? 0;
      if (capacity === 0) colors[date] = "red";
      else if (planned >= capacity) colors[date] = "orange";
      else colors[date] = "green";
    }
    return colors;
  }, [allStats]);
  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  // Services cochables par client
  const [checkedServiceIds, setCheckedServiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [servicePriceOverrides, setServicePriceOverrides] = useState<
    Record<string, string>
  >({});
  // Supplément "à la demande" (+33%) par prestation, par service id
  const [onDemandServiceIds, setOnDemandServiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [focusedServiceLabelId, setFocusedServiceLabelId] = useState<
    string | null
  >(null);
  const [serviceLabelDrafts, setServiceLabelDrafts] = useState<
    Record<string, string>
  >({});
  const serviceLabelTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const servicePriceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const [adHocItems, setAdHocItems] = useState<Item[]>([]);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceLabel, setNewServiceLabel] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "cash" | "invoice" | "invoice_cash"
  >("cash");
  const [amountCash, setAmountCash] = useState("");
  const [amountInvoice, setAmountInvoice] = useState("");

  useEffect(() => {
    if (hideCash && paymentMode === "invoice_cash") {
      setPaymentMode("invoice");
      setAmountCash("");
      setAmountInvoice("");
    }
  }, [hideCash, paymentMode]);

  const defaultStart = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const datePart = toBrusselsDateTimeString(tomorrow).split("T")[0];
    return `${datePart}T09:00`;
  }, []);
  const defaultEnd = useMemo(() => {
    const [datePart, timePart = "09:00"] = defaultStart.split("T");
    const [h, m] = timePart.split(":").map(Number);
    const endH = Math.min(h + 1, 23);
    return `${datePart}T${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [defaultStart]);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [endDateStr, setEndDateStr] = useState(defaultEnd);
  const [timeTbd, setTimeTbd] = useState(true);
  // Mode reprise uniquement : dates ad hoc sélectionnées dans le calendrier
  // (une intervention créée par date, pas une récurrence).
  const [repriseDates, setRepriseDates] = useState<string[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  // Sync date part of endDateStr when startDateStr changes, and ensure end > start
  useEffect(() => {
    const [startDate, startTime = "09:00"] = startDateStr.split("T");
    const endTime = endDateStr.split("T")[1] ?? "10:00";
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      const adjH = Math.min(sh + 1, 23);
      setEndDateStr(`${startDate}T${String(adjH).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
    } else {
      setEndDateStr(`${startDate}T${endTime}`);
    }
  }, [startDateStr]);

  // --- Récurrence ---
  const [recurrence, setRecurrence] = useState<Recurrence>(DEFAULT_RECURRENCE);
  // Motif d'origine d'une série en cours d'édition, pour détecter un
  // changement (voir isRecurringSeries / handleSubmit) — reste `null` tant
  // que ce n'est pas une édition de série récurrente.
  const originalRecurrenceRef = useRef<Recurrence | null>(null);
  const [showChangeRecurrenceDialog, setShowChangeRecurrenceDialog] = useState(false);
  const [isChangingRecurrence, setIsChangingRecurrence] = useState(false);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customIntervalStr, setCustomIntervalStr] = useState("1");
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>("week");
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>([]);
  const [customEndType, setCustomEndType] = useState<EndType>("count");
  const [customCountStr, setCustomCountStr] = useState("4");
  const [customEndDate, setCustomEndDate] = useState("");

  // --- Reprise : mode "non repris" ---

  // --- Nouveau client ---
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientStreet, setNewClientStreet] = useState("");
  const [newClientZip, setNewClientZip] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [ncFocused, setNcFocused] = useState<string | null>(null);
  const ncNameRef = useRef<TextInput>(null);
  const ncStreetRef = useRef<TextInput>(null);
  const ncZipRef = useRef<TextInput>(null);
  const ncCityRef = useRef<TextInput>(null);
  const ncPhoneRef = useRef<TextInput>(null);
  const ncEmailRef = useRef<TextInput>(null);
  const ncNotesRef = useRef<TextInput>(null);

  // Catalogue de services du client sélectionné
  const clientServicesQueryKey = ["client-services", selectedClient?.id];
  const { data: clientServices = [], refetch: refetchClientServices } =
    useQuery<ClientService[]>({
      queryKey: clientServicesQueryKey,
      queryFn: async () =>
        (await api.get(`/api/clients/${selectedClient!.id}/services`)).data,
      enabled: !!selectedClient?.id,
      // Toujours réconcilier le catalogue lorsque l'écran est ouvert en ligne,
      // mais ne jamais tenter cet appel hors connexion.
      staleTime: 0,
      refetchOnMount: "always",
      networkMode: "online",
    });

  const attachedClientServices = useMemo(
    () => servicesAttachedToIntervention(
      isEditMode ? interventionData : (isRepriseMode || isDuplicateMode) ? repriseSource : null,
    ),
    [isEditMode, isRepriseMode, isDuplicateMode, interventionData, repriseSource],
  );

  // La source de vérité de l'édition est l'intervention elle-même. Même si le
  // catalogue Android est ancien, ses prestations liées restent donc visibles
  // et cochées par leur véritable client_service_id.
  const availableClientServices = useMemo(
    () => mergeClientServices(clientServices, attachedClientServices),
    [clientServices, attachedClientServices],
  );

  // Catalogue de services pour une intervention SANS client : persiste par
  // reprise_chain_id (identité stable entre une intervention et ses reprises)
  // au lieu de client_id. Même logique de secours que ci-dessus, en miroir.
  // Prédit ici la même valeur que le backend assignera à la création : la
  // chaîne d'une source sans client_id ni reprise_chain_id, c'est elle-même.
  const activeChainId = useMemo(() => {
    const source = isEditMode ? interventionData : (isRepriseMode || isDuplicateMode) ? repriseSource : null;
    if (!source || source.client_id) return null;
    return source.reprise_chain_id || source.id || null;
  }, [isEditMode, isRepriseMode, isDuplicateMode, interventionData, repriseSource]);

  const chainServicesQueryKey = ["chain-services", activeChainId];
  const { data: chainServices = [] } = useQuery<ClientService[]>({
    queryKey: chainServicesQueryKey,
    queryFn: async () =>
      (
        await api.get("/api/interventions/chain-services", {
          params: { reprise_chain_id: activeChainId },
        })
      ).data,
    enabled: !selectedClient?.id && !!activeChainId,
    staleTime: 0,
    refetchOnMount: "always",
    networkMode: "online",
  });

  const attachedChainServices = useMemo(() => {
    const source = isEditMode ? interventionData : (isRepriseMode || isDuplicateMode) ? repriseSource : null;
    if (!source || source.client_id) return [];
    const real = servicesAttachedToIntervention(source, "intervention_service_id");
    // Encore ad-hoc côté serveur, mais affichées dès maintenant comme des
    // cases cochées : le backend les rattachera par libellé à la sauvegarde.
    const pending = pendingChainServices(
      source,
      real.length,
      isRepriseMode || isDuplicateMode,
    );
    return [...real, ...pending];
  }, [isEditMode, isRepriseMode, isDuplicateMode, interventionData, repriseSource]);

  const availableChainServices = useMemo(
    () => mergeClientServices(chainServices, attachedChainServices),
    [chainServices, attachedChainServices],
  );

  // Catalogue actif : celui du client si sélectionné, sinon celui de la
  // chaîne de reprises (sans client). Sur une intervention toute neuve, sans
  // client ni chaîne connue, on retombe sur les items ad-hoc (allItems ci-dessous).
  const availableServices = selectedClient?.id
    ? availableClientServices
    : availableChainServices;

  // `availableServices` mélange le catalogue réellement en ligne
  // (clientServices/chainServices) avec des lignes "attachées" affichées
  // uniquement pour garder l'historique visible (catalogue pas encore chargé,
  // ou entrée supprimée depuis) — leur id n'est pas forcément un service
  // catalogue existant. Ne persister que sur un vrai id du catalogue en
  // direct, sinon le PATCH renvoie 404 ("Service introuvable").
  const isLiveCatalogService = useCallback(
    (serviceId: string) =>
      selectedClient?.id
        ? clientServices.some((s) => s.id === serviceId)
        : chainServices.some((s) => s.id === serviceId),
    [selectedClient?.id, clientServices, chainServices],
  );

  const scheduleServiceLabelSave = useCallback(
    (serviceId: string, label: string) => {
      // "En attente" : rien à sauvegarder côté serveur pour l'instant — la
      // saisie reste dans serviceLabelDrafts et part avec la validation.
      if (isPendingChainId(serviceId)) return;
      if (!isLiveCatalogService(serviceId)) return;
      const clientId = selectedClient?.id;
      if (!clientId && !activeChainId) return;
      if (serviceLabelTimers.current[serviceId]) {
        clearTimeout(serviceLabelTimers.current[serviceId]);
      }
      serviceLabelTimers.current[serviceId] = setTimeout(async () => {
        try {
          if (clientId) {
            applyServiceRename(queryClient, clientId, serviceId, label);
            // Passe par la file : l'ancien `catch {}` avalait l'erreur, donc un
            // renommage hors réseau était perdu sans que l'ouvrier le sache.
            await enqueue({
              kind: "service-rename",
              method: "PATCH",
              url: `/api/clients/${clientId}/services/${serviceId}`,
              body: { label },
              label: `Prestation « ${label} »`,
            });
          } else if (activeChainId) {
            applyChainServiceRename(queryClient, activeChainId, serviceId, label);
            await enqueue({
              kind: "service-rename",
              method: "PATCH",
              url: `/api/interventions/chain-services/${serviceId}`,
              body: { label },
              label: `Prestation « ${label} »`,
            });
          }
        } finally {
          setServiceLabelDrafts((prev) => {
            const next = { ...prev };
            delete next[serviceId];
            return next;
          });
        }
      }, 500);
    },
    [selectedClient?.id, activeChainId, queryClient, isLiveCatalogService],
  );

  // Sauvegarde le prix d'une prestation dans le catalogue, indépendamment de
  // la case cochée : décocher une prestation l'exclut de cette intervention,
  // mais un prix corrigé ici doit rester acquis pour la prochaine fois.
  const scheduleServicePriceSave = useCallback(
    (serviceId: string, priceText: string) => {
      if (isPendingChainId(serviceId)) return;
      if (!isLiveCatalogService(serviceId)) return;
      const price = parseFloat(priceText.replace(",", "."));
      if (!Number.isFinite(price)) return;
      const clientId = selectedClient?.id;
      if (!clientId && !activeChainId) return;
      if (servicePriceTimers.current[serviceId]) {
        clearTimeout(servicePriceTimers.current[serviceId]);
      }
      servicePriceTimers.current[serviceId] = setTimeout(async () => {
        if (clientId) {
          applyServicePriceUpdate(queryClient, clientId, serviceId, price);
          await enqueue({
            kind: "service-price",
            method: "PATCH",
            url: `/api/clients/${clientId}/services/${serviceId}`,
            body: { price },
            label: "Prix de prestation",
          });
        } else if (activeChainId) {
          applyChainServicePriceUpdate(queryClient, activeChainId, serviceId, price);
          await enqueue({
            kind: "service-price",
            method: "PATCH",
            url: `/api/interventions/chain-services/${serviceId}`,
            body: { price },
            label: "Prix de prestation",
          });
        }
      }, 500);
    },
    [selectedClient?.id, activeChainId, queryClient, isLiveCatalogService],
  );

  // Détail du client sélectionné (dont ses autres RDV), pour avertir des doublons
  const { data: selectedClientDetail } = useQuery({
    queryKey: ["client-detail", selectedClient?.id],
    queryFn: async () =>
      (await api.get(`/api/clients/${selectedClient!.id}`)).data,
    enabled: !!selectedClient?.id,
  });

  const upcomingClientInterventions = useMemo(() => {
    if (!selectedClientDetail?.interventions) return [];
    const now = new Date();
    const excludedIds = new Set([id, reprise_of].filter(Boolean));
    return selectedClientDetail.interventions
      .filter(
        (it: any) =>
          ["planned", "in_progress"].includes(it.status) &&
          new Date(it.start_time) > now &&
          !excludedIds.has(it.id),
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [selectedClientDetail, id, reprise_of]);

  const createClientMutation = useMutation({
    mutationFn: async (data: any) =>
      (await api.post("/api/clients", data)).data as Client,
    onSuccess: async (newClient) => {
      await refetchClients();
      setSelectedClient(newClient);
      setShowNewClient(false);
      setNewClientName("");
      setNewClientStreet("");
      setNewClientZip("");
      setNewClientCity("");
      setNewClientPhone("");
      setNewClientEmail("");
      setNewClientNotes("");
      toast.success(
        "Client créé",
        newClient.name || newClient.address || "Client anonyme",
      );
    },
    onError: (err: any) =>
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue"),
  });

  const handleCreateClient = () => {
    if (
      !newClientStreet.trim() &&
      !newClientCity.trim() &&
      !newClientPhone.trim()
    )
      return toast.error(
        "Données manquantes",
        "Renseigne au moins l'adresse ou le téléphone.",
      );
    const addressParts = [newClientStreet, newClientZip, newClientCity].filter(
      Boolean,
    );
    createClientMutation.mutate({
      name: newClientName.trim() || null,
      street: newClientStreet || null,
      zip_code: newClientZip || null,
      city: newClientCity || null,
      address: addressParts.join(", ") || null,
      phone: newClientPhone || null,
      email: newClientEmail || null,
      notes: newClientNotes || null,
    });
  };

  // Charger les données d'édition normale
  // Ne réhydrate qu'une fois par intervention : un refetch de `interventionData`
  // (ex: resync de l'outbox après ajout/suppression d'une prestation catalogue)
  // ne doit pas écraser les modifications locales pas encore sauvegardées
  // (prix édité, cases cochées/décochées).
  const hydratedEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isEditMode &&
      interventionData &&
      hydratedEditIdRef.current !== interventionData.id
    ) {
      hydratedEditIdRef.current = interventionData.id;
      setTitle(interventionData.title);
      setDescription(interventionData.description || "");
      setPaymentMode(
        (interventionData.payment_mode as any) ??
          (interventionData.is_invoice ? "invoice" : "cash"),
      );
      setAmountCash(interventionData.amount_cash != null ? String(interventionData.amount_cash) : "");
      setAmountInvoice(interventionData.amount_invoice != null ? String(interventionData.amount_invoice) : "");
      if (interventionData.type)
        setIntervType(interventionData.type as IntervType);
      if (interventionData.zone)
        setZone(interventionData.zone as "hainaut" | "ardennes");
      const start = new Date(interventionData.start_time);
      const end = new Date(interventionData.end_time);
      setStartDateStr(toBrusselsDateTimeString(start));
      setEndDateStr(toBrusselsDateTimeString(end));
      setTimeTbd(interventionData.time_tbd ?? false);
      if (interventionData.recurrence_group_id) {
        const parsed = parseStoredRecurrence(interventionData.recurrence_rule);
        originalRecurrenceRef.current = parsed;
        setRecurrence(parsed);
      }
      const interventionClientId = interventionData.client_id ?? interventionData.client?.id;
      const foundClient = clients?.find((c) => c.id === interventionClientId);
      if (foundClient) setSelectedClient(foundClient);
      else if (interventionData.client)
        setSelectedClient(interventionData.client);

      // Hors ligne, le catalogue complet du client n'a peut-être jamais été
      // ouvert. Les prestations déjà attachées à l'intervention suffisent
      // néanmoins pour afficher les lignes cochées et conserver leur total.
      // Elles sont fusionnées par id avec tout catalogue déjà en cache.
      if (interventionClientId) {
        const attachedServices = servicesAttachedToIntervention(interventionData);
        if (attachedServices.length > 0) {
          queryClient.setQueryData<ClientService[]>(
            ["client-services", interventionClientId],
            (current) => mergeClientServices(current ?? [], attachedServices),
          );
        }
      } else if (!interventionData.client_id) {
        // Même repli hors ligne, côté catalogue de chaîne (intervention sans client).
        const chainId = interventionData.reprise_chain_id || interventionData.id;
        const attachedChain = servicesAttachedToIntervention(interventionData, "intervention_service_id");
        if (chainId && attachedChain.length > 0) {
          queryClient.setQueryData<ClientService[]>(
            ["chain-services", chainId],
            (current) => mergeClientServices(current ?? [], attachedChain),
          );
        }
      }
      if (interventionData.employees)
        setSelectedEmployeeIds(
          interventionData.employees.map((e: any) => e.id),
        );
      if (interventionData.hourly_rate_id)
        setSelectedRateId(interventionData.hourly_rate_id);
      if (interventionData.items && interventionData.items.length > 0) {
        // Sans client, toute prestation (même sans id encore) devient une
        // case cochée : la chaîne existe toujours pour une intervention déjà
        // sauvegardée, donc rien ne reste durablement en ad-hoc ici.
        const resolveId = (i: any) =>
          i.client_service_id || i.intervention_service_id ||
          (!interventionClientId ? pendingChainId(i.label) : null);
        const withId = interventionData.items.filter((i: any) => resolveId(i));
        const withoutId = interventionData.items.filter((i: any) => !resolveId(i));
        setCheckedServiceIds(new Set(withId.map((i: any) => String(resolveId(i)))));
        const overrides: Record<string, string> = {};
        withId.forEach((i: any) => {
          overrides[String(resolveId(i))] = i.price.toString();
        });
        setServicePriceOverrides(overrides);
        setOnDemandServiceIds(
          new Set(
            withId
              .filter((i: any) => i.on_demand)
              .map((i: any) => String(resolveId(i))),
          ),
        );
        setAdHocItems(
          withoutId.map((i: any) => ({
            label: i.label,
            price: i.price.toString(),
            on_demand: i.on_demand ?? false,
          })),
        );
      }
    }
  }, [isEditMode, interventionData, clients, queryClient]);

  // Pré-remplir depuis la source reprise/duplication
  // Même garde que pour l'édition normale : un refetch de `repriseSource` ne
  // doit pas écraser les modifications locales déjà faites par l'utilisateur.
  const hydratedRepriseIdRef = useRef<string | null>(null);
  useEffect(() => {
    // `clients` n'est volontairement pas mis en cache hors ligne (~3000
    // entrées, inutiles offline : chaque intervention embarque déjà son
    // client). Attendre `clients` bloquait donc tout le pré-remplissage hors
    // réseau, alors que `repriseSource.client` suffit (repli plus bas).
    if (
      (isRepriseMode || isDuplicateMode) &&
      repriseSource &&
      hydratedRepriseIdRef.current !== repriseSource.id
    ) {
      hydratedRepriseIdRef.current = repriseSource.id;
      setTitle(repriseSource.title);
      setDescription(repriseSource.description || "");
      setPaymentMode(
        (repriseSource.payment_mode as any) ??
          (repriseSource.is_invoice ? "invoice" : "cash"),
      );
      if (isConvertingDevis) setIntervType("intervention");
      else if (repriseSource.type) setIntervType(repriseSource.type as IntervType);
      if (repriseSource.zone)
        setZone(repriseSource.zone as "hainaut" | "ardennes");

      const origStart = new Date(repriseSource.start_time);
      const origEnd = new Date(repriseSource.end_time);
      const nextDate = new Date(origStart);
      // Reprise = +1 semaine par défaut (RDV suivant) ; duplication = même
      // jour que la source (sert de base à une récurrence sur le même jour
      // de semaine — modifiable ensuite si besoin d'un autre jour ponctuel).
      nextDate.setDate(nextDate.getDate() + (isDuplicateMode ? 0 : 7));
      const nextEnd = new Date(nextDate.getTime() + (origEnd.getTime() - origStart.getTime()));
      setStartDateStr(toBrusselsDateTimeString(nextDate));
      setEndDateStr(toBrusselsDateTimeString(nextEnd));
      setTimeTbd(isAdmin ? (repriseSource.time_tbd ?? true) : true);
      // Pas de date pré-cochée dans le calendrier multi-dates : un employé
      // qui oublie de la décocher se retrouvait avec un RDV en trop (le J+7
      // suggéré, en plus des dates qu'il sélectionnait vraiment).

      const repriseClientId = repriseSource.client_id ?? repriseSource.client?.id;
      const foundClient = clients?.find((c) => c.id === repriseClientId);
      if (foundClient) setSelectedClient(foundClient);
      else if (repriseSource.client) setSelectedClient(repriseSource.client);

      if (repriseClientId) {
        const attachedServices = servicesAttachedToIntervention(repriseSource);
        if (attachedServices.length > 0) {
          queryClient.setQueryData<ClientService[]>(
            ["client-services", repriseClientId],
            (current) => mergeClientServices(current ?? [], attachedServices),
          );
        }
      } else if (!repriseSource.client_id) {
        const chainId = repriseSource.reprise_chain_id || repriseSource.id;
        const attachedChain = servicesAttachedToIntervention(repriseSource, "intervention_service_id");
        if (chainId && attachedChain.length > 0) {
          queryClient.setQueryData<ClientService[]>(
            ["chain-services", chainId],
            (current) => mergeClientServices(current ?? [], attachedChain),
          );
        }
      }

      if (repriseSource.hourly_rate_id)
        setSelectedRateId(repriseSource.hourly_rate_id);
      if (repriseSource.employees)
        setSelectedEmployeeIds(repriseSource.employees.map((e: any) => e.id));
      if (repriseSource.items && repriseSource.items.length > 0) {
        // Sans client, la chaîne existera dès la sauvegarde de cette reprise
        // (source déjà existante = déjà un id à utiliser comme chaîne) : une
        // prestation encore sans id s'affiche donc déjà cochée, en attente.
        const resolveId = (i: any) =>
          i.client_service_id || i.intervention_service_id ||
          (!repriseClientId ? pendingChainId(i.label) : null);
        // Les corrections de prix ajoutées à la clôture (déduction partielle,
        // supplément imprévu) ne sont pas des prestations récurrentes : elles
        // ne doivent pas se retrouver précochées sur la reprise suivante.
        const repriseItems = repriseSource.items.filter((i: any) => !i.is_adjustment);
        const withId = repriseItems.filter((i: any) => resolveId(i));
        const withoutId = repriseItems.filter((i: any) => !resolveId(i));
        setCheckedServiceIds(new Set(withId.map((i: any) => String(resolveId(i)))));
        const overrides: Record<string, string> = {};
        withId.forEach((i: any) => {
          overrides[String(resolveId(i))] = i.price.toString();
        });
        setServicePriceOverrides(overrides);
        setOnDemandServiceIds(
          new Set(
            withId
              .filter((i: any) => i.on_demand)
              .map((i: any) => String(resolveId(i))),
          ),
        );
        setAdHocItems(
          withoutId.map((i: any) => ({
            label: i.label,
            price: i.price.toString(),
            on_demand: i.on_demand ?? false,
          })),
        );
      }
    }
  }, [isRepriseMode, isDuplicateMode, repriseSource, clients, queryClient]); // clients optionnel, cf. commentaire ci-dessus

  // Reset form quand on navigue vers "nouveau" (pas edit, pas reprise, pas duplication)
  useFocusEffect(
    useCallback(() => {
      if (!isEditMode && !isRepriseMode && !isDuplicateMode) {
        setTitle("");
        setDescription("");
        setIntervType("intervention");
        setZone("hainaut");
        setSelectedClient(null);
        setSelectedEmployeeIds([]);
        setCheckedServiceIds(new Set());
        setServicePriceOverrides({});
        setOnDemandServiceIds(new Set());
        setAdHocItems([]);
        setPaymentMode(hideCash ? "invoice" : "cash");
        setAmountCash("");
        setAmountInvoice("");
        setStartDateStr(defaultStart);
        setEndDateStr(defaultEnd);
        setTimeTbd(true);
        setRecurrence(DEFAULT_RECURRENCE);
        setShowRecurrenceDropdown(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, isRepriseMode, isDuplicateMode]),
  );

  // Items finaux = services cochés + items ad-hoc
  const allItems = useMemo(() => {
    const usingChain = !selectedClient?.id;
    const serviceItems = availableServices
      .filter((s) => checkedServiceIds.has(s.id))
      .map((s) => {
        const pending = usingChain && isPendingChainId(s.id);
        return {
          label: serviceLabelDrafts[s.id] ?? s.label,
          price: servicePriceOverrides[s.id] ?? s.price.toString(),
          // "En attente" : pas encore de vraie entrée catalogue côté serveur —
          // envoyé en simple label+prix, le backend la relie par libellé au
          // moment de la sauvegarde (voir _migrate_orphan_items_to_chain).
          client_service_id: usingChain || pending ? undefined : s.id,
          intervention_service_id: usingChain && !pending ? s.id : undefined,
          on_demand: onDemandServiceIds.has(s.id),
        };
      });
    return [...serviceItems, ...adHocItems];
  }, [availableServices, selectedClient?.id, checkedServiceIds, servicePriceOverrides, onDemandServiceIds, serviceLabelDrafts, adHocItems]);

  const totalPrice = useMemo(
    () =>
      allItems.reduce((acc, item) => {
        if ((item as Item).negative) return acc + signedPrice(item as Item);
        const base = parseFloat((item.price as string).replace(",", ".")) || 0;
        return acc + (item.on_demand ? onDemandPrice(base) : base);
      }, 0),
    [allItems],
  );

  // Solde cash reporté (client absent au RDV précédent) que cette reprise
  // absorbe : lu directement sur la source (pas besoin de chaîne, marche
  // avec ou sans client lié), le backend l'ajoute automatiquement au prix
  // total à la création (voir settle_deferred_intervention_id).
  const pendingDeferredAmount =
    isRepriseMode && !isDuplicateMode && repriseSource?.deferred_cash_amount != null && !repriseSource?.deferred_settled_by_intervention_id
      ? Number(repriseSource.deferred_cash_amount) || 0
      : 0;
  const paymentTotal = totalPrice + pendingDeferredAmount;

  const selectedRate =
    (hourlyRates as any[])?.find((r: any) => r.id === selectedRateId) ?? null;
  const computedHoursRaw =
    selectedRate && totalPrice > 0
      ? Math.round((totalPrice / selectedRate.rate) * 4) / 4
      : null;
  const computedHours =
    computedHoursRaw != null
      ? (() => {
          const h = Math.floor(computedHoursRaw);
          const m = Math.round((computedHoursRaw % 1) * 60);
          return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
        })()
      : null;

  const durationHours = (() => {
    if (timeTbd) return null;
    const [, startTime = ""] = startDateStr.split("T");
    const [, endTime = ""] = endDateStr.split("T");
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return null;
    return diff / 60;
  })();

  const toggleService = (id: string) => {
    setCheckedServiceIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleServiceOnDemand = (id: string) => {
    setOnDemandServiceIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addAdHocItem = () =>
    setAdHocItems((prev) => [...prev, { label: "", price: "" }]);
  const removeAdHocItem = (index: number) =>
    setAdHocItems((prev) => prev.filter((_, i) => i !== index));
  const updateAdHocItem = (
    index: number,
    field: "label" | "price",
    value: string,
  ) => {
    setAdHocItems((prev) => {
      const n = [...prev];
      n[index] = { ...n[index], [field]: value };
      return n;
    });
  };
  const toggleAdHocOnDemand = (index: number) => {
    setAdHocItems((prev) => {
      const n = [...prev];
      n[index] = { ...n[index], on_demand: !n[index].on_demand };
      return n;
    });
  };
  const toggleAdHocNegative = (index: number) => {
    setAdHocItems((prev) => {
      const n = [...prev];
      const negative = !n[index].negative;
      // Un remboursement ne peut pas être majoré "à la demande".
      n[index] = { ...n[index], negative, on_demand: negative ? false : n[index].on_demand };
      return n;
    });
  };

  const NO_CLIENT_ID = "__none__";
  const clientItems = useMemo(
    () => [
      { id: NO_CLIENT_ID, label: "Aucun", muted: true },
      ...(clients ?? []).map((c) => ({
        id: c.id,
        label: c.name || c.address || "Client anonyme",
      })),
    ],
    [clients],
  );
  const employeeItems = useMemo(
    () =>
      (employees ?? []).map((e) => ({
        id: e.id,
        label: e.full_name || e.email,
        color: e.color,
      })),
    [employees],
  );

  // --- Mutation principale (création / édition) ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecurrenceScopeDialog, setShowRecurrenceScopeDialog] = useState(false);
  const isRecurringSeries =
    isAdmin && isEditMode && !!interventionData?.recurrence_group_id;
  // Un employé qui ouvre un RDV futur (pas encore assigné) depuis l'écran de
  // reprise n'a besoin que de cocher/décocher les prestations et laisser une
  // note — pas de toucher au client, au titre ou à l'horaire.
  const isQuickPrepMode = isEditMode && !isAdmin;
  const original = originalRecurrenceRef.current;
  const recurrencePatternChanged =
    isRecurringSeries &&
    !!original &&
    (recurrence.freq !== original.freq ||
      recurrence.interval !== original.interval ||
      recurrence.unit !== original.unit);

  const handleSubmit = async (scope: "this" | "following" | "all" = "this") => {
    if (!title) return toast.error("Titre", "Titre requis.");
    const splitError = validatePaymentSplit(paymentMode, paymentTotal, amountCash, amountInvoice);
    if (splitError) return toast.error("Paiement", splitError);
    const datePart = startDateStr.split("T")[0];
    let startParsed: Date, endParsed: Date, dur: number;
    if (timeTbd) {
      startParsed = parseBrusselsDateTimeString(`${datePart}T00:00`);
      endParsed = parseBrusselsDateTimeString(`${datePart}T01:00`);
      dur = 1;
    } else {
      startParsed = parseBrusselsDateTimeString(startDateStr);
      endParsed = parseBrusselsDateTimeString(endDateStr);
      if (!startParsed || !endParsed) return toast.error("Date", "Vérifie les horaires.");
      dur = (endParsed.getTime() - startParsed.getTime()) / 3600000;
      if (dur <= 0) return toast.error("Horaires", "L'heure de fin doit être après l'heure de début.");
    }

    setIsSubmitting(true);
    try {
      const cleanItems = allItems.filter((i) => i.label.trim() !== "");
      const basePayload = {
        type: intervType,
        title,
        description,
        zone: isAdmin ? zone : userZone,
        client_id: selectedClient?.id ?? null,
        employee_ids: selectedEmployeeIds,
        price_estimated: totalPrice,
        payment_mode: paymentMode,
        is_invoice: paymentMode !== "cash",
        amount_cash: paymentMode === "invoice_cash" ? parseFloat(amountCash.replace(",", ".")) || 0 : null,
        amount_invoice: paymentMode === "invoice_cash" ? parseFloat(amountInvoice.replace(",", ".")) || 0 : null,
        items: cleanItems.map((i) => ({
          label: i.label,
          price: (i as Item).negative ? signedPrice(i as Item) : parseFloat(String(i.price).replace(",", ".")) || 0,
          client_service_id: i.client_service_id ?? null,
          intervention_service_id: i.intervention_service_id ?? null,
          on_demand: i.on_demand ?? false,
        })),
        hourly_rate_id: isAdmin
          ? (selectedRateId ?? null)
          : isRepriseMode
          ? (repriseSource?.hourly_rate_id ?? null)
          : null,
        ...(pendingDeferredAmount > 0 ? { settle_deferred_intervention_id: repriseSourceId } : {}),
      };

      if (isEditMode) {
        let startIso: string, endIso: string;
        if (!isAdmin) {
          const datePart = startDateStr.split("T")[0];
          const startUtc = new Date(`${datePart}T00:00:00Z`);
          const endUtc = new Date(startUtc.getTime() + dur * 3600000);
          startIso = startUtc.toISOString();
          endIso = endUtc.toISOString();
        } else {
          startIso = startParsed.toISOString();
          endIso = endParsed.toISOString();
        }
        const editPayload = {
          ...basePayload,
          start_time: startIso,
          end_time: endIso,
          time_tbd: isAdmin ? timeTbd : true,
        };
        applyEditIntervention(queryClient, String(id), editPayload);
        await enqueue({
          kind: "edit-intervention",
          method: "PATCH",
          url: `/api/interventions/${id}`,
          body: editPayload,
          label: "Modification de l'intervention",
        });
        if (scope !== "this") {
          // Propage tout sauf les horaires (chaque occurrence garde sa propre
          // date/heure) aux autres lignes de la série — résolues côté serveur
          // via recurrence_group_id, donc passable par la file hors-ligne.
          await enqueue({
            kind: "edit-intervention-scope",
            method: "PATCH",
            url: `/api/interventions/${id}/recurrence-scope`,
            body: { scope, fields: basePayload },
            label:
              scope === "all"
                ? "Modification de toute la série"
                : "Modification de cette occurrence et des suivantes",
          });
        }
        toast.success(
          "Succès",
          isOnlineNow()
            ? "Intervention modifiée !"
            : "Modifiée. Sera synchronisée au retour du réseau.",
        );
        // Prep rapide (RDV futur ouvert depuis l'écran de reprise) : on
        // revient sur cet écran de reprise, pas sur le planning général.
        if (isQuickPrepMode && router.canGoBack()) {
          router.back();
        } else {
          router.dismissTo({
            pathname: "/(app)/calendar",
            params: {
              date: from_date ?? startDateStr.split("T")[0],
              ...(from_view ? { view: from_view } : {}),
              ...(from_zone ? { zone: from_zone } : {}),
            },
          });
        }
        return;
      }

      // Calcul des occurrences (reprise multi-dates, reprise/employé simple,
      // ou création admin avec récurrence)
      let occurrences: { start: Date; end: Date }[];
      if (isRepriseMode) {
        // Dates ad hoc sélectionnées dans le calendrier, pas une récurrence :
        // une occurrence indépendante par date, même heure/durée pour toutes.
        const timePart = startDateStr.split("T")[1] || "09:00";
        occurrences = repriseDates
          .map((dateStr) => {
            if (!isAdmin) {
              const startUtc = new Date(`${dateStr}T00:00:00Z`);
              return { start: startUtc, end: new Date(startUtc.getTime() + dur * 3600000) };
            }
            const base = parseBrusselsDateTimeString(`${dateStr}T${timePart}`);
            return base ? { start: base, end: new Date(base.getTime() + dur * 3600000) } : null;
          })
          .filter((o): o is { start: Date; end: Date } => o !== null);
      } else if (!isAdmin) {
        // Non-admin : date-only, pas de récurrence, time_tbd = true
        const datePart = startDateStr.split("T")[0];
        const startUtc = new Date(`${datePart}T00:00:00Z`);
        const endUtc = new Date(startUtc.getTime() + dur * 3600000);
        occurrences = [{ start: startUtc, end: endUtc }];
      } else {
        occurrences = generateDates(
          startDateStr,
          dur,
          recurrence,
          isDuplicateMode && recurrence.freq !== "none",
        );
      }
      if (occurrences.length === 0)
        return toast.error("Date", isRepriseMode ? "Sélectionne au moins une date." : "Vérifie la date.");

      if (
        !isRepriseMode &&
        recurrence.endType === "never" &&
        occurrences.length > 1
      ) {
        // Série "à l'infini" : horizon de plusieurs années, donc
        // potentiellement des milliers d'occurrences (aussi bien en création
        // qu'en duplication d'un RDV existant transformé en série). Un POST
        // par occurrence bloquerait l'appli le temps de tout envoyer (surtout
        // sur web où chaque envoi est attendu un par un) : on passe par un
        // endpoint dédié qui crée tout en une seule requête, un seul commit
        // côté serveur — pas de file d'attente hors-ligne ici, cette action
        // admin nécessite déjà une connexion (même principe que bulk-assign).
        const recurrenceRule = {
          freq: recurrence.freq === "custom" ? recurrence.unit : recurrence.freq,
          interval: recurrence.freq === "custom" ? recurrence.interval : 1,
          endType: "never",
        };
        const sourceGroupId = isDuplicateMode
          ? (repriseSource?.recurrence_group_id ?? undefined)
          : undefined;
        const groupId = sourceGroupId ?? newUuidV4();
        try {
          if (isDuplicateMode && repriseSourceId && !sourceGroupId) {
            // La source existe déjà et représente la 1ère occurrence : on la
            // rattache rétroactivement à la série tout juste créée.
            applyEditIntervention(queryClient, String(repriseSourceId), {
              recurrence_group_id: groupId,
              recurrence_rule: recurrenceRule,
            });
            await api.patch(`/api/interventions/${repriseSourceId}`, {
              recurrence_group_id: groupId,
              recurrence_rule: recurrenceRule,
            });
          }
          const { data } = await api.post("/api/interventions/recurring-bulk", {
            ...basePayload,
            status: "planned",
            time_tbd: isAdmin ? timeTbd : true,
            recurrence_rule: recurrenceRule,
            recurrence_group_id: groupId,
            // Série "sans fin" convertie depuis un devis : permet au backend
            // de marquer le devis source comme converti (voir create_recurring_bulk).
            ...(isConvertingDevis && repriseSourceId ? { reprise_of_id: repriseSourceId } : {}),
            occurrences: occurrences.map((o) => ({
              start_time: o.start.toISOString(),
              end_time: o.end.toISOString(),
            })),
            client_operation_id: newUuidV4(),
          });
          toast.success("Succès", `${data.created} interventions créées !`);
          queryClient.invalidateQueries({ queryKey: ["interventions"] });
          if (isDuplicateMode && duplicate_of) {
            router.dismissTo({
              pathname: "/(app)/calendar/[id]",
              params: { id: String(duplicate_of) },
            });
          } else {
            router.dismissTo({
              pathname: "/(app)/calendar",
              params: {
                date: from_date ?? startDateStr.split("T")[0],
                ...(from_view ? { view: from_view } : {}),
                ...(from_zone ? { zone: from_zone } : {}),
              },
            });
          }
        } catch (e) {
          toast.error("Erreur", "Impossible de créer la série récurrente.");
        }
        return;
      }

      // En duplication, l'intervention source existe déjà et représente la
      // première occurrence de la série : elle doit donc en faire partie
      // (même recurrence_group_id), pas seulement les copies nouvellement
      // créées. Si la source appartenait déjà à une série, on la rejoint au
      // lieu d'en ouvrir une nouvelle.
      const sourceGroupId = isDuplicateMode
        ? (repriseSource?.recurrence_group_id ?? undefined)
        : undefined;
      // Les dates de reprise multi-sélectionnées sont des RDV indépendants,
      // pas une série récurrente : jamais de recurrence_group_id pour elles.
      const groupId =
        !isRepriseMode && occurrences.length > 1 ? sourceGroupId ?? newUuidV4() : undefined;

      if (isDuplicateMode && repriseSourceId && groupId && !sourceGroupId) {
        const sourceRecurrenceRule = {
          freq:
            recurrence.freq === "custom" ? recurrence.unit : recurrence.freq,
          interval: recurrence.freq === "custom" ? recurrence.interval : 1,
          count: occurrences.length + 1,
        };
        applyEditIntervention(queryClient, String(repriseSourceId), {
          recurrence_group_id: groupId,
          recurrence_rule: sourceRecurrenceRule,
        });
        await enqueue({
          kind: "edit-intervention",
          method: "PATCH",
          url: `/api/interventions/${repriseSourceId}`,
          body: {
            recurrence_group_id: groupId,
            recurrence_rule: sourceRecurrenceRule,
          },
          label: "Rattachement à la série",
        });
      }

      // Chaque occurrence part comme une entrée distincte, avec sa propre clé
      // d'idempotence : un rejeu ne peut pas dupliquer une occurrence isolée.
      for (const occ of occurrences) {
        const payload = {
          ...basePayload,
          start_time: occ.start.toISOString(),
          end_time: occ.end.toISOString(),
          time_tbd: isAdmin ? timeTbd : true,
          ...((isRepriseMode || isDuplicateMode) && repriseSourceId
            ? { reprise_of_id: repriseSourceId }
            : {}),
          recurrence_rule:
            !isRepriseMode && occurrences.length > 1
              ? {
                  freq:
                    recurrence.freq === "custom"
                      ? recurrence.unit
                      : recurrence.freq,
                  interval:
                    recurrence.freq === "custom" ? recurrence.interval : 1,
                  count: occurrences.length,
                }
              : null,
          recurrence_group_id: groupId ?? null,
        };

        // Affiché immédiatement dans le planning, marqué en attente de synchro.
        const tempId = newTempId();
        applyCreateReprise(queryClient, tempId, payload);

        // `tempId` permet à l'outbox de résoudre cet id temporaire vers le
        // vrai id serveur une fois la création envoyée : sans ça, une action
        // ultérieure sur cette même occurrence encore affichée avec son id
        // temporaire (ex. supprimer "celle-ci et les suivantes" juste après
        // création) échoue avec "Référence non résolue", faute de savoir que
        // la création a bien abouti.
        await enqueue({
          kind: "create-reprise",
          method: "POST",
          url: "/api/interventions",
          body: payload,
          tempId,
          label: isRepriseMode
            ? "RDV de reprise"
            : isDuplicateMode
              ? "Copie d'intervention"
              : "Nouvelle intervention",
        });
      }

      // Si reprise : marquer l'originale comme done.
      // `real_end_time` a été retiré : la colonne n'existe pas dans le modèle,
      // le champ était silencieusement ignoré par le serveur.
      if (isRepriseMode && reprise_of) {
        applyMarkDone(queryClient, String(reprise_of), { repriseTaken: true });
        await enqueue({
          kind: "mark-done",
          method: "PATCH",
          url: `/api/interventions/${reprise_of}`,
          body: { status: "done", reprise_taken: true },
          label: "Clôture de l'intervention",
        });
        // Checklist de clôture préparée sur la fiche d'origine, appliquée
        // seulement maintenant que la reprise est réellement confirmée.
        if (hasPendingChecklist) {
          applyItemsDone(queryClient, String(reprise_of), pendingNotDoneIds, pendingAdjustmentItems);
          await enqueue({
            kind: "items-done",
            method: "PATCH",
            url: `/api/interventions/${reprise_of}/items-done`,
            body: {
              not_done_item_ids: pendingNotDoneIds,
              new_items: pendingAdjustmentItems,
              not_done_notes: pendingNotDoneNotes,
            },
            label: "Prestations réalisées",
          });
        }
      }

      const msg =
        occurrences.length > 1
          ? `${occurrences.length} interventions créées !`
          : isRepriseMode
            ? "RDV de reprise planifié !"
            : isConvertingDevis
              ? "Devis converti en intervention !"
              : isDuplicateMode
                ? "Intervention dupliquée !"
                : "Intervention créée !";
      toast.success(
        "Succès",
        isOnlineNow() ? msg : `${msg} Sera synchronisé au retour du réseau.`,
      );

      if (isRepriseMode && reprise_of) {
        router.dismissTo({
          pathname: "/(app)/calendar",
          params: { date: new Date().toISOString().split("T")[0], view: "day" },
        });
      } else if (isDuplicateMode && duplicate_of) {
        // Retour sur la fiche source : pratique pour dupliquer à nouveau
        // (chantier sur plusieurs jours, ex: dupliquer une 3e fois pour le jour 3).
        router.dismissTo(`/(app)/calendar/${duplicate_of}` as any);
      } else {
        router.dismissTo({
          pathname: "/(app)/calendar",
          params: {
            date: startDateStr,
            ...(from_view ? { view: from_view } : {}),
            ...(from_zone ? { zone: from_zone } : {}),
          },
        });
      }
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Changement du motif de récurrence d'une série existante : le backend ne
  // sait pas modifier recurrence_rule en place (bloqué explicitement côté
  // scope d'édition), donc on supprime cette occurrence et celles qui suivent
  // (endpoint existant, déjà utilisé pour la suppression de série) puis on
  // les recrée avec le nouveau motif — même logique que la création d'une
  // série neuve. Les occurrences passées ne sont jamais touchées.
  const handleChangeRecurrence = async () => {
    if (!id || !interventionData?.recurrence_group_id) return;
    if (!title) return toast.error("Titre", "Titre requis.");
    const datePart = startDateStr.split("T")[0];
    let startParsed: Date, endParsed: Date, dur: number;
    if (timeTbd) {
      startParsed = parseBrusselsDateTimeString(`${datePart}T00:00`);
      endParsed = parseBrusselsDateTimeString(`${datePart}T01:00`);
      dur = 1;
    } else {
      startParsed = parseBrusselsDateTimeString(startDateStr);
      endParsed = parseBrusselsDateTimeString(endDateStr);
      if (!startParsed || !endParsed) return toast.error("Date", "Vérifie les horaires.");
      dur = (endParsed.getTime() - startParsed.getTime()) / 3600000;
      if (dur <= 0) return toast.error("Horaires", "L'heure de fin doit être après l'heure de début.");
    }

    setIsChangingRecurrence(true);
    try {
      const groupId = interventionData.recurrence_group_id;
      const cleanItems = allItems.filter((i) => i.label.trim() !== "");
      const basePayload = {
        type: intervType,
        title,
        description,
        zone: isAdmin ? zone : userZone,
        client_id: selectedClient?.id ?? null,
        employee_ids: selectedEmployeeIds,
        price_estimated: totalPrice,
        payment_mode: paymentMode,
        is_invoice: paymentMode !== "cash",
        amount_cash: paymentMode === "invoice_cash" ? parseFloat(amountCash.replace(",", ".")) || 0 : null,
        amount_invoice: paymentMode === "invoice_cash" ? parseFloat(amountInvoice.replace(",", ".")) || 0 : null,
        items: cleanItems.map((i) => ({
          label: i.label,
          price: (i as Item).negative ? signedPrice(i as Item) : parseFloat(String(i.price).replace(",", ".")) || 0,
          client_service_id: i.client_service_id ?? null,
          intervention_service_id: i.intervention_service_id ?? null,
          on_demand: i.on_demand ?? false,
        })),
        hourly_rate_id: isAdmin ? (selectedRateId ?? null) : null,
      };

      await enqueue({
        kind: "delete-intervention-scope",
        method: "DELETE",
        url: `/api/interventions/${id}/recurrence-scope?scope=following`,
        label: "Suppression des occurrences à venir (changement de récurrence)",
      });

      const occurrences = generateDates(startDateStr, dur, recurrence, false);
      if (occurrences.length === 0) return toast.error("Date", "Vérifie la date.");

      for (const occ of occurrences) {
        const payload = {
          ...basePayload,
          start_time: occ.start.toISOString(),
          end_time: occ.end.toISOString(),
          time_tbd: isAdmin ? timeTbd : true,
          recurrence_rule:
            occurrences.length > 1
              ? {
                  freq: recurrence.freq === "custom" ? recurrence.unit : recurrence.freq,
                  interval: recurrence.freq === "custom" ? recurrence.interval : 1,
                  count: occurrences.length,
                }
              : null,
          recurrence_group_id: occurrences.length > 1 ? groupId : null,
        };
        const tempId = newTempId();
        applyCreateReprise(queryClient, tempId, payload);
        await enqueue({
          kind: "create-reprise",
          method: "POST",
          url: "/api/interventions",
          body: payload,
          tempId,
          label: "Occurrence recréée (nouvelle récurrence)",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success(
        "Récurrence modifiée",
        isOnlineNow()
          ? "Les occurrences à venir ont été recréées."
          : "Sera synchronisé au retour du réseau.",
      );
      router.dismissTo({
        pathname: "/(app)/calendar",
        params: {
          date: from_date ?? startDateStr.split("T")[0],
          ...(from_view ? { view: from_view } : {}),
          ...(from_zone ? { zone: from_zone } : {}),
        },
      });
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsChangingRecurrence(false);
      setShowChangeRecurrenceDialog(false);
    }
  };

  const contextualOptions = useMemo(
    () => getContextualOptions(startDateStr),
    [startDateStr],
  );

  if (
    !isFormRenderReady ||
    (isEditMode && isLoadingIntervention) ||
    ((isRepriseMode || isDuplicateMode) && isLoadingReprise)
  ) {
    return (
      <View
        className="flex-1 justify-center items-center bg-background dark:bg-slate-950"
        style={{ backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (isSubcontractor) {
    return <Redirect href="/(app)/calendar" />;
  }

  const typeNeedsClient = NEEDS_CLIENT.includes(intervType);
  const typeNeedsItems = NEEDS_ITEMS.includes(intervType);
  // Un devis n'est pas encore une prestation planifiée ni encaissée : pas de
  // taux horaire (comptage d'heures) ni de mode de paiement tant qu'il n'est
  // pas converti en intervention.
  const typeNeedsPayment = typeNeedsClient && intervType !== "devis";

  const recurrenceLabel = getRecurrenceLabel(recurrence, startDateStr);

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: isWeb ? 0 : insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else if (isEditMode) router.replace(`/(app)/calendar/${id}`);
            else if (isRepriseMode)
              router.replace(`/(app)/calendar/${reprise_of}` as any);
            else if (isDuplicateMode)
              router.replace(`/(app)/calendar/${duplicate_of}` as any);
            else
              router.replace({
                pathname: "/(app)/calendar",
                params: {
                  ...(from_view ? { view: from_view } : {}),
                  ...(from_date ? { date: from_date } : {}),
                  ...(from_zone ? { zone: from_zone } : {}),
                },
              });
          }}
          className="p-2 rounded-full hover:bg-muted active:bg-muted"
        >
          <ChevronLeft size={24} className="text-foreground dark:text-white" />
        </Pressable>
        <Text className="text-lg font-bold ml-2 text-foreground dark:text-white">
          {isRepriseMode
            ? "Planifier la reprise"
            : isConvertingDevis
              ? "Changer en intervention"
              : isDuplicateMode
                ? "Dupliquer l'intervention"
                : isEditMode
                ? "Modifier l'intervention"
                : "Nouvelle intervention"}
        </Text>
      </View>

      {isRecurringSeries && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <Repeat size={13} color="#8B5CF6" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#8B5CF6" }}>
            Fait partie d'une série
            {(() => {
              const label = formatRecurrenceLabel(
                interventionData?.recurrence_rule,
                interventionData?.start_time,
              );
              return label ? ` — ${label}` : "";
            })()}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <Card className="max-w-2xl w-full self-center rounded-[40px] overflow-hidden">
            {isRepriseMode && pendingDeferredAmount > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <View
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    padding: 12, borderRadius: 14,
                    backgroundColor: isDark ? "rgba(249,115,22,0.1)" : "#FFF7ED",
                    borderWidth: 1, borderColor: isDark ? "rgba(249,115,22,0.3)" : "#FED7AA",
                  }}
                >
                  <Banknote size={18} color="#F97316" />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: isDark ? "#FDBA74" : "#C2410C" }}>
                    Solde précédent dû : {pendingDeferredAmount.toFixed(2)} € (client absent au RDV précédent) — sera ajouté au total de ce RDV.
                  </Text>
                </View>
              </View>
            )}

            <CardHeader className="p-6 pb-2">
              <Text className="text-2xl font-extrabold text-foreground dark:text-white text-center">
                {isRepriseMode
                  ? "Reprise RDV"
                  : isConvertingDevis
                    ? "Devis → Intervention"
                    : isDuplicateMode
                      ? "Dupliquer"
                      : isEditMode
                        ? "Modifier"
                        : "Planifier"}
              </Text>
              <Text className="mt-1 text-muted-foreground text-center font-medium">
                {isRepriseMode
                  ? "Planifie le prochain RDV pour ce client"
                  : isConvertingDevis
                    ? "Choisis la ou les dates de l'intervention"
                    : isDuplicateMode
                      ? "Copie sur un autre jour"
                      : isEditMode
                        ? "Mise à jour intervention"
                        : "Nouvelle intervention"}
              </Text>
            </CardHeader>

            <CardContent style={{ padding: 24, paddingTop: 16, gap: 20 }}>
              {/* TYPE (admin only) */}
              {isAdmin && (
                <View style={{ gap: 4 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Type
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {(Object.keys(TYPE_CONFIG) as IntervType[]).map((t) => {
                      const cfg = TYPE_CONFIG[t];
                      const active = intervType === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setIntervType(t)}
                          style={{
                            flex: 1,
                            minWidth: "45%",
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: active ? cfg.color : "#E2E8F0",
                            backgroundColor: active ? cfg.bg : "transparent",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "600",
                              fontSize: 13,
                              color: active ? cfg.color : "#94A3B8",
                            }}
                          >
                            {cfg.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ZONE (admin seulement) */}
              {isAdmin && (
                <View style={{ gap: 4, marginTop: -4 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Zone
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["hainaut", "ardennes"] as const).map((z) => {
                      const active = zone === z;
                      const color = z === "ardennes" ? "#10B981" : "#3B82F6";
                      const bg = z === "ardennes" ? "#D1FAE5" : "#DBEAFE";
                      return (
                        <Pressable
                          key={z}
                          onPress={() => setZone(z)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: active ? color : "#E2E8F0",
                            backgroundColor: active ? bg : "transparent",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "600",
                              fontSize: 14,
                              color: active ? color : "#94A3B8",
                            }}
                          >
                            {z === "ardennes" ? "Ardennes" : "Hainaut"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* CLIENT */}
              {!isQuickPrepMode && typeNeedsClient && (
                <View style={{ gap: 4 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Pour qui ?
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Select
                        title="Choisir un client"
                        value={
                          selectedClient
                            ? {
                                id: selectedClient.id,
                                label:
                                  selectedClient.name ||
                                  selectedClient.address ||
                                  "Client anonyme",
                              }
                            : { id: NO_CLIENT_ID, label: "Aucun", muted: true }
                        }
                        items={clientItems}
                        onChange={(v) => {
                          if (v.id === NO_CLIENT_ID) {
                            setSelectedClient(null);
                            return;
                          }
                          const c = clients?.find((x) => x.id === v.id);
                          if (c) setSelectedClient(c);
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => setShowNewClient(true)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: "#EFF6FF",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "#BFDBFE",
                      }}
                    >
                      <UserPlus size={20} color="#3B82F6" />
                    </Pressable>
                  </View>

                  {!isEditMode && upcomingClientInterventions.length > 0 && (
                    <View
                      style={{
                        marginTop: 8,
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: isDark ? "rgba(249,115,22,0.1)" : "#FFF7ED",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(249,115,22,0.3)" : "#FED7AA",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={16} color="#F97316" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#C2410C" }}>
                          {upcomingClientInterventions.length > 1
                            ? `Ce client a déjà ${upcomingClientInterventions.length} RDV prévus`
                            : "Ce client a déjà un RDV prévu"}
                        </Text>
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={upcomingClientInterventions.length > 3}
                        >
                          <View style={{ gap: 6 }}>
                            {upcomingClientInterventions.map((it: any) => (
                              <Pressable
                                key={it.id}
                                onPress={() =>
                                  router.push({
                                    pathname: "/(app)/calendar/add",
                                    params: { id: it.id },
                                  } as any)
                                }
                                style={({ pressed }) => ({
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  borderRadius: 12,
                                  backgroundColor: pressed
                                    ? (isDark ? "rgba(249,115,22,0.2)" : "#FFEDD5")
                                    : (isDark ? "rgba(15,23,42,0.4)" : "#FFFFFF"),
                                  borderWidth: 1,
                                  borderColor: isDark ? "rgba(249,115,22,0.25)" : "#FED7AA",
                                })}
                              >
                                <View
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 9,
                                    backgroundColor: "#F97316",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <CalendarClock size={15} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#FDBA74" : "#C2410C" }}>
                                    {new Date(it.start_time).toLocaleDateString("fr-FR", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </Text>
                                  <Text
                                    style={{ fontSize: 12, color: isDark ? "#CBD5E1" : "#78716C" }}
                                    numberOfLines={1}
                                  >
                                    {it.title}
                                  </Text>
                                </View>
                                <ChevronRight size={16} color={isDark ? "#FDBA74" : "#EA580C"} />
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* EMPLOYES (admin seulement) */}
              {isAdmin && (
                <View style={{ gap: 4 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Qui intervient ?
                  </Text>
                  <MultiSelect
                    items={employeeItems}
                    selectedIds={selectedEmployeeIds}
                    onChange={setSelectedEmployeeIds}
                  />
                </View>
              )}

              {/* TITRE + DATE + DURÉE */}
              {/* Prépa rapide : le seul champ d'horaire utile est la date —
                  déplacer un RDV futur d'un jour est le cas courant depuis
                  l'écran de choix de reprise. */}
              {isQuickPrepMode && (
                <DateTimePicker
                  value={startDateStr}
                  onChange={setStartDateStr}
                  label="Date de l'intervention"
                  dateOnly
                />
              )}

              {!isQuickPrepMode && (
              <View style={{ gap: 16 }}>
                <Input
                  label="Titre"
                  value={title}
                  onChangeText={setTitle}
                  multiline={!isRepriseMode}
                  textAlignVertical={isRepriseMode ? "center" : "top"}
                  style={
                    isRepriseMode
                      ? { minHeight: 48, backgroundColor: "transparent", borderWidth: 0 }
                      : { height: undefined, minHeight: 48, alignItems: "flex-start", paddingVertical: 10 }
                  }
                  inputStyle={
                    isRepriseMode
                      ? undefined
                      : { height: undefined, minHeight: 28 }
                  }
                />

                {isAdmin && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                    <Text className="text-sm font-semibold text-foreground dark:text-white">Heure définie</Text>
                    <Switch
                      value={!timeTbd}
                      onValueChange={(v) => setTimeTbd(!v)}
                      trackColor={{ false: Platform.OS === "ios" ? "transparent" : "#E2E8F0", true: "#8B5CF6" }}
                      ios_backgroundColor="#E2E8F0"
                      thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
                    />
                  </View>
                )}

                {isRepriseMode ? (
                  <>
                    <MultiDatePicker
                      values={repriseDates}
                      onChange={setRepriseDates}
                      label="Date(s) de la reprise"
                      dayColors={dayColors}
                      onMonthChange={setCalendarMonth}
                      minDate={new Date().toISOString().split("T")[0]}
                    />
                    {isAdmin && !timeTbd && (
                      <DateTimePicker
                        value={startDateStr}
                        onChange={setStartDateStr}
                        label="Heure"
                        timeOnly
                      />
                    )}
                  </>
                ) : timeTbd ? (
                  <DateTimePicker
                    value={startDateStr}
                    onChange={setStartDateStr}
                    label="Date de l'intervention"
                    dateOnly
                    dayColors={isDuplicateMode ? dayColors : undefined}
                    onMonthChange={isDuplicateMode ? setCalendarMonth : undefined}
                    minDate={isDuplicateMode ? new Date().toISOString().split("T")[0] : undefined}
                  />
                ) : (
                  <>
                    <DateTimePicker
                      value={startDateStr}
                      onChange={setStartDateStr}
                      label="Début de l'intervention"
                      dateOnly={!isAdmin}
                      dayColors={(isRepriseMode || isDuplicateMode) ? dayColors : undefined}
                      onMonthChange={(isRepriseMode || isDuplicateMode) ? setCalendarMonth : undefined}
                      minDate={(isRepriseMode || isDuplicateMode) ? new Date().toISOString().split("T")[0] : undefined}
                    />
                    <DateTimePicker
                      value={endDateStr}
                      onChange={setEndDateStr}
                      label="Fin de l'intervention"
                      timeOnly
                    />
                  </>
                )}
              </View>
              )}

              {/* RÉCURRENCE (pas en mode édition sauf série, pas en reprise
                  — les dates multiples remplacent la récurrence) */}
              {!isRepriseMode && (!isEditMode || isRecurringSeries) && (
                <View style={{ gap: 4, marginTop: (!isAdmin && isRepriseMode) ? -8 : 0 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Récurrence
                  </Text>

                  {/* Dropdown trigger */}
                  <Pressable
                    onPress={() => setShowRecurrenceDropdown((v) => !v)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: 1.5,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderColor:
                        recurrence.freq !== "none"
                          ? "#3B82F6"
                          : isDark
                            ? "#334155"
                            : "#E2E8F0",
                      backgroundColor:
                        recurrence.freq !== "none"
                          ? isDark
                            ? "#1E3A5F"
                            : "#EFF6FF"
                          : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color:
                          recurrence.freq !== "none" ? "#3B82F6" : "#64748B",
                      }}
                    >
                      {recurrenceLabel}
                    </Text>
                    <ChevronDown
                      size={18}
                      color={recurrence.freq !== "none" ? "#3B82F6" : "#94A3B8"}
                    />
                  </Pressable>

                  {/* Dropdown options */}
                  {showRecurrenceDropdown && (
                    <View
                      style={{
                        borderWidth: 1.5,
                        borderColor: isDark ? "#334155" : "#E2E8F0",
                        borderRadius: 14,
                        backgroundColor: isDark ? "#1E293B" : "white",
                        overflow: "hidden",
                        marginTop: 4,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                    >
                      {contextualOptions.map((opt, idx) => {
                        const isActive =
                          recurrence.freq === opt.freq && opt.freq !== "custom";
                        const isLast = idx === contextualOptions.length - 1;
                        return (
                          <Pressable
                            key={opt.freq}
                            onPress={() => {
                              if (opt.freq === "custom") {
                                setCustomIntervalStr(
                                  String(recurrence.interval),
                                );
                                setCustomUnit(recurrence.unit);
                                setCustomDaysOfWeek(recurrence.daysOfWeek);
                                setCustomEndType(recurrence.endType);
                                setCustomCountStr(String(recurrence.count));
                                setCustomEndDate(recurrence.endDate);
                                setShowCustomModal(true);
                              } else {
                                setRecurrence({
                                  ...DEFAULT_RECURRENCE,
                                  freq: opt.freq,
                                  endType: recurrence.endType,
                                  count: recurrence.count,
                                  endDate: recurrence.endDate,
                                });
                              }
                              setShowRecurrenceDropdown(false);
                            }}
                            style={[
                              {
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 16,
                                paddingVertical: 13,
                              },
                              !isLast
                                ? {
                                    borderBottomWidth: 1,
                                    borderBottomColor: isDark
                                      ? "#334155"
                                      : "#F1F5F9",
                                  }
                                : {},
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: isActive ? "700" : "500",
                                color: isActive
                                  ? "#3B82F6"
                                  : opt.freq === "custom"
                                    ? "#8B5CF6"
                                    : isDark
                                      ? "#F1F5F9"
                                      : "#0f172a",
                              }}
                            >
                              {opt.label}
                            </Text>
                            {isActive && <Check size={16} color="#3B82F6" />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Nombre d'occurrences si récurrence active — seulement
                      pertinent quand endType === "count" : sinon (fixée par
                      "Personnaliser..." sur "Jamais"/"Le ...") ce champ
                      afficherait un chiffre obsolète et trompeur alors qu'il
                      n'est pas utilisé pour générer la série. */}
                  {recurrence.freq !== "none" && recurrence.endType === "count" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 8,
                        gap: 10,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: "#64748B", flex: 1 }}>
                        Nombre d'occurrences :
                      </Text>
                      <TextInput
                        value={String(recurrence.count)}
                        onChangeText={(v) => {
                          const n = parseInt(v);
                          if (!isNaN(n) && n > 0)
                            setRecurrence((r) => ({
                              ...r,
                              count: n,
                              endType: "count",
                            }));
                        }}
                        keyboardType="numeric"
                        style={[
                          {
                            width: 60,
                            borderWidth: 1.5,
                            borderColor: "#DBEAFE",
                            borderRadius: 10,
                            padding: 8,
                            textAlign: "center",
                            fontSize: 15,
                            fontWeight: "700",
                            color: "#3B82F6",
                            backgroundColor: "#F0F9FF",
                          },
                          Platform.OS === "web"
                            ? ({ outlineStyle: "none" } as any)
                            : {},
                        ]}
                      />
                    </View>
                  )}
                  {recurrence.freq !== "none" && recurrence.endType === "never" && (
                    <Text style={{ fontSize: 13, color: "#64748B", marginTop: 8, paddingHorizontal: 4 }}>
                      Se termine : jamais
                    </Text>
                  )}
                  {recurrence.freq !== "none" &&
                    recurrence.endType === "date" &&
                    !!recurrence.endDate && (
                      <Text style={{ fontSize: 13, color: "#64748B", marginTop: 8, paddingHorizontal: 4 }}>
                        Se termine le {recurrence.endDate}
                      </Text>
                    )}
                </View>
              )}

              {/* PRESTATIONS */}
              {typeNeedsItems && (
                <View className="mt-2 pt-4 border-t border-border dark:border-slate-800">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-semibold text-foreground dark:text-white">
                      Prestations
                    </Text>
                    {isAdmin && !isAddingService && (
                      <Pressable
                        onPress={() => {
                          setIsAddingService(true);
                          setNewServiceLabel("");
                          setNewServicePrice("");
                        }}
                        className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full"
                      >
                        <PlusCircle size={16} color="#3B82F6" />
                        <Text className="text-primary font-bold ml-1.5 text-xs">
                          Ajouter
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Formulaire inline d'ajout */}
                  {isAddingService && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6, // Légèrement réduit (était 8)
                        alignItems: "center",
                        marginBottom: 10,
                        backgroundColor: "#F0F9FF",
                        borderRadius: 10,
                        padding: 6, // Légèrement réduit (était 8)
                      }}
                    >
                      <TextInput
                        autoFocus
                        placeholder="Nom (ex: RDC…)" // Raccourci pour libérer de l'espace
                        placeholderTextColor="#94A3B8"
                        value={newServiceLabel}
                        onChangeText={setNewServiceLabel}
                        style={[
                          {
                            flex: 2,
                            minWidth: 0, // 🚨 CRUCIAL SUR WEB : Permet au champ de rétrécir au lieu de déborder
                            borderWidth: 1,
                            borderColor: "#3B82F6",
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 7,
                            fontSize: 16, // 🚨 CRUCIAL SUR SAFARI iOS : Empêche le zoom automatique !
                            backgroundColor: isDark ? "#1E293B" : "#fff",
                            color: isDark ? "#F1F5F9" : "#1E293B",
                          },
                          Platform.OS === "web"
                            ? ({ outlineStyle: "none" } as any)
                            : {},
                        ]}
                      />
                      <TextInput
                        placeholder="Prix"
                        placeholderTextColor="#94A3B8"
                        keyboardType={SIGNED_PRICE_KEYBOARD}
                        value={newServicePrice}
                        onChangeText={(t) => setNewServicePrice(sanitizeSignedPrice(t))}
                        style={[
                          {
                            flex: 1,
                            minWidth: 0, // 🚨 CRUCIAL SUR WEB : Permet au champ de rétrécir
                            borderWidth: 1,
                            borderColor: isDark ? "#1E40AF" : "#3B82F6",
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 7,
                            fontSize: 16, // 🚨 CRUCIAL SUR SAFARI iOS : Empêche le zoom automatique !
                            backgroundColor: isDark ? "#1E293B" : "#fff",
                            color: isDark ? "#F1F5F9" : "#1E293B",
                          },
                          Platform.OS === "web"
                            ? ({ outlineStyle: "none" } as any)
                            : {},
                        ]}
                      />
                      <Pressable
                        onPress={async () => {
                          if (!newServiceLabel.trim()) {
                            toast.error("Nom requis", "");
                            return;
                          }
                          if (selectedClient?.id) {
                            try {
                              // Id temporaire : hors réseau, on ne peut pas
                              // connaître l'id serveur. Il est utilisable tout
                              // de suite par l'interface et remplacé à la
                              // synchronisation (voir idMap.ts), y compris dans
                              // le `client_service_id` de l'intervention.
                              const tempId = newTempId();
                              const service = {
                                id: tempId,
                                label: newServiceLabel.trim(),
                                price: parseFloat(newServicePrice.replace(",", ".")) || 0,
                                position: availableClientServices.length,
                              };
                              applyServiceCreate(
                                queryClient,
                                selectedClient.id,
                                service,
                              );
                              await enqueue({
                                kind: "service-create",
                                method: "POST",
                                url: `/api/clients/${selectedClient.id}/services`,
                                body: {
                                  label: service.label,
                                  price: service.price,
                                  position: service.position,
                                },
                                tempId,
                                label: `Prestation « ${service.label} »`,
                              });
                              setCheckedServiceIds(
                                (prev) => new Set([...prev, tempId]),
                              );
                            } catch {
                              toast.error("Erreur", "Impossible d'ajouter");
                            }
                          } else if (activeChainId) {
                            try {
                              const tempId = newTempId();
                              const service = {
                                id: tempId,
                                label: newServiceLabel.trim(),
                                price: parseFloat(newServicePrice.replace(",", ".")) || 0,
                                position: availableChainServices.length,
                              };
                              applyChainServiceCreate(
                                queryClient,
                                activeChainId,
                                service,
                              );
                              await enqueue({
                                kind: "service-create",
                                method: "POST",
                                url: `/api/interventions/chain-services`,
                                body: {
                                  reprise_chain_id: activeChainId,
                                  label: service.label,
                                  price: service.price,
                                  position: service.position,
                                },
                                tempId,
                                label: `Prestation « ${service.label} »`,
                              });
                              setCheckedServiceIds(
                                (prev) => new Set([...prev, tempId]),
                              );
                            } catch {
                              toast.error("Erreur", "Impossible d'ajouter");
                            }
                          } else {
                            // Ni client ni chaîne connue (intervention neuve,
                            // jamais sauvegardée) : rien de persistant possible
                            // encore, on retombe sur un item ad-hoc.
                            addAdHocItem();
                            updateAdHocItem(
                              adHocItems.length,
                              "label",
                              newServiceLabel.trim(),
                            );
                            updateAdHocItem(
                              adHocItems.length,
                              "price",
                              newServicePrice,
                            );
                          }
                          setIsAddingService(false);
                        }}
                        style={{
                          backgroundColor: "#3B82F6",
                          borderRadius: 20,
                          width: 32, // Légèrement réduit pour être sûr que tout passe
                          height: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0, // Empêche le bouton de s'écraser
                        }}
                      >
                        <Check size={16} color="#fff" strokeWidth={2.5} />
                      </Pressable>
                      <Pressable
                        onPress={() => setIsAddingService(false)}
                        style={{
                          backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: isDark ? "#475569" : "#CBD5E1",
                          width: 32, // Légèrement réduit
                          height: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0, // Empêche le bouton de s'écraser
                        }}
                      >
                        <X
                          size={16}
                          color={isDark ? "#94A3B8" : "#64748B"}
                          strokeWidth={2.5}
                        />
                      </Pressable>
                    </View>
                  )}

                  {/* Services du client = cases à cocher */}
                  {availableServices.map((svc) => {
                    const checked = checkedServiceIds.has(svc.id);
                    const onDemand = onDemandServiceIds.has(svc.id);
                    const priceVal =
                      servicePriceOverrides[svc.id] ?? svc.price.toString();
                    return (
                      <View
                        key={svc.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Pressable
                          onPress={() => toggleService(svc.id)}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: checked ? "#3B82F6" : "#CBD5E1",
                            backgroundColor: checked
                              ? "#3B82F6"
                              : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {checked && <Check size={13} color="#fff" />}
                        </Pressable>
                        <View style={{ flex: 2 }}>
                          <TextInput
                            value={serviceLabelDrafts[svc.id] ?? svc.label}
                            placeholder="Nom du service"
                            editable={isAdmin}
                            onChangeText={(t) => {
                              setServiceLabelDrafts((prev) => ({
                                ...prev,
                                [svc.id]: t,
                              }));
                              scheduleServiceLabelSave(svc.id, t);
                            }}
                            onFocus={() => setFocusedServiceLabelId(svc.id)}
                            onBlur={() => setFocusedServiceLabelId(null)}
                            selection={
                              focusedServiceLabelId === svc.id
                                ? undefined
                                : { start: 0, end: 0 }
                            }
                            style={[
                              {
                                borderWidth: 1,
                                borderColor: "#E2E8F0",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                fontSize: 14,
                                color: checked ? "#1E293B" : "#94A3B8",
                              },
                              Platform.OS === "web"
                                ? ({ outlineStyle: "none" } as any)
                                : {},
                            ]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={priceVal}
                            placeholder="Prix"
                            keyboardType={SIGNED_PRICE_KEYBOARD}
                            editable={isAdmin}
                            onChangeText={(t) => {
                              const cleaned = sanitizeSignedPrice(t);
                              setServicePriceOverrides((prev) => ({
                                ...prev,
                                [svc.id]: cleaned,
                              }));
                              scheduleServicePriceSave(svc.id, cleaned);
                            }}
                            style={[
                              {
                                borderWidth: 1,
                                borderColor: checked ? "#E2E8F0" : "#F1F5F9",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                fontSize: 14,
                                color: checked ? "#1E293B" : "#94A3B8",
                                backgroundColor: checked
                                  ? undefined
                                  : "#F8FAFC",
                              },
                              Platform.OS === "web"
                                ? ({ outlineStyle: "none" } as any)
                                : {},
                            ]}
                          />
                        </View>
                        <Pressable
                          disabled={!checked}
                          onPress={() => toggleServiceOnDemand(svc.id)}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: checked && onDemand ? "#8B5CF6" : "#CBD5E1",
                            backgroundColor: checked && onDemand ? "#8B5CF6" : "transparent",
                            opacity: checked ? 1 : 0.4,
                            flexShrink: 0,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: checked && onDemand ? "#fff" : "#64748B",
                            }}
                          >
                            +33%
                          </Text>
                        </Pressable>
                        {isAdmin && (
                          <Pressable
                            onPress={async () => {
                              try {
                                // "En attente" : rien n'existe encore côté
                                // catalogue, décocher suffit (revient à ne pas
                                // inclure cette prestation cette fois-ci).
                                if (isPendingChainId(svc.id)) {
                                  setCheckedServiceIds((prev) => {
                                    const n = new Set(prev);
                                    n.delete(svc.id);
                                    return n;
                                  });
                                  return;
                                }
                                if (selectedClient?.id) {
                                  applyServiceDelete(
                                    queryClient,
                                    selectedClient.id,
                                    svc.id,
                                  );
                                } else if (activeChainId) {
                                  applyChainServiceDelete(
                                    queryClient,
                                    activeChainId,
                                    svc.id,
                                  );
                                }
                                setCheckedServiceIds((prev) => {
                                  const n = new Set(prev);
                                  n.delete(svc.id);
                                  return n;
                                });
                                setServicePriceOverrides((prev) => {
                                  const n = { ...prev };
                                  delete n[svc.id];
                                  return n;
                                });
                                setOnDemandServiceIds((prev) => {
                                  const n = new Set(prev);
                                  n.delete(svc.id);
                                  return n;
                                });
                                const deleteUrl = selectedClient?.id
                                  ? `/api/clients/${selectedClient.id}/services/${svc.id}`
                                  : `/api/interventions/chain-services/${svc.id}`;
                                await enqueue({
                                  kind: "service-delete",
                                  method: "DELETE",
                                  url: deleteUrl,
                                  label: `Suppression « ${svc.label} »`,
                                });
                              } catch {
                                toast.error("Erreur", "Impossible de supprimer");
                              }
                            }}
                            style={{ padding: 6 }}
                          >
                            <Trash2 size={18} color="#EF4444" />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}

                  {/* Items ad-hoc (sans client ou ajout ponctuel) */}
                  {adHocItems.map((item, index) => (
                    <View
                      key={`adhoc-${index}`}
                      className="flex-row gap-2 items-center mb-2"
                    >
                      <View className="flex-[2]">
                        <Input
                          placeholder="Ex: RDC, Velux..."
                          value={item.label}
                          editable={isAdmin}
                          onChangeText={(t) =>
                            updateAdHocItem(index, "label", t)
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          placeholder="Prix"
                          keyboardType="decimal-pad"
                          value={item.price}
                          editable={isAdmin}
                          onChangeText={(t) =>
                            updateAdHocItem(index, "price", t)
                          }
                        />
                      </View>
                      <Pressable
                        onPress={() => toggleAdHocOnDemand(index)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: item.on_demand ? "#8B5CF6" : "#CBD5E1",
                          backgroundColor: item.on_demand ? "#8B5CF6" : "transparent",
                          flexShrink: 0,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: item.on_demand ? "#fff" : "#64748B",
                          }}
                        >
                          +33%
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => toggleAdHocNegative(index)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: item.negative ? "#EF4444" : "#CBD5E1",
                          backgroundColor: item.negative ? "#EF4444" : "transparent",
                          flexShrink: 0,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: item.negative ? "#fff" : "#64748B",
                          }}
                        >
                          {item.negative ? "−" : "+"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeAdHocItem(index)}
                        className="p-2"
                      >
                        <Trash2 size={20} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}

                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="font-bold text-lg text-foreground dark:text-white">
                      Total Estimé
                    </Text>
                    <Text className="font-extrabold text-2xl text-primary">
                      {totalPrice.toFixed(2)} €
                    </Text>
                  </View>
                </View>
              )}

              {/* TAUX HORAIRE (admin uniquement) */}
              {isAdmin &&
                intervType !== "devis" &&
                Array.isArray(hourlyRates) &&
                hourlyRates.length > 0 &&
                (totalPrice > 0 || (hourlyRates as any[]).some((r: any) => r.time_only)) && (
                  <View className="pt-4 mt-4 border-t border-border dark:border-slate-800">
                    <Text className="text-sm font-semibold text-foreground dark:text-white mb-2">
                      Taux horaire
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-2"
                    >
                      <View className="flex-row gap-2">
                        {[null, ...hourlyRates].map((r: any) => {
                          const isSelected = selectedRateId === (r?.id ?? null);
                          return (
                            <Pressable
                              key={r?.id ?? "none"}
                              onPress={() => setSelectedRateId(r?.id ?? null)}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: isSelected
                                  ? "#3B82F6"
                                  : isDark
                                    ? "#1E293B"
                                    : "#F1F5F9",
                                borderWidth: 1,
                                borderColor: isSelected
                                  ? "#3B82F6"
                                  : isDark
                                    ? "#334155"
                                    : "#E2E8F0",
                              }}
                            >
                              <Text
                                style={{
                                  color: isSelected
                                    ? "#fff"
                                    : isDark
                                      ? "#94A3B8"
                                      : "#64748B",
                                  fontWeight: "600",
                                  fontSize: 13,
                                }}
                              >
                                {r
                                  ? r.time_only
                                    ? `${r.label ? r.label : "Temps interne"}`
                                    : `${r.label ? r.label + " — " : ""}${r.rate} €/h`
                                  : "Aucun"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                    {selectedRate?.time_only ? (
                      durationHours ? (
                        <Text className="text-sm text-muted-foreground" style={{ color: "#8B5CF6" }}>
                          → {Number(durationHours) === Math.floor(Number(durationHours))
                            ? `${durationHours}h`
                            : `${Math.floor(Number(durationHours))}h${Math.round((Number(durationHours) % 1) * 60).toString().padStart(2, "0")}`
                          } de travail comptabilisées (sans CA)
                        </Text>
                      ) : (
                        <Text className="text-sm text-muted-foreground" style={{ color: "#8B5CF6" }}>
                          → Renseigne une durée pour comptabiliser les heures
                        </Text>
                      )
                    ) : computedHours ? (
                      <Text className="text-sm text-muted-foreground">
                        → {computedHours} calculées ({totalPrice.toFixed(2)} € ÷{" "}
                        {selectedRate?.rate} €/h)
                      </Text>
                    ) : null}
                  </View>
                )}

              {/* NOTES */}
              <View>
                <Input
                  label="Notes"
                  placeholder="Infos supplémentaires..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  className="h-20 py-2"
                />
              </View>

              {/* PAIEMENT */}
              {isAdmin && typeNeedsPayment && (
                <View className="pt-4 mt-4 border-t border-border dark:border-slate-800">
                  <Text className="text-sm font-semibold text-foreground dark:text-white mb-2">
                    Paiement
                  </Text>
                  <SlidingPillSelector
                    options={[
                      !hideCash && {
                        id: "cash",
                        label: "Espèces",
                        pillColor: "#EF4444",
                        activeTextColor: "#fff",
                        icon: (c: string) => <Banknote size={14} color={c} />,
                      },
                      {
                        id: "invoice",
                        label: "FAC",
                        pillColor: "#22C55E",
                        activeTextColor: "#fff",
                        icon: (c: string) => <FileText size={14} color={c} />,
                      },
                      !hideCash && {
                        id: "invoice_cash",
                        label: "FAC+Esp.",
                        pillColor: "#F97316",
                        activeTextColor: "#fff",
                        icon: (c: string) => <Wallet size={14} color={c} />,
                      },
                    ].filter(Boolean) as any}
                    selected={paymentMode}
                    onSelect={(id) =>
                      setPaymentMode(id as "cash" | "invoice" | "invoice_cash")
                    }
                    pillColor="#3B82F6"
                    bgColor="#F1F5F9"
                    activeTextColor="#fff"
                    inactiveTextColor="#64748B"
                    fontSize={12}
                    itemPy={9}
                  />
                  {!hideCash && paymentMode === "cash" && (
                    <Text
                      style={{ fontSize: 11, color: "#EF4444", marginTop: 5 }}
                    >
                      L'employé encaisse sur place
                    </Text>
                  )}
                  {paymentMode === "invoice" && (
                    <Text
                      style={{ fontSize: 11, color: "#22C55E", marginTop: 5 }}
                    >
                      Une facture sera émise au client
                    </Text>
                  )}
                  {paymentMode === "invoice_cash" && (
                    <>
                      <Text
                        style={{ fontSize: 11, color: "#F97316", marginTop: 5 }}
                      >
                        L'employé encaisse sur place et une facture sera émise
                      </Text>
                      <PaymentSplitInputs
                        total={paymentTotal}
                        amountCash={amountCash}
                        amountInvoice={amountInvoice}
                        onChangeCash={setAmountCash}
                        onChangeInvoice={setAmountInvoice}
                      />
                    </>
                  )}
                </View>
              )}

              {/* ACTIONS */}
              <View className="mt-6 flex-row gap-3">
                <View style={{ flex: 1 }}>
                  <Button
                    variant="outline"
                    onPress={() => {
                      if (router.canGoBack()) router.back();
                      else if (isRepriseMode)
                        router.replace(`/(app)/calendar/${reprise_of}` as any);
                      else if (isDuplicateMode)
                        router.replace(`/(app)/calendar/${duplicate_of}` as any);
                      else
                        router.replace({
                          pathname: "/(app)/calendar",
                          params: {
                            ...(from_view ? { view: from_view } : {}),
                            ...(from_date ? { date: from_date } : {}),
                            ...(from_zone ? { zone: from_zone } : {}),
                          },
                        });
                    }}
                    className="w-full"
                    style={{ borderRadius: 20 }}
                  >
                    Annuler
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    onPress={() => {
                      if (recurrencePatternChanged) setShowChangeRecurrenceDialog(true);
                      else if (isRecurringSeries) setShowRecurrenceScopeDialog(true);
                      else handleSubmit("this");
                    }}
                    disabled={isSubmitting}
                    className="w-full"
                    style={{ borderRadius: 20 }}
                  >
                    {isSubmitting
                      ? "Envoi..."
                      : isRepriseMode
                        ? "Confirmer"
                        : isConvertingDevis
                          ? "Convertir"
                          : isDuplicateMode
                            ? "Dupliquer"
                            : isEditMode
                              ? (isQuickPrepMode ? "Confirmer" : "Mettre à jour")
                              : "Valider"}
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL PORTÉE D'ÉDITION (RDV récurrent) */}
      <Dialog
        open={showRecurrenceScopeDialog}
        onClose={() => setShowRecurrenceScopeDialog(false)}
        position="center"
      >
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", textAlign: "center" }}>
            Modifier ce rendez-vous récurrent
          </Text>
          <Button
            onPress={() => {
              setShowRecurrenceScopeDialog(false);
              handleSubmit("this");
            }}
          >
            Uniquement ce rendez-vous
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setShowRecurrenceScopeDialog(false);
              handleSubmit("following");
            }}
          >
            Celui-ci et les suivants
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setShowRecurrenceScopeDialog(false);
              handleSubmit("all");
            }}
          >
            Toutes les occurrences
          </Button>
        </View>
      </Dialog>

      {/* MODAL CHANGEMENT DE RÉCURRENCE */}
      <Dialog
        open={showChangeRecurrenceDialog}
        onClose={() => !isChangingRecurrence && setShowChangeRecurrenceDialog(false)}
        position="center"
      >
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", textAlign: "center" }}>
            Changer la récurrence
          </Text>
          <Text style={{ fontSize: 14, color: "#64748B", textAlign: "center" }}>
            Les occurrences à venir de cette série (à partir de celle-ci) vont être
            supprimées et recréées selon le nouveau motif. Les occurrences déjà
            passées ne sont pas touchées.
          </Text>
          <Button
            onPress={handleChangeRecurrence}
            disabled={isChangingRecurrence}
          >
            {isChangingRecurrence ? "Modification..." : "Confirmer le changement"}
          </Button>
          <Button
            variant="outline"
            onPress={() => setShowChangeRecurrenceDialog(false)}
            disabled={isChangingRecurrence}
          >
            Annuler
          </Button>
        </View>
      </Dialog>

      {/* MODAL RÉCURRENCE PERSONNALISÉE */}
      <Dialog
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        position="center"
      >
        <View className="p-6 gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground dark:text-white">
              Récurrence personnalisée
            </Text>
            <Pressable
              onPress={() => setShowCustomModal(false)}
              className="p-1"
            >
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Intervalle */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground dark:text-white">
              Répéter toutes les
            </Text>
            <View className="flex-row gap-3 items-center flex-wrap">
              <TextInput
                value={customIntervalStr}
                onChangeText={setCustomIntervalStr}
                keyboardType="numeric"
                style={[
                  {
                    width: 60,
                    borderWidth: 1.5,
                    borderColor: "#E2E8F0",
                    borderRadius: 10,
                    padding: 10,
                    textAlign: "center",
                    fontSize: 16,
                    color: "#0f172a",
                  },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
              <View className="flex-row gap-2 flex-1 flex-wrap">
                {(
                  [
                    ["day", "Jour(s)"],
                    ["week", "Semaine(s)"],
                    ["month", "Mois"],
                    ["year", "Année(s)"],
                  ] as [RecurrenceUnit, string][]
                ).map(([u, label]) => (
                  <Pressable
                    key={u}
                    onPress={() => setCustomUnit(u)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: customUnit === u ? "#3B82F6" : "#E2E8F0",
                      backgroundColor:
                        customUnit === u ? "#EFF6FF" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "600",
                        fontSize: 12,
                        color: customUnit === u ? "#3B82F6" : "#94A3B8",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Jours de semaine (si semaine sélectionnée) */}
          {customUnit === "week" && (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground dark:text-white">
                Répéter le
              </Text>
              <View className="flex-row gap-1.5">
                {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => {
                  const active = customDaysOfWeek.includes(i);
                  return (
                    <Pressable
                      key={i}
                      onPress={() =>
                        setCustomDaysOfWeek((prev) =>
                          prev.includes(i)
                            ? prev.filter((x) => x !== i)
                            : [...prev, i],
                        )
                      }
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 999,
                        maxWidth: 40,
                        borderWidth: 1.5,
                        borderColor: active ? "#3B82F6" : "#E2E8F0",
                        backgroundColor: active ? "#3B82F6" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          fontSize: 11,
                          color: active ? "white" : "#94A3B8",
                        }}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Se termine */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground dark:text-white">
              Se termine
            </Text>
            {(
              [
                ["never", "Jamais", null],
                ["count", "Après", "occurrences"],
                ["date", "Le", null],
              ] as [EndType, string, string | null][]
            ).map(([t, lbl, suffix]) => (
              <Pressable
                key={t}
                onPress={() => setCustomEndType(t)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: customEndType === t ? "#3B82F6" : "#CBD5E1",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {customEndType === t && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#3B82F6",
                      }}
                    />
                  )}
                </View>
                <Text
                  style={{ fontSize: 14, color: "#0f172a", fontWeight: "500" }}
                >
                  {lbl}
                </Text>
                {t === "count" && customEndType === "count" && (
                  <>
                    <TextInput
                      value={customCountStr}
                      onChangeText={setCustomCountStr}
                      keyboardType="numeric"
                      style={[
                        {
                          width: 60,
                          borderWidth: 1.5,
                          borderColor: "#DBEAFE",
                          borderRadius: 8,
                          padding: 6,
                          textAlign: "center",
                          fontSize: 14,
                          color: "#3B82F6",
                          fontWeight: "700",
                        },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : {},
                      ]}
                    />
                    <Text style={{ fontSize: 14, color: "#64748B" }}>
                      {suffix}
                    </Text>
                  </>
                )}
                {t === "date" && customEndType === "date" && (
                  <TextInput
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor="#CBD5E1"
                    style={[
                      {
                        flex: 1,
                        borderWidth: 1.5,
                        borderColor: "#DBEAFE",
                        borderRadius: 8,
                        padding: 6,
                        fontSize: 14,
                        color: "#3B82F6",
                      },
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : {},
                    ]}
                  />
                )}
              </Pressable>
            ))}
          </View>

          <Button
            onPress={() => {
              const interval = parseInt(customIntervalStr) || 1;
              const count = parseInt(customCountStr) || 4;
              setRecurrence({
                freq: "custom",
                interval,
                unit: customUnit,
                daysOfWeek: customDaysOfWeek,
                endType: customEndType,
                count,
                endDate: customEndDate,
              });
              setShowCustomModal(false);
            }}
            className="rounded-[20px]"
          >
            <Check size={16} color="white" />
            <Text className="text-white font-bold ml-2">Confirmer</Text>
          </Button>
        </View>
      </Dialog>

      {/* MODAL NOUVEAU CLIENT */}
      <Dialog
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        position="bottom"
      >
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground dark:text-white">
              Nouveau client
            </Text>
            <Pressable onPress={() => setShowNewClient(false)} className="p-1">
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => {
                setNcFocused("name");
                ncNameRef.current?.focus();
              }}
              style={{
                borderWidth: 1.5,
                borderColor: ncFocused === "name" ? "#3B82F6" : "#E2E8F0",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: ncFocused === "name" ? "#3B82F6" : "#94A3B8",
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                NOM / ENTREPRISE
              </Text>
              <TextInput
                ref={ncNameRef}
                value={newClientName}
                onChangeText={setNewClientName}
                placeholder="Ex: Jean Dupont"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("name")}
                onBlur={() => setNcFocused(null)}
                style={[
                  { fontSize: 15, color: "#0f172a" },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setNcFocused("street");
                ncStreetRef.current?.focus();
              }}
              style={{
                borderWidth: 1.5,
                borderColor: ncFocused === "street" ? "#3B82F6" : "#E2E8F0",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: ncFocused === "street" ? "#3B82F6" : "#94A3B8",
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                RUE ET NUMÉRO *
              </Text>
              <TextInput
                ref={ncStreetRef}
                value={newClientStreet}
                onChangeText={setNewClientStreet}
                placeholder="10 Rue de la Paix"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("street")}
                onBlur={() => setNcFocused(null)}
                style={[
                  { fontSize: 15, color: "#0f172a" },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  setNcFocused("zip");
                  ncZipRef.current?.focus();
                }}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: ncFocused === "zip" ? "#3B82F6" : "#E2E8F0",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: "#F8FAFC",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: ncFocused === "zip" ? "#3B82F6" : "#94A3B8",
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  CP
                </Text>
                <TextInput
                  ref={ncZipRef}
                  value={newClientZip}
                  onChangeText={setNewClientZip}
                  placeholder="7000"
                  keyboardType="numeric"
                  placeholderTextColor="#CBD5E1"
                  onFocus={() => setNcFocused("zip")}
                  onBlur={() => setNcFocused(null)}
                  style={[
                    { fontSize: 15, color: "#0f172a" },
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : {},
                  ]}
                />
              </Pressable>
              <CityAutocomplete value={newClientCity} onChangeText={setNewClientCity}>
                {({ onChangeText: onCityChange, onFocus: onCityFocus, onBlur: onCityBlur, inputRef: cityRef }) => (
                  <Pressable
                    onPress={() => { setNcFocused("city"); cityRef.current?.focus(); }}
                    style={{
                      flex: 2,
                      borderWidth: 1.5,
                      borderColor: ncFocused === "city" ? "#3B82F6" : "#E2E8F0",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      backgroundColor: "#F8FAFC",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: ncFocused === "city" ? "#3B82F6" : "#94A3B8",
                        fontWeight: "600",
                        marginBottom: 4,
                      }}
                    >
                      VILLE *
                    </Text>
                    <TextInput
                      ref={cityRef}
                      value={newClientCity}
                      onChangeText={onCityChange}
                      placeholder="Mons"
                      placeholderTextColor="#CBD5E1"
                      onFocus={() => { onCityFocus(); setNcFocused("city"); }}
                      onBlur={() => { onCityBlur(); setNcFocused(null); }}
                      style={[
                        { fontSize: 15, color: "#0f172a" },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : {},
                      ]}
                    />
                  </Pressable>
                )}
              </CityAutocomplete>
            </View>
            <Pressable
              onPress={() => {
                setNcFocused("phone");
                ncPhoneRef.current?.focus();
              }}
              style={{
                borderWidth: 1.5,
                borderColor: ncFocused === "phone" ? "#3B82F6" : "#E2E8F0",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: ncFocused === "phone" ? "#3B82F6" : "#94A3B8",
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                TÉLÉPHONE *
              </Text>
              <TextInput
                ref={ncPhoneRef}
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                placeholder="0487 12 34 56"
                keyboardType="phone-pad"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("phone")}
                onBlur={() => setNcFocused(null)}
                style={[
                  { fontSize: 15, color: "#0f172a" },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setNcFocused("email");
                ncEmailRef.current?.focus();
              }}
              style={{
                borderWidth: 1.5,
                borderColor: ncFocused === "email" ? "#3B82F6" : "#E2E8F0",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: ncFocused === "email" ? "#3B82F6" : "#94A3B8",
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                EMAIL
              </Text>
              <TextInput
                ref={ncEmailRef}
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="client@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("email")}
                onBlur={() => setNcFocused(null)}
                style={[
                  { fontSize: 15, color: "#0f172a" },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setNcFocused("notes");
                ncNotesRef.current?.focus();
              }}
              style={{
                borderWidth: 1.5,
                borderColor: ncFocused === "notes" ? "#3B82F6" : "#E2E8F0",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: ncFocused === "notes" ? "#3B82F6" : "#94A3B8",
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                NOTES INTERNES
              </Text>
              <TextInput
                ref={ncNotesRef}
                value={newClientNotes}
                onChangeText={setNewClientNotes}
                placeholder="Code porte, préférences..."
                multiline
                numberOfLines={3}
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("notes")}
                onBlur={() => setNcFocused(null)}
                style={[
                  { fontSize: 15, color: "#0f172a", minHeight: 60 },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </Pressable>
          </View>

          <Button
            onPress={handleCreateClient}
            loading={createClientMutation.isPending}
            className="mt-4"
            style={{ borderRadius: 16 }}
          >
            <Check size={18} color="white" />
            <Text className="text-white font-bold ml-2">Créer le client</Text>
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
