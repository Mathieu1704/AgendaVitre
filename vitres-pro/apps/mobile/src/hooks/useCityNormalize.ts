import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function useCities(): string[] {
  const { data } = useQuery<string[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/api/settings/zones/cities")).data,
    staleTime: 10 * 60 * 1000,
  });
  return data ?? [];
}

// Returns an onBlur handler that normalizes the city value to the canonical DB form.
export function useCityNormalize(value: string, onChange: (v: string) => void) {
  const cities = useCities();

  const normalize = useCallback(() => {
    if (!value.trim() || cities.length === 0) return;
    const q = value.trim().toLowerCase();
    const exact = cities.find((c) => c.toLowerCase() === q);
    if (exact) { onChange(exact); return; }
    const starts = cities.filter((c) => c.toLowerCase().startsWith(q));
    if (starts.length === 1) onChange(starts[0]);
  }, [value, cities, onChange]);

  return normalize;
}
