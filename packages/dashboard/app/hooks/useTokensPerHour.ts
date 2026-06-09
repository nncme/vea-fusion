/**
 * useTokensPerHour — fetch daemon usage data and transform into Tokens/Hour card props.
 *
 * **Source:** GET /api/executor/stats (existing Fusion daemon endpoint)
 * **Transform:** Extract tokens/hour value, build 7-point sparkline, compute trend %
 * **Fallback:** Returns stub data if endpoint unavailable (graceful degradation)
 *
 * C.4.3 BLOCKER — Phase B data-wiring layer
 */

import { useEffect, useState } from "react";
import type { TokensPerHourData } from "../components/DashboardCards";

interface ExecutorStats {
  tokensPerHour?: number;
  tokensPerHourHistory?: number[];
  avgTokensPerHour?: number;
  peakTokensPerHour?: number;
  minTokensPerHour?: number;
}

/**
 * Stub/fallback data used when executor stats are unavailable.
 */
const STUB_DATA: TokensPerHourData = {
  value: "—",
  unit: "tok/h",
  trendPct: 0,
  trendDirection: "down",
  series: [6.2, 7.1, 9.4, 11.2, 10.3, 5.1, 8.4],
  minLabel: "min —",
  peakLabel: "peak —",
};

/**
 * Format a numeric value into a human-readable "Xk" format.
 * Examples: 8400 → "8.4k", 1234 → "1.2k", 100 → "100"
 */
function formatTokens(val: number | undefined): string {
  if (val === undefined || val === 0) return "—";
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(Math.round(val));
}

/**
 * Compute percentage change between two values.
 * Returns the magnitude (always positive); use trendDirection separately.
 */
function computeTrendPct(current: number, previous: number): number {
  if (previous === 0) return 0;
  const pct = Math.abs(((current - previous) / previous) * 100);
  return Math.round(pct);
}

/**
 * Determine trend direction based on current vs 7-day average.
 */
function getTrendDirection(current: number, series: number[]): "up" | "down" {
  if (series.length === 0) return "down";
  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  return current > avg ? "up" : "down";
}

/**
 * Transform executor stats JSON into Tokens/Hour card props.
 */
function transformStats(stats: ExecutorStats): TokensPerHourData {
  const current = stats.tokensPerHour ?? 0;
  const series = stats.tokensPerHourHistory ?? [];
  const peak = stats.peakTokensPerHour ?? 0;
  const min = stats.minTokensPerHour ?? 0;

  // If we have history, use it; otherwise use a fallback 7-point series
  const sparklineSeries = series.length > 0 ? series.slice(-7) : STUB_DATA.series;

  // Compute trend: current vs the average of the series
  const prev = sparklineSeries.length > 0 ? sparklineSeries[0] : current;
  const trendPct = computeTrendPct(current, prev);
  const trendDirection = getTrendDirection(current, sparklineSeries);

  return {
    value: formatTokens(current),
    unit: "tok/h",
    trendPct,
    trendDirection,
    series: sparklineSeries,
    minLabel: `min ${formatTokens(min)}`,
    peakLabel: `peak ${formatTokens(peak)}`,
  };
}

/**
 * Fetch executor stats and return Tokens/Hour card props.
 * Re-fetches every 30 seconds if the API is healthy.
 */
export function useTokensPerHour(): TokensPerHourData {
  const [data, setData] = useState<TokensPerHourData>(STUB_DATA);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const response = await fetch("/api/executor/stats", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Executor stats returned ${response.status}`);
        }

        const stats: ExecutorStats = await response.json();

        if (isMounted) {
          setData(transformStats(stats));
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setError(msg);
          // Keep rendering stub data on error
          setData(STUB_DATA);
        }
      }
    };

    // Initial fetch
    fetchData();

    // Poll every 30 seconds
    pollIntervalId = setInterval(fetchData, 30000);

    return () => {
      isMounted = false;
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, []);

  // Log errors to console for debugging (remove in prod)
  if (error && process.env.NODE_ENV === "development") {
    console.warn("[useTokensPerHour] fetch error:", error);
  }

  return data;
}
