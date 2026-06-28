/**
 * useTokensPerHour — Tokens/Hour card props from the LIVE LiteLLM usage layer.
 *
 * **Source:** GET /api/llm/usage?range=<r> for several windows (server-side 60s
 *   cached, so multiple range calls are cheap). Real tokens/hour = total_tok /
 *   window_hours per window; sparkline = the per-window rates; trend = 24h vs 7d.
 * **Fallback:** graceful "—" if the usage layer is unavailable.
 *
 * Replaces the prior /api/executor/stats source, which carried no token fields
 * (the card rendered a dead "—"). Polls every 30s.
 */

import { useEffect, useState } from "react";
import type { TokensPerHourData } from "../components/DashboardCards";

const HOURS: Record<string, number> = { "1h": 1, "12h": 12, "24h": 24, "3d": 72, "5d": 120, "7d": 168, "14d": 336, "28d": 672 };
// Windows used to build the sparkline (recent → longer), newest-rate last.
const SERIES_RANGES = ["1h", "12h", "24h", "3d", "5d", "7d", "14d", "28d"];

const STUB_DATA: TokensPerHourData = {
  value: "—",
  unit: "tok/h",
  trendPct: 0,
  trendDirection: "down",
  series: [],
  minLabel: "min —",
  peakLabel: "peak —",
};

function formatTokens(val: number): string {
  if (!val || val <= 0) return "—";
  if (val >= 1_000_000) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(Math.round(val));
}

async function fetchRate(range: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/llm/usage?range=${range}`, { credentials: "include" });
    if (!res.ok) return null;
    const j = await res.json();
    const tok = j?.kpis?.tokens ?? j?.twoLedger?.ledgerA?.total_tok ?? 0;
    const hrs = HOURS[range] ?? 1;
    return tok > 0 ? tok / hrs : 0;
  } catch {
    return null;
  }
}

export function useTokensPerHour(): TokensPerHourData {
  const [data, setData] = useState<TokensPerHourData>(STUB_DATA);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const rates = await Promise.all(SERIES_RANGES.map(fetchRate));
        if (!mounted) return;
        const valid = rates.map((r, i) => ({ r, range: SERIES_RANGES[i] })).filter((x) => x.r !== null) as { r: number; range: string }[];
        if (valid.length === 0) { setData(STUB_DATA); setError("no usage data"); return; }

        const series = valid.map((x) => Math.round(x.r));
        const cur = valid.find((x) => x.range === "24h")?.r ?? valid[0].r;        // headline = 24h rate
        const wk = valid.find((x) => x.range === "7d")?.r ?? cur;                  // trend baseline = 7d rate
        const trendPct = wk > 0 ? Math.round(Math.abs((cur - wk) / wk) * 100) : 0;
        const trendDirection: "up" | "down" = cur >= wk ? "up" : "down";
        const nonzero = series.filter((s) => s > 0);
        const min = nonzero.length ? Math.min(...nonzero) : 0;
        const peak = series.length ? Math.max(...series) : 0;

        setData({
          value: formatTokens(cur),
          unit: "tok/h",
          trendPct,
          trendDirection,
          series: series.length ? series : [0],
          minLabel: `min ${formatTokens(min)}`,
          peakLabel: `peak ${formatTokens(peak)}`,
        });
        setError(null);
      } catch (err) {
        if (mounted) { setError(err instanceof Error ? err.message : String(err)); setData(STUB_DATA); }
      }
    };

    load();
    pollId = setInterval(load, 30000);
    return () => { mounted = false; if (pollId) clearInterval(pollId); };
  }, []);

  if (error && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn("[useTokensPerHour] ", error);
  }
  return data;
}
