/**
 * useLlmUsage — fetch live LLM-Ops usage from /api/llm/usage and expose it to the
 * home dashboard section (LG-2 / VISION §5.1).
 *
 * **Source:** GET /api/llm/usage?range=<1h|12h|24h|3d|5d|7d|14d|28d>
 * **Transform:** typed `LlmUsageData` (KPIs, per-model rows, two-ledger).
 * **Fallback:** zeros on failure (graceful degradation — never throws to the UI).
 * Polls every 30s; range is switchable via the returned `setRange`.
 *
 * Mirrors the useRuntimeHealth / useTokensPerHour pattern already in the codebase.
 */

import { useEffect, useState, useCallback } from "react";

export type LlmRange = "1h" | "12h" | "24h" | "3d" | "5d" | "7d" | "14d" | "28d";
export const LLM_RANGES: LlmRange[] = ["1h", "12h", "24h", "3d", "5d", "7d", "14d", "28d"];

export interface LlmModelRow {
  model: string;
  calls: number;
  spendUsd: number;
  promptTok: number;
  completionTok: number;
  totalTok: number;
  cacheHits: number;
  tier: string;
}

export interface LlmUsageData {
  range: string;
  generated: string | null;
  source: string;
  stale: boolean;
  kpis: {
    calls: number;
    tokens: number;
    t0TokenShare: number; // 0..1
    cloudSpendUsd: number;
    tier0CallShare: number; // 0..1
  };
  models: LlmModelRow[];
  twoLedger: {
    ledgerA: Record<string, number> | null;
    maxBleed: Record<string, number> | null;
    headline: Record<string, unknown> | null;
  };
}

function emptyData(range: LlmRange): LlmUsageData {
  return {
    range,
    generated: null,
    source: "unavailable",
    stale: true,
    kpis: { calls: 0, tokens: 0, t0TokenShare: 0, cloudSpendUsd: 0, tier0CallShare: 0 },
    models: [],
    twoLedger: { ledgerA: null, maxBleed: null, headline: null },
  };
}

export function useLlmUsage(initialRange: LlmRange = "24h"): {
  data: LlmUsageData;
  range: LlmRange;
  setRange: (r: LlmRange) => void;
  loading: boolean;
  error: string | null;
} {
  const [range, setRange] = useState<LlmRange>(initialRange);
  const [data, setData] = useState<LlmUsageData>(() => emptyData(initialRange));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (r: LlmRange, mountedRef: { v: boolean }) => {
    try {
      const response = await fetch(`/api/llm/usage?range=${r}`, { credentials: "include" });
      if (!response.ok) throw new Error(`/api/llm/usage returned ${response.status}`);
      const json = (await response.json()) as LlmUsageData;
      if (mountedRef.v) {
        setData(json);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (mountedRef.v) {
        setError(msg);
        setData(emptyData(r));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const mountedRef = { v: true };
    let pollId: ReturnType<typeof setInterval> | null = null;
    setLoading(true);
    fetchData(range, mountedRef);
    pollId = setInterval(() => fetchData(range, mountedRef), 30000);
    return () => {
      mountedRef.v = false;
      if (pollId) clearInterval(pollId);
    };
  }, [range, fetchData]);

  if (error && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn("[useLlmUsage] fetch error:", error);
  }

  return { data, range, setRange, loading, error };
}
