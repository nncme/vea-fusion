/**
 * DashboardLowerGrid — the Option E composite homepage LOWER section
 * (DESIGN.md §1 "Layer 3" / option-E-composite.html `.lower-grid`).
 *
 * Sits below the three at-a-glance DashboardCards and fills the lower half
 * of the homepage so it reads as a complete composition rather than a
 * top-heavy stack. Composes:
 *
 *   1. Live event stream — timestamped agent-activity rows
 *   2. Agent roster      — per-agent status pips
 *   3. Footer strip      — Fabric / Cosmos-auth / mode ambient status line
 *
 * Presentational + props-driven with believable stub defaults. Live data
 * binding is a deferred wave — this component renders sample data only and
 * is NOT wired to any endpoint.
 *
 * Styled entirely with the AIME Leon Dore design tokens declared in
 * app/styles.css — no hardcoded hex.
 */

import { memo } from "react";
import "./DashboardLowerGrid.css";

/* ----------------------------------------------------------------- *
 * Types
 * ----------------------------------------------------------------- */

/** Known agent identities — drives the discrete label/glyph colour. */
export type StreamAgent = "helm" | "kairos" | "ogun" | "other";

/** Terminal state of a stream row — drives the status-text colour. */
export type StreamStatus = "done" | "running" | "pending";

/** A single live-event-stream row. */
export interface StreamEvent {
  /** Monospace timestamp, e.g. `"18:41:52"`. */
  ts: string;
  /** Originating agent — drives the `who` chip colour. */
  agent: StreamAgent;
  /** Display name for the `who` chip, e.g. `"kairos"`. */
  agentLabel: string;
  /** Human-readable event summary. */
  message: string;
  /** Optional inline code token rendered after the message. */
  code?: string;
  /** Terminal status — drives the right-aligned status pill colour. */
  status: StreamStatus;
}

/** Health state for an agent-roster row. */
export type RosterStatus = "ok" | "warn";

/** A single agent-roster row. */
export interface RosterAgent {
  /** Single-letter glyph initial, e.g. `"H"`. */
  glyph: string;
  /** Optional named accent for the glyph (helm/kairos/ogun). */
  accent?: StreamAgent;
  /** Display name, e.g. `"Helm"`. */
  name: string;
  /** Health status — drives the status-text colour. */
  status: RosterStatus;
  /** Short status note, e.g. `"running"` / `"submitting"`. */
  note: string;
}

/** A single key/value pair in the footer status strip. */
export interface FooterStat {
  /** Uppercase caption, e.g. `"Fabric"`. */
  label: string;
  /** Value text, e.g. `"connected"`. */
  value: string;
  /** Optional accent for the value — `"signal"` gold or `"accent"` oxblood. */
  tone?: "signal" | "accent";
}

export interface DashboardLowerGridProps {
  /** Live event-stream rows (newest first). */
  events?: StreamEvent[];
  /** Agent-roster rows. */
  roster?: RosterAgent[];
  /** Footer status-strip key/value pairs. */
  footer?: FooterStat[];
  /** Invoked when "View all" / "All →" panel links are activated. */
  onViewAll?: () => void;
}

/* ----------------------------------------------------------------- *
 * Stub / sample defaults (believable sample data — no live wiring)
 * ----------------------------------------------------------------- */

const DEFAULT_EVENTS: StreamEvent[] = [
  {
    ts: "18:41:52",
    agent: "kairos",
    agentLabel: "kairos",
    message: "Threshold check complete · drift 2.3% below band",
    code: "portfolio-rebalance.py",
    status: "done",
  },
  {
    ts: "18:40:14",
    agent: "helm",
    agentLabel: "helm",
    message: "Submitted Accenture R00325841 · ATS prefilled · awaiting human Submit",
    status: "pending",
  },
  {
    ts: "18:38:09",
    agent: "ogun",
    agentLabel: "ogun",
    message: "OpenClaw build #847 passed harness · 12 tests · forging artifact",
    status: "done",
  },
  {
    ts: "18:36:41",
    agent: "helm",
    agentLabel: "helm",
    message: "Scan wave B complete · 4 high-confidence roles surfaced",
    status: "done",
  },
  {
    ts: "18:34:22",
    agent: "kairos",
    agentLabel: "kairos",
    message: "Vault sync · 1,247 entries reconciled · 0 conflicts",
    status: "done",
  },
  {
    ts: "18:32:18",
    agent: "ogun",
    agentLabel: "ogun",
    message: "Iron-forge nightly · OpenClaw self-eval queued · 30K token budget",
    status: "running",
  },
];

const DEFAULT_ROSTER: RosterAgent[] = [
  { glyph: "H", accent: "helm", name: "Helm", status: "ok", note: "running" },
  { glyph: "K", accent: "kairos", name: "Kairos", status: "ok", note: "running" },
  { glyph: "O", accent: "ogun", name: "Ogun", status: "warn", note: "submitting" },
  { glyph: "N", name: "Nexus", status: "ok", note: "idle" },
  { glyph: "V", name: "Vitals", status: "ok", note: "idle" },
];

const DEFAULT_FOOTER: FooterStat[] = [
  { label: "Fabric", value: "connected", tone: "signal" },
  { label: "Cosmos auth", value: "valid 6d 14h", tone: "signal" },
  { label: "Mode", value: "Ambient · Fabric on demand" },
];

/** Maps a stream status to its display label + CSS modifier. */
const STATUS_META: Record<StreamStatus, { text: string; mod: string }> = {
  done: { text: "done", mod: "done" },
  running: { text: "running", mod: "run" },
  pending: { text: "pending", mod: "run" },
};

/* ----------------------------------------------------------------- *
 * Component
 * ----------------------------------------------------------------- */

function DashboardLowerGridImpl({
  events = DEFAULT_EVENTS,
  roster = DEFAULT_ROSTER,
  footer = DEFAULT_FOOTER,
  onViewAll,
}: DashboardLowerGridProps) {
  return (
    <div className="lower-grid">
      {/* ---- Panel: Live event stream ---- */}
      <section className="panel panel-stream" aria-label="Live event stream">
        <div className="panel-head">
          <span className="panel-eyebrow">Live event stream</span>
          <button type="button" className="panel-link" onClick={onViewAll}>
            View all
          </button>
        </div>
        <ul className="stream-list">
          {events.map((ev, i) => {
            const status = STATUS_META[ev.status];
            return (
              <li className="stream-row" key={`${ev.ts}-${i}`}>
                <span className="ts">{ev.ts}</span>
                <span className={`who ${ev.agent}`}>{ev.agentLabel}</span>
                <span className="msg">
                  {ev.message}
                  {ev.code ? (
                    <>
                      {" · "}
                      <code>{ev.code}</code>
                    </>
                  ) : null}
                </span>
                <span className={`status ${status.mod}`}>{status.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Panel: Agent roster ---- */}
      <section className="panel panel-roster" aria-label="Agent roster">
        <div className="panel-head">
          <span className="panel-eyebrow">Agent roster</span>
          <button type="button" className="panel-link" onClick={onViewAll}>
            All &rarr;
          </button>
        </div>
        <ul className="roster-list">
          {roster.map((a) => (
            <li className="agent-row" key={a.name}>
              <span
                className={`agent-glyph${a.accent ? ` ${a.accent}` : ""}`}
                aria-hidden="true"
              >
                {a.glyph}
              </span>
              <span className="agent-name">{a.name}</span>
              <span className={`agent-status ${a.status}`}>
                <span className="agent-status-dot" aria-hidden="true">
                  &#9679;
                </span>{" "}
                {a.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Footer status strip (spans both columns) ---- */}
      <div className="footer-strip">
        <div className="label-pair">
          {footer.map((stat) => (
            <div className="footer-stat" key={stat.label}>
              <span className="lbl">{stat.label}:</span>
              <span className={`val${stat.tone ? ` ${stat.tone}` : ""}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
        <div className="footer-hint">
          Press <kbd>&#8984;K</kbd> anywhere to summon Fabric
        </div>
      </div>
    </div>
  );
}

/** The Option E composite homepage lower section (event stream + roster). */
export const DashboardLowerGrid = memo(DashboardLowerGridImpl);

export default DashboardLowerGrid;
