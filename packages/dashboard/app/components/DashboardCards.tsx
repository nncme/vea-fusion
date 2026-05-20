/**
 * DashboardCards — the three at-a-glance cards for the Fusion Option E
 * homepage (DESIGN.md §3.1.c / §4.3).
 *
 *   1. Pending Decisions — count + oldest-item age + top-3 preview + ⌘K CTA
 *   2. Tokens / Hour     — value + 7-point inline SVG sparkline + ▼/▲ trend
 *   3. Runtime Health    — 6-host status grid
 *
 * Presentational + props-driven with sensible stub defaults. Live data
 * binding is a later wave (see DESIGN.md §7 — endpoints TBD); this
 * component renders sample data only and is NOT wired into App.tsx.
 *
 * Styled entirely with the AIME Leon Dore design tokens declared in
 * app/styles.css — no hardcoded hex.
 */

import { memo } from "react";
import "./DashboardCards.css";

/* ----------------------------------------------------------------- *
 * Types
 * ----------------------------------------------------------------- */

/** Priority class for a pending-decision preview row. */
export type DecisionPriority = "crit" | "high" | "norm";

/** A single pending-decision preview row (top-3 list). */
export interface PendingDecisionItem {
  /** Priority bucket — drives chip colour. */
  priority: DecisionPriority;
  /** Short chip label, e.g. `"P0"`. */
  label: string;
  /** Human-readable decision summary. */
  text: string;
  /** Age string, e.g. `"1h 12m"`. */
  age: string;
}

/** Props for the Pending Decisions card. */
export interface PendingDecisionsData {
  /** Total pending count — rendered as the large serif numeral. */
  count: number;
  /** Age of the oldest open item, e.g. `"1h 12m"`. */
  oldest: string;
  /** Count of items that will auto-resolve within the hour. */
  autoResolveCount: number;
  /** Top-3 preview rows. */
  preview: PendingDecisionItem[];
}

/** Props for the Tokens / Hour card. */
export interface TokensPerHourData {
  /** Display value, e.g. `"8.4k"` — rendered as the large serif numeral. */
  value: string;
  /** Unit caption, e.g. `"tok/h"`. */
  unit: string;
  /** Trend magnitude vs yesterday, e.g. `18`. */
  trendPct: number;
  /** `"down"` → oxblood `▼`; `"up"` → signal-gold `▲`. */
  trendDirection: "up" | "down";
  /** 7 data points for the sparkline (oldest → newest). */
  series: number[];
  /** Footer min label, e.g. `"min 5.1k"`. */
  minLabel: string;
  /** Footer peak label, e.g. `"peak 11.2k"`. */
  peakLabel: string;
}

/** Health status for a runtime host. */
export type HostStatus = "ok" | "warn" | "crit";

/** A single runtime host row. */
export interface RuntimeHost {
  /** Underlying hostname (used for the row tooltip). */
  host: string;
  /** Display label. */
  label: string;
  /** Health status — drives pip + status-text colour. */
  status: HostStatus;
  /** Short status note, e.g. `"healthy"` / `"forging"`. */
  note: string;
}

export interface DashboardCardsProps {
  /** Pending Decisions card data. */
  pending?: PendingDecisionsData;
  /** Tokens / Hour card data. */
  tokens?: TokensPerHourData;
  /** Runtime Health host list. */
  runtime?: RuntimeHost[];
  /**
   * Invoked when the Pending Decisions card (or its CTA) is activated —
   * summons the ⌘K Fabric spotlight. Wired up in the A2 wave.
   */
  onSummonSpotlight?: () => void;
}

/* ----------------------------------------------------------------- *
 * Stub / sample defaults (DESIGN.md §7 — believable sample data)
 * ----------------------------------------------------------------- */

const DEFAULT_PENDING: PendingDecisionsData = {
  count: 5,
  oldest: "1h 12m",
  autoResolveCount: 2,
  preview: [
    {
      priority: "crit",
      label: "P0",
      text: "BCG Senior Director — counter-offer email pending",
      age: "1h 12m",
    },
    {
      priority: "high",
      label: "P1",
      text: "OpenClaw harness force-push to main (no CI gate)",
      age: "47m",
    },
    {
      priority: "norm",
      label: "P2",
      text: "Polymarket ELECTION-2028 trim to 8% (auto in 47m)",
      age: "22m",
    },
  ],
};

const DEFAULT_TOKENS: TokensPerHourData = {
  value: "8.4k",
  unit: "tok/h",
  trendPct: 18,
  trendDirection: "down",
  series: [6.2, 7.1, 9.4, 11.2, 10.3, 5.1, 8.4],
  minLabel: "min 5.1k",
  peakLabel: "peak 11.2k",
};

const DEFAULT_RUNTIME: RuntimeHost[] = [
  { host: "cnnsm1mini", label: "Mac mini", status: "ok", note: "healthy" },
  { host: "cnnsvps1do", label: "Hermes", status: "ok", note: "healthy" },
  // OpenClaw deliberately renders a `warn` state — DESIGN.md §7 keeps
  // it FORGING to exercise the oxblood end of the status palette.
  { host: "cnnsvps2do", label: "OpenClaw", status: "warn", note: "forging" },
  { host: "cnnseq12", label: "Cosmos (Beelink)", status: "ok", note: "healthy" },
  { host: "cf-tunnels", label: "Cloudflare", status: "ok", note: "4/4 up" },
  { host: "fabric-service", label: "Fabric", status: "ok", note: "v2.5" },
];

/* ----------------------------------------------------------------- *
 * Sparkline geometry — hand-rolled inline SVG, no chart library
 * ----------------------------------------------------------------- */

const SPARK_W = 240;
const SPARK_H = 56;
const SPARK_PAD = 4;

interface SparkGeometry {
  line: string;
  fill: string;
  dotX: number;
  dotY: number;
}

/** Map a numeric series to SVG path strings + last-point coordinates. */
function buildSparkline(series: number[]): SparkGeometry {
  if (series.length < 2) {
    return { line: "", fill: "", dotX: SPARK_PAD, dotY: SPARK_H - SPARK_PAD };
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const step = (SPARK_W - SPARK_PAD * 2) / (series.length - 1);

  const points: Array<[number, number]> = series.map((v, i) => {
    const x = SPARK_PAD + i * step;
    const y =
      SPARK_H - SPARK_PAD - ((v - min) / range) * (SPARK_H - SPARK_PAD * 2);
    return [x, y];
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const baseline = SPARK_H - SPARK_PAD;
  const fill =
    `${line} L${last[0].toFixed(2)},${baseline}` +
    ` L${first[0].toFixed(2)},${baseline} Z`;

  return { line, fill, dotX: last[0], dotY: last[1] };
}

/* ----------------------------------------------------------------- *
 * Component
 * ----------------------------------------------------------------- */

function DashboardCardsImpl({
  pending = DEFAULT_PENDING,
  tokens = DEFAULT_TOKENS,
  runtime = DEFAULT_RUNTIME,
  onSummonSpotlight,
}: DashboardCardsProps) {
  const spark = buildSparkline(tokens.series);
  const trendDown = tokens.trendDirection === "down";
  const trendGlyph = trendDown ? "▼" : "▲";
  const healthyCount = runtime.filter((h) => h.status === "ok").length;

  return (
    <div className="top-cards">
      {/* ---- Card 1: Pending Decisions ---- */}
      {/* Plain container: the `.pending-cta` button below is the SINGLE
          activation target. A button nested inside a role="button" is
          invalid ARIA + unpredictable focus order — so the card itself
          carries no role/tabIndex/onClick. */}
      <section className="top-card card-pending">
        <div className="eyebrow">
          <span className="tag-warn">Pending decisions</span>
          <span className="eyebrow-aux">live</span>
        </div>
        <div className="pending-head">
          <div className="pending-num">{pending.count}</div>
          <div className="pending-sub">
            Oldest <strong>{pending.oldest}</strong> ·{" "}
            {pending.autoResolveCount} auto-resolve &lt; 1h
          </div>
        </div>
        <ul className="pending-list">
          {pending.preview.map((item, i) => (
            <li className="pending-item" key={`${item.label}-${i}`}>
              <span className={`pi-prio ${item.priority}`}>{item.label}</span>
              <span className="pi-text">{item.text}</span>
              <span className="pi-age">{item.age}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="pending-cta"
          aria-label={`Review ${pending.count} pending decisions`}
          onClick={onSummonSpotlight}
        >
          Review all <kbd>⌘K</kbd>
        </button>
      </section>

      {/* ---- Card 2: Tokens / Hour ---- */}
      <section className="top-card card-tokens">
        <div className="eyebrow">
          <span>Tokens / hour</span>
          <span className="eyebrow-aux">7d trend</span>
        </div>
        <div className="tokens-head">
          <div className="tokens-num">{tokens.value}</div>
          <div className="tokens-unit">{tokens.unit}</div>
        </div>
        <div className={`tokens-delta${trendDown ? " neg" : ""}`}>
          {trendGlyph} {tokens.trendPct}% vs yesterday
        </div>
        {/* Intentionally aria-hidden: the sparkline is purely decorative.
            Its underlying data — value, trend %, min and peak — is already
            surfaced as text above and below it, so the chart adds no extra
            information for assistive tech. Do not add a role/label here. */}
        <svg
          className="sparkline"
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="sparkline-fill" d={spark.fill} />
          <path className="sparkline-line" d={spark.line} />
          <circle
            className="sparkline-dot"
            r={3}
            cx={spark.dotX.toFixed(2)}
            cy={spark.dotY.toFixed(2)}
          />
        </svg>
        <div className="tokens-footer">
          <span>{tokens.minLabel}</span>
          <span>{tokens.peakLabel}</span>
        </div>
      </section>

      {/* ---- Card 3: Runtime Health ---- */}
      <section className="top-card card-runtime">
        <div className="eyebrow">
          <span>Runtime health</span>
          <span className="eyebrow-aux is-signal">
            ● {healthyCount}/{runtime.length}
          </span>
        </div>
        <ul className="runtime-grid">
          {runtime.map((h) => (
            <li
              className="runtime-row"
              key={h.host}
              title={`${h.host} · ${h.status} · ${h.note}`}
              aria-label={`${h.label}: ${h.status} — ${h.note}`}
            >
              <span className={`runtime-pip ${h.status}`} aria-hidden="true" />
              <span className="runtime-host">{h.label}</span>
              <span className={`runtime-status ${h.status}`}>
                {h.note}
                {/* Visually-hidden severity so status is not color-only. */}
                <span className="visually-hidden"> ({h.status})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Three at-a-glance cards for the Fusion Option E dashboard homepage. */
export const DashboardCards = memo(DashboardCardsImpl);

export default DashboardCards;
