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
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
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
} from "lucide-react-native";
import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { MultiSelect } from "../../../src/ui/components/MultiSelect";
import { toast } from "../../../src/ui/toast";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dialog } from "../../../src/ui/components/Dialog";

import {
  toBrusselsDateTimeString,
  parseBrusselsDateTimeString,
} from "../../../src/lib/date";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";

type Client = {
  id: string;
  name: string | null;
  address: string | null;
  phone?: string | null;
};
type Item = { label: string; price: string; client_service_id?: string | null };
type ClientService = {
  id: string;
  label: string;
  price: number;
  position: number;
};
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

const NEEDS_CLIENT: IntervType[] = ["intervention"];
const NEEDS_ITEMS: IntervType[] = ["intervention"];

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

function generateDates(
  startStr: string,
  durationHours: number,
  rec: Recurrence,
): { start: Date; end: Date }[] {
  const base = parseBrusselsDateTimeString(startStr);
  if (!base) return [];
  const dur = durationHours * 3600000;
  if (rec.freq === "none")
    return [{ start: base, end: new Date(base.getTime() + dur) }];
  const MAX = 365;
  const targetCount =
    rec.endType === "count" ? Math.max(1, Math.min(rec.count, MAX)) : MAX;
  const endDate =
    rec.endType === "date" && rec.endDate
      ? new Date(rec.endDate + "T23:59:59")
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
    return dates;
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
  return dates;
}

export default function AddInterventionScreen() {
  const router = useRouter();
  const { id, reprise_of, from_view, from_date } = useLocalSearchParams<{
    id?: string;
    reprise_of?: string;
    from_view?: string;
    from_date?: string;
  }>();
  const isEditMode = !!id && !reprise_of;
  const isRepriseMode = !!reprise_of;

  const { isAdmin, userZone } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { isDark } = useTheme();

  const { employees } = useEmployees();

  const { data: hourlyRates } = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: async () => (await api.get("/api/settings/hourly-rates")).data,
    enabled: isAdmin,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await api.get("/api/settings/company")).data,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 500,
  });
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
    },
  );

  // Données pour reprise (source originale)
  const { data: repriseSource, isLoading: isLoadingReprise } = useQuery({
    queryKey: ["intervention-reprise", reprise_of],
    queryFn: async () => {
      if (!reprise_of) return null;
      return (await api.get(`/api/interventions/${reprise_of}`)).data;
    },
    enabled: isRepriseMode,
  });

  // --- States formulaire ---
  const [intervType, setIntervType] = useState<IntervType>("intervention");
  const [zone, setZone] = useState<"hainaut" | "ardennes">("hainaut");
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
  const [adHocItems, setAdHocItems] = useState<Item[]>([]);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceLabel, setNewServiceLabel] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "cash" | "invoice" | "invoice_cash"
  >("cash");

  const defaultStart = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const datePart = toBrusselsDateTimeString(tomorrow).split("T")[0];
    return `${datePart}T09:00`;
  }, []);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("");
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  // --- Récurrence ---
  const [recurrence, setRecurrence] = useState<Recurrence>(DEFAULT_RECURRENCE);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customIntervalStr, setCustomIntervalStr] = useState("1");
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>("week");
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>([]);
  const [customEndType, setCustomEndType] = useState<EndType>("count");
  const [customCountStr, setCustomCountStr] = useState("4");
  const [customEndDate, setCustomEndDate] = useState("");

  // --- Reprise : mode "non repris" ---
  const [noRepriseMode, setNoRepriseMode] = useState(false);
  const [noRepriseNote, setNoRepriseNote] = useState("");

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
  const { data: clientServices = [], refetch: refetchClientServices } =
    useQuery<ClientService[]>({
      queryKey: ["client-services", selectedClient?.id],
      queryFn: async () =>
        (await api.get(`/api/clients/${selectedClient!.id}/services`)).data,
      enabled: !!selectedClient?.id,
    });

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
  useEffect(() => {
    if (isEditMode && interventionData && clients) {
      setTitle(interventionData.title);
      setDescription(interventionData.description || "");
      setPaymentMode(
        (interventionData.payment_mode as any) ??
          (interventionData.is_invoice ? "invoice" : "cash"),
      );
      if (interventionData.type)
        setIntervType(interventionData.type as IntervType);
      if (interventionData.zone)
        setZone(interventionData.zone as "hainaut" | "ardennes");
      const start = new Date(interventionData.start_time);
      const end = new Date(interventionData.end_time);
      setStartDateStr(toBrusselsDateTimeString(start));
      setDurationHours(
        parseFloat(
          ((end.getTime() - start.getTime()) / 3600000).toFixed(2),
        ).toString(),
      );
      const foundClient = clients.find(
        (c) => c.id === interventionData.client_id,
      );
      if (foundClient) setSelectedClient(foundClient);
      else if (interventionData.client)
        setSelectedClient(interventionData.client);
      if (interventionData.employees)
        setSelectedEmployeeIds(
          interventionData.employees.map((e: any) => e.id),
        );
      if (interventionData.hourly_rate_id)
        setSelectedRateId(interventionData.hourly_rate_id);
      if (interventionData.items && interventionData.items.length > 0) {
        const withId = interventionData.items.filter(
          (i: any) => i.client_service_id,
        );
        const withoutId = interventionData.items.filter(
          (i: any) => !i.client_service_id,
        );
        setCheckedServiceIds(
          new Set(withId.map((i: any) => i.client_service_id as string)),
        );
        const overrides: Record<string, string> = {};
        withId.forEach((i: any) => {
          overrides[i.client_service_id] = i.price.toString();
        });
        setServicePriceOverrides(overrides);
        setAdHocItems(
          withoutId.map((i: any) => ({
            label: i.label,
            price: i.price.toString(),
          })),
        );
      }
    }
  }, [isEditMode, interventionData, clients]);

  // Pré-remplir depuis la source reprise (= semaine suivante)
  useEffect(() => {
    if (isRepriseMode && repriseSource && clients) {
      setTitle(repriseSource.title);
      setDescription(repriseSource.description || "");
      setPaymentMode(
        (repriseSource.payment_mode as any) ??
          (repriseSource.is_invoice ? "invoice" : "cash"),
      );
      if (repriseSource.type) setIntervType(repriseSource.type as IntervType);
      if (repriseSource.zone)
        setZone(repriseSource.zone as "hainaut" | "ardennes");

      const origStart = new Date(repriseSource.start_time);
      const origEnd = new Date(repriseSource.end_time);
      const nextDate = new Date(origStart);
      nextDate.setDate(nextDate.getDate() + 7); // par défaut +1 semaine
      setStartDateStr(toBrusselsDateTimeString(nextDate));
      setDurationHours(
        parseFloat(
          ((origEnd.getTime() - origStart.getTime()) / 3600000).toFixed(2),
        ).toString(),
      );

      const foundClient = clients.find((c) => c.id === repriseSource.client_id);
      if (foundClient) setSelectedClient(foundClient);
      else if (repriseSource.client) setSelectedClient(repriseSource.client);

      if (repriseSource.employees)
        setSelectedEmployeeIds(repriseSource.employees.map((e: any) => e.id));
      if (repriseSource.items && repriseSource.items.length > 0) {
        const withId = repriseSource.items.filter(
          (i: any) => i.client_service_id,
        );
        const withoutId = repriseSource.items.filter(
          (i: any) => !i.client_service_id,
        );
        setCheckedServiceIds(
          new Set(withId.map((i: any) => i.client_service_id as string)),
        );
        const overrides: Record<string, string> = {};
        withId.forEach((i: any) => {
          overrides[i.client_service_id] = i.price.toString();
        });
        setServicePriceOverrides(overrides);
        setAdHocItems(
          withoutId.map((i: any) => ({
            label: i.label,
            price: i.price.toString(),
          })),
        );
      }
    }
  }, [isRepriseMode, repriseSource, clients]);

  // Reset form quand on navigue vers "nouveau" (pas edit, pas reprise)
  useFocusEffect(
    useCallback(() => {
      if (!isEditMode && !isRepriseMode) {
        setTitle("");
        setDescription("");
        setIntervType("intervention");
        setZone("hainaut");
        setSelectedClient(null);
        setSelectedEmployeeIds([]);
        setCheckedServiceIds(new Set());
        setServicePriceOverrides({});
        setAdHocItems([]);
        setPaymentMode(hideCash ? "invoice" : "cash");
        setStartDateStr(defaultStart);
        setDurationHours("");
        setRecurrence(DEFAULT_RECURRENCE);
        setNoRepriseMode(false);
        setNoRepriseNote("");
        setShowRecurrenceDropdown(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, isRepriseMode]),
  );

  // Items finaux = services cochés + items ad-hoc
  const allItems = useMemo(() => {
    const serviceItems = clientServices
      .filter((s) => checkedServiceIds.has(s.id))
      .map((s) => ({
        label: s.label,
        price: servicePriceOverrides[s.id] ?? s.price.toString(),
        client_service_id: s.id,
      }));
    return [...serviceItems, ...adHocItems];
  }, [clientServices, checkedServiceIds, servicePriceOverrides, adHocItems]);

  const totalPrice = useMemo(
    () =>
      allItems.reduce(
        (acc, item) => acc + (parseFloat(item.price as string) || 0),
        0,
      ),
    [allItems],
  );

  const selectedRate =
    (hourlyRates as any[])?.find((r: any) => r.id === selectedRateId) ?? null;
  const computedHoursRaw =
    selectedRate && totalPrice > 0
      ? Math.round((totalPrice / selectedRate.rate) * 2) / 2
      : null;
  const computedHours =
    computedHoursRaw != null
      ? (() => {
          const h = Math.floor(computedHoursRaw);
          const m = Math.round((computedHoursRaw % 1) * 60);
          return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
        })()
      : null;

  const toggleService = (id: string) => {
    setCheckedServiceIds((prev) => {
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

  const clientItems = useMemo(
    () =>
      (clients ?? []).map((c) => ({
        id: c.id,
        label: c.name || c.address || "Client anonyme",
      })),
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

  const handleSubmit = async () => {
    if (NEEDS_CLIENT.includes(intervType) && !selectedClient)
      return toast.error("Client", "Sélectionne un client.");
    if (!title) return toast.error("Titre", "Titre requis.");
    const dur = Number(durationHours);
    if (!dur) return toast.error("Durée", "Durée requise.");

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
        items: cleanItems.map((i) => ({
          label: i.label,
          price: Number(i.price) || 0,
          client_service_id: i.client_service_id ?? null,
        })),
        hourly_rate_id: isAdmin ? (selectedRateId ?? null) : null,
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
          const start = parseBrusselsDateTimeString(startDateStr);
          if (!start) return toast.error("Date", "Vérifie la date.");
          startIso = start.toISOString();
          endIso = new Date(start.getTime() + dur * 3600000).toISOString();
        }
        await api.patch(`/api/interventions/${id}`, {
          ...basePayload,
          start_time: startIso,
          end_time: endIso,
          ...(isAdmin ? {} : { time_tbd: true }),
        });
        queryClient.invalidateQueries({ queryKey: ["interventions"] });
        queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
        queryClient.invalidateQueries({ queryKey: ["intervention", id] });
        toast.success("Succès", "Intervention modifiée !");
        router.push(`/(app)/calendar/${id}` as any);
        return;
      }

      // Calcul des occurrences (reprise ou création simple avec récurrence)
      // Non-admin : date-only, pas de récurrence, time_tbd = true
      let occurrences: { start: Date; end: Date }[];
      if (!isAdmin) {
        const datePart = startDateStr.split("T")[0];
        const startUtc = new Date(`${datePart}T00:00:00Z`);
        const endUtc = new Date(startUtc.getTime() + dur * 3600000);
        occurrences = [{ start: startUtc, end: endUtc }];
      } else {
        occurrences = generateDates(startDateStr, dur, recurrence);
      }
      if (occurrences.length === 0)
        return toast.error("Date", "Vérifie la date.");

      const groupId = occurrences.length > 1 ? crypto.randomUUID() : undefined;

      for (const occ of occurrences) {
        await api.post("/api/interventions", {
          ...basePayload,
          start_time: occ.start.toISOString(),
          end_time: occ.end.toISOString(),
          ...(isAdmin ? {} : { time_tbd: true }),
          recurrence_rule:
            occurrences.length > 1
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
        });
      }

      // Si reprise : marquer l'originale comme done
      if (isRepriseMode && reprise_of) {
        const now = new Date().toISOString();
        await api.patch(`/api/interventions/${reprise_of}`, {
          status: "done",
          real_end_time: now,
          reprise_taken: true,
        });
        queryClient.invalidateQueries({
          queryKey: ["intervention", reprise_of],
        });
      }

      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });

      const msg =
        occurrences.length > 1
          ? `${occurrences.length} interventions créées !`
          : isRepriseMode
            ? "RDV de reprise planifié !"
            : "Intervention créée !";
      toast.success("Succès", msg);

      if (isRepriseMode && reprise_of) {
        router.push({
          pathname: "/(app)/calendar",
          params: { date: new Date().toISOString().split("T")[0], view: "day" },
        });
      } else {
        router.push({
          pathname: "/(app)/calendar",
          params: {
            date: startDateStr,
            ...(from_view ? { view: from_view } : {}),
          },
        });
      }
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- "RDV non repris" ---
  const [isSubmittingNoReprise, setIsSubmittingNoReprise] = useState(false);

  const handleNoReprise = async () => {
    if (!reprise_of) return;
    setIsSubmittingNoReprise(true);
    try {
      await api.post(`/api/interventions/${reprise_of}/no-reprise`, {
        note: noRepriseNote.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["intervention", reprise_of] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Enregistré", "Intervention clôturée sans reprise.");
      router.push(`/(app)/calendar/${reprise_of}` as any);
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmittingNoReprise(false);
    }
  };

  const contextualOptions = useMemo(
    () => getContextualOptions(startDateStr),
    [startDateStr],
  );

  if (
    (isEditMode && isLoadingIntervention) ||
    (isRepriseMode && isLoadingReprise)
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

  const typeNeedsClient = NEEDS_CLIENT.includes(intervType);
  const typeNeedsItems = NEEDS_ITEMS.includes(intervType);

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
            if (isEditMode) router.push(`/(app)/calendar/${id}`);
            else if (isRepriseMode)
              router.push(`/(app)/calendar/${reprise_of}` as any);
            else
              router.push({
                pathname: "/(app)/calendar",
                params: from_view ? { view: from_view, date: from_date } : {},
              });
          }}
          className="p-2 rounded-full hover:bg-muted active:bg-muted"
        >
          <ChevronLeft size={24} className="text-foreground dark:text-white" />
        </Pressable>
        <Text className="text-lg font-bold ml-2 text-foreground dark:text-white">
          {isRepriseMode
            ? "Planifier la reprise"
            : isEditMode
              ? "Modifier l'intervention"
              : "Nouvelle intervention"}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <Card className="max-w-2xl w-full self-center rounded-[40px] overflow-hidden">
            {/* BANNIÈRE "RDV NON REPRIS" (mode reprise uniquement) */}
            {isRepriseMode && (
              <View style={{ padding: 16, paddingBottom: 0 }}>
                {!noRepriseMode ? (
                  <Pressable
                    onPress={() => setNoRepriseMode(true)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#F97316",
                      borderRadius: 20,
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      gap: 10,
                      shadowColor: "#F97316",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <AlertTriangle size={20} color="white" />
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "800",
                        fontSize: 16,
                        letterSpacing: 0.3,
                      }}
                    >
                      RDV non repris
                    </Text>
                  </Pressable>
                ) : (
                  <View
                    style={{
                      backgroundColor: isDark ? "#1E293B" : "white",
                      borderWidth: 2,
                      borderColor: "#F97316",
                      borderRadius: 20,
                      padding: 16,
                      gap: 12,
                      shadowColor: "#F97316",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={18} color="#F97316" />
                      <Text
                        style={{
                          color: "#F97316",
                          fontWeight: "800",
                          fontSize: 15,
                          flex: 1,
                        }}
                      >
                        Clôturer sans reprise
                      </Text>
                      <Pressable
                        onPress={() => setNoRepriseMode(false)}
                        style={{ padding: 4 }}
                      >
                        <X size={18} color="#94A3B8" />
                      </Pressable>
                    </View>
                    <TextInput
                      value={noRepriseNote}
                      onChangeText={setNoRepriseNote}
                      placeholder="Note optionnelle (raison, contexte...)"
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                      style={[
                        {
                          fontSize: 14,
                          color: isDark ? "#F1F5F9" : "#0f172a",
                          backgroundColor: isDark ? "#0F172A" : "#FFF7ED",
                          borderRadius: 12,
                          padding: 12,
                          minHeight: 70,
                          borderWidth: 1.5,
                          borderColor: "#FED7AA",
                        },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : {},
                      ]}
                    />
                    <Pressable
                      onPress={handleNoReprise}
                      disabled={isSubmittingNoReprise}
                      style={{
                        backgroundColor: "#F97316",
                        borderRadius: 14,
                        padding: 14,
                        alignItems: "center",
                        opacity: isSubmittingNoReprise ? 0.6 : 1,
                      }}
                    >
                      {isSubmittingNoReprise ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text
                          style={{
                            color: "white",
                            fontWeight: "800",
                            fontSize: 15,
                          }}
                        >
                          Confirmer sans reprise
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <CardHeader className="p-6 pb-2">
              <Text className="text-2xl font-extrabold text-foreground dark:text-white text-center">
                {isRepriseMode
                  ? "Reprise RDV"
                  : isEditMode
                    ? "Modifier"
                    : "Planifier"}
              </Text>
              <Text className="mt-1 text-muted-foreground text-center font-medium">
                {isRepriseMode
                  ? "Planifie le prochain RDV pour ce client"
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
              {typeNeedsClient && (
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
                            : null
                        }
                        items={clientItems}
                        onChange={(v) => {
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
              <View style={{ gap: 16 }}>
                <Input label="Titre" value={title} onChangeText={setTitle} />
                <DateTimePicker
                  value={startDateStr}
                  onChange={setStartDateStr}
                  label="Début de l'intervention"
                  dateOnly={!isAdmin}
                />
                <Input
                  label="Durée (heures)"
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="numeric"
                />
              </View>

              {/* RÉCURRENCE (pas en mode édition) */}
              {!isEditMode && (
                <View style={{ gap: 4 }}>
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

                  {/* Nombre d'occurrences si récurrence active */}
                  {recurrence.freq !== "none" && (
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
                </View>
              )}

              {/* PRESTATIONS */}
              {typeNeedsItems && (
                <View className="mt-2 pt-4 border-t border-border dark:border-slate-800">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-semibold text-foreground dark:text-white">
                      Prestations
                    </Text>
                    {!isAddingService && (
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
                        keyboardType="numeric"
                        value={newServicePrice}
                        onChangeText={setNewServicePrice}
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
                              const newSvc: ClientService = (
                                await api.post(
                                  `/api/clients/${selectedClient.id}/services`,
                                  {
                                    label: newServiceLabel.trim(),
                                    price: Number(newServicePrice) || 0,
                                    position: clientServices.length,
                                  },
                                )
                              ).data;
                              await refetchClientServices();
                              setCheckedServiceIds(
                                (prev) => new Set([...prev, newSvc.id]),
                              );
                            } catch {
                              toast.error("Erreur", "Impossible d'ajouter");
                            }
                          } else {
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
                  {clientServices.map((svc) => {
                    const checked = checkedServiceIds.has(svc.id);
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
                            value={svc.label}
                            placeholder="Nom du service"
                            onChangeText={async (t) => {
                              try {
                                await api.patch(
                                  `/api/clients/${selectedClient!.id}/services/${svc.id}`,
                                  { label: t },
                                );
                                await refetchClientServices();
                              } catch {
                                /* silently ignore */
                              }
                            }}
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
                            value={checked ? priceVal : svc.price.toString()}
                            placeholder="Prix"
                            keyboardType="numeric"
                            editable={checked}
                            onChangeText={(t) =>
                              setServicePriceOverrides((prev) => ({
                                ...prev,
                                [svc.id]: t,
                              }))
                            }
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
                          onPress={async () => {
                            try {
                              await api.delete(
                                `/api/clients/${selectedClient!.id}/services/${svc.id}`,
                              );
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
                              await refetchClientServices();
                            } catch {
                              toast.error("Erreur", "Impossible de supprimer");
                            }
                          }}
                          style={{ padding: 6 }}
                        >
                          <Trash2 size={18} color="#EF4444" />
                        </Pressable>
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
                          onChangeText={(t) =>
                            updateAdHocItem(index, "label", t)
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          placeholder="Prix"
                          keyboardType="numeric"
                          value={item.price}
                          onChangeText={(t) =>
                            updateAdHocItem(index, "price", t)
                          }
                        />
                      </View>
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
              {isAdmin && typeNeedsClient && (
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
                        icon: (c) => <Banknote size={14} color={c} />,
                      },
                      {
                        id: "invoice",
                        label: "FAC",
                        pillColor: "#22C55E",
                        activeTextColor: "#fff",
                        icon: (c) => <FileText size={14} color={c} />,
                      },
                      {
                        id: "invoice_cash",
                        label: "FAC+Esp.",
                        pillColor: "#F97316",
                        activeTextColor: "#fff",
                        icon: (c) => <Wallet size={14} color={c} />,
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
                    <Text
                      style={{ fontSize: 11, color: "#F97316", marginTop: 5 }}
                    >
                      L'employé encaisse sur place et une facture sera émise
                    </Text>
                  )}
                </View>
              )}

              {/* ACTIONS */}
              <View className="mt-6 flex-row gap-3">
                <View
                  style={{
                    flex: 1,
                    marginLeft: isWeb ? 0 : -22,
                    marginRight: isWeb ? 0 : 15,
                  }}
                >
                  <Button
                    variant="outline"
                    onPress={() => {
                      if (isRepriseMode)
                        router.push(`/(app)/calendar/${reprise_of}` as any);
                      else
                        router.push({
                          pathname: "/(app)/calendar",
                          params: from_view
                            ? { view: from_view, date: from_date }
                            : {},
                        });
                    }}
                    className="w-full"
                    style={{ borderRadius: 20 }}
                  >
                    Annuler
                  </Button>
                </View>
                <View style={{ flex: 1, marginRight: isWeb ? 0 : 16 }}>
                  <Button
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full"
                    style={{ borderRadius: 20 }}
                  >
                    {isSubmitting
                      ? "Envoi..."
                      : isRepriseMode
                        ? "Confirmer"
                        : isEditMode
                          ? "Mettre à jour"
                          : "Valider"}
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

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
              <Pressable
                onPress={() => {
                  setNcFocused("city");
                  ncCityRef.current?.focus();
                }}
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
                  ref={ncCityRef}
                  value={newClientCity}
                  onChangeText={setNewClientCity}
                  placeholder="Mons"
                  placeholderTextColor="#CBD5E1"
                  onFocus={() => setNcFocused("city")}
                  onBlur={() => setNcFocused(null)}
                  style={[
                    { fontSize: 15, color: "#0f172a" },
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : {},
                  ]}
                />
              </Pressable>
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
