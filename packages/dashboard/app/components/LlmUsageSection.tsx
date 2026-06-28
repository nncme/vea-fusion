/**
 * LlmUsageSection — the LLM-Ops usage dashboard merged into the Fusion-VEA home
 * (LG-3 / VISION §5.1, D1). Renders live LiteLLM usage in the AIME light+dark
 * system: KPI row (calls · tokens · Tier-0 token share · cloud spend), a
 * MODEL USAGE ↔ TOKEN UTILIZATION view toggle, the Two-Ledger summary
 * (Tier-0 share, Max bleed), and an 8-range selector.
 *
 * Taste contract: AIME tokens only (oxblood `--accent` = cloud cost, gold
 * `--signal` = Tier-0/local-free); mono numerals; no emoji; loading/empty/error
 * states; bars use static widths (no animated layout properties).
 */

import { useState } from "react";
import { useLlmUsage, LLM_RANGES, type LlmRange, type LlmModelRow } from "../hooks/useLlmUsage";
import "./LlmUsageSection.css";

type ViewMode = "usage" | "tokens";

function compact(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
function usd(n: number): string {
  if (!n) return "$0.00";
  return n >= 1000 ? `$${(n / 1000).toFixed(2)}k` : `$${n.toFixed(2)}`;
}
function pct(n: number): string {
  return `${Math.round((n || 0) * 100)}%`;
}

function ModelUsageRows({ models }: { models: LlmModelRow[] }) {
  const maxSpend = Math.max(...models.map((m) => m.spendUsd), 0.0001);
  const maxCalls = Math.max(...models.map((m) => m.calls), 1);
  return (
    <ul className="llm-usage__rows" aria-label="Model usage by spend">
      {models.map((m) => (
        <li key={m.model} className="llm-usage__row">
          <span className="llm-usage__row-model" title={m.model}>
            <span className={`llm-usage__tier llm-usage__tier--${(m.tier || "t1").toLowerCase()}`}>{m.tier || "—"}</span>
            {m.model}
          </span>
          <span className="llm-usage__bar-wrap" aria-hidden="true">
            <span className="llm-usage__bar llm-usage__bar--calls" style={{ width: `${(m.calls / maxCalls) * 100}%` }} />
            <span className="llm-usage__bar llm-usage__bar--spend" style={{ width: `${(m.spendUsd / maxSpend) * 100}%` }} />
          </span>
          <span className="llm-usage__row-figs">
            <span className="mono">{compact(m.calls)}</span>
            <span className="mono llm-usage__spend">{usd(m.spendUsd)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function TokenUtilRows({ models }: { models: LlmModelRow[] }) {
  const maxTok = Math.max(...models.map((m) => m.totalTok), 1);
  return (
    <ul className="llm-usage__rows" aria-label="Token utilization">
      {models.map((m) => {
        const total = m.totalTok || 1;
        return (
          <li key={m.model} className="llm-usage__row">
            <span className="llm-usage__row-model" title={m.model}>{m.model}</span>
            <span className="llm-usage__bar-wrap llm-usage__bar-wrap--stacked" aria-hidden="true">
              <span className="llm-usage__seg llm-usage__seg--prompt" style={{ width: `${(m.promptTok / maxTok) * 100}%` }} />
              <span className="llm-usage__seg llm-usage__seg--completion" style={{ width: `${(m.completionTok / maxTok) * 100}%` }} />
            </span>
            <span className="llm-usage__row-figs">
              <span className="mono">{compact(m.totalTok)}</span>
              <span className="mono llm-usage__cache">{compact(m.cacheHits)} cache</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function LlmUsageSection() {
  const { data, range, setRange, loading, error } = useLlmUsage("24h");
  const [view, setView] = useState<ViewMode>("usage");
  const k = data.kpis;
  const headline = (data.twoLedger.headline ?? {}) as Record<string, unknown>;
  const maxBleed = (data.twoLedger.maxBleed ?? {}) as Record<string, number>;

  return (
    <section className="llm-usage" aria-label="LLM operations usage">
      <header className="llm-usage__head">
        <div>
          <p className="llm-usage__eyebrow">LLM Ops · LiteLLM usage{data.stale ? " · snapshot" : ""}</p>
          <h2 className="llm-usage__title">Spend &amp; utilization</h2>
        </div>
        <div className="llm-usage__ranges" role="tablist" aria-label="Time range">
          {LLM_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              className={`llm-usage__range ${r === range ? "is-active" : ""}`}
              onClick={() => setRange(r as LlmRange)}
            >{r}</button>
          ))}
        </div>
      </header>

      {/* KPI row — logic-grouped by hairline, mono numerals (taste Rule 4) */}
      <div className="llm-usage__kpis">
        <div className="llm-usage__kpi">
          <span className="llm-usage__kpi-label">Calls</span>
          <span className="llm-usage__kpi-val mono">{loading ? "—" : compact(k.calls)}</span>
        </div>
        <div className="llm-usage__kpi">
          <span className="llm-usage__kpi-label">Tokens</span>
          <span className="llm-usage__kpi-val mono">{loading ? "—" : compact(k.tokens)}</span>
        </div>
        <div className="llm-usage__kpi">
          <span className="llm-usage__kpi-label">Tier-0 token share</span>
          <span className="llm-usage__kpi-val mono llm-usage__t0">{loading ? "—" : pct(k.t0TokenShare)}</span>
        </div>
        <div className="llm-usage__kpi">
          <span className="llm-usage__kpi-label">Cloud spend</span>
          <span className="llm-usage__kpi-val mono llm-usage__spend">{loading ? "—" : usd(k.cloudSpendUsd)}</span>
        </div>
      </div>

      {/* View toggle */}
      <div className="llm-usage__viewbar">
        <button className={`llm-usage__viewbtn ${view === "usage" ? "is-active" : ""}`} onClick={() => setView("usage")}>Model usage</button>
        <button className={`llm-usage__viewbtn ${view === "tokens" ? "is-active" : ""}`} onClick={() => setView("tokens")}>Token utilization</button>
      </div>

      {/* Body: states (taste Rule 5) */}
      {error && data.models.length === 0 ? (
        <div className="llm-usage__state llm-usage__state--err">Usage unavailable — {error}. Showing zeros; retrying.</div>
      ) : loading ? (
        <div className="llm-usage__state" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="llm-usage__skel" />)}
        </div>
      ) : data.models.length === 0 ? (
        <div className="llm-usage__state">No model activity in this window.</div>
      ) : view === "usage" ? (
        <ModelUsageRows models={data.models} />
      ) : (
        <TokenUtilRows models={data.models} />
      )}

      {/* Two-Ledger summary */}
      <footer className="llm-usage__ledger">
        <div className="llm-usage__ledger-item">
          <span className="llm-usage__ledger-label">Tier-0 call share</span>
          <span className="llm-usage__ledger-val mono llm-usage__t0">{pct(k.tier0CallShare)}</span>
        </div>
        <div className="llm-usage__ledger-item">
          <span className="llm-usage__ledger-label">Max bleed (tokens)</span>
          <span className="llm-usage__ledger-val mono llm-usage__spend">{compact((maxBleed.tokens as number) ?? 0)}</span>
        </div>
        <div className="llm-usage__ledger-item">
          <span className="llm-usage__ledger-label">Max bleed (cost)</span>
          <span className="llm-usage__ledger-val mono llm-usage__spend">{usd((maxBleed.cost as number) ?? 0)}</span>
        </div>
        <div className="llm-usage__ledger-item">
          <span className="llm-usage__ledger-label">Cron sessions / day</span>
          <span className="llm-usage__ledger-val mono">{String((headline.max_autonomous_cron_sessions_per_day as number) ?? "—")}</span>
        </div>
      </footer>
    </section>
  );
}

export default LlmUsageSection;
