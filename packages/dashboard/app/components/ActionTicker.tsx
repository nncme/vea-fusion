/**
 * ActionTicker — Option E 44px persistent action bar.
 * --------------------------------------------------------------------
 * Canonical spec: VEA/DESIGN.md §4.2.
 * Visual reference: VEA/tasks/2026-05-19-fusion-fabric-designs/option-E-composite.html
 *
 * A 5-slot horizontally-rotating ticker that surfaces recent agent /
 * task / decision activity as ambient awareness below the top bar.
 *
 *   - 5s rotation interval, fade + translateY slot transition
 *   - Pause on hover, plus an explicit pause toggle (visible on hover)
 *   - Dot progress indicator for the current slot
 *   - Mobile <880px collapses to a "Fabric · N" pill
 *   - prefers-reduced-motion: rotation transition is neutralised in CSS
 *
 * This is a presentational component (A1.2 wave). It renders stub
 * sample data when no `items` prop is supplied — live data binding and
 * wiring into the app shell are deferred to the A2 wave.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "./ActionTicker.css";

/** Priority bucket for a ticker item. Drives the P-chip colour. */
export type ActionTickerPriority = "crit" | "high" | "norm";

/** A single rotating slot in the action ticker. */
export interface ActionTickerItem {
  /** Stable identity for the slot (used as React key). */
  id: string;
  /** Priority bucket — controls chip colour. */
  priority: ActionTickerPriority;
  /** Short priority label rendered inside the chip, e.g. "P0". */
  priorityLabel: string;
  /** Primary headline for the activity. */
  title: string;
  /** Mono caption — typically "<agent> · <state>". */
  meta: string;
  /**
   * Optional emphasised tail appended to `meta` in the accent colour
   * (e.g. a countdown "47min" or "manual gate").
   */
  metaEmphasis?: string;
  /** Mono call-to-action label, e.g. "Review →". */
  cta: string;
}

export interface ActionTickerProps {
  /**
   * Rotating slots. When omitted, a representative 5-item stub set is
   * rendered so the component is self-contained for preview / tests.
   */
  items?: ActionTickerItem[];
  /** Rotation interval in ms. Defaults to 5000 (DESIGN.md §4.2). */
  intervalMs?: number;
  /**
   * Invoked when a ticker item (or the mobile badge) is activated.
   * In the A2 wave this summons the ⌘K Fabric spotlight.
   */
  onItemActivate?: (item: ActionTickerItem) => void;
}

/** Representative stub data — mirrors option-E-composite.html. */
const STUB_ITEMS: ActionTickerItem[] = [
  {
    id: "stub-bcg",
    priority: "crit",
    priorityLabel: "P0",
    title: "BCG Senior Director — counter-offer email pending",
    meta: "helm · ",
    metaEmphasis: "manual gate",
    cta: "Open →",
  },
  {
    id: "stub-openclaw",
    priority: "high",
    priorityLabel: "P1",
    title: "OpenClaw force-push to main · no CI gate",
    meta: "ogun · auto-resolves in ",
    metaEmphasis: "never",
    cta: "Review →",
  },
  {
    id: "stub-polymarket",
    priority: "high",
    priorityLabel: "P1",
    title: "Polymarket exposure 11.2% — trim to 8% requested",
    meta: "kairos · auto-resolves in ",
    metaEmphasis: "47min",
    cta: "Approve →",
  },
  {
    id: "stub-accenture",
    priority: "norm",
    priorityLabel: "P2",
    title: "4 Accenture cohort follow-ons — auto-submit queued",
    meta: "helm · resolves in ",
    metaEmphasis: "2h 14m",
    cta: "Review →",
  },
  {
    id: "stub-notebooklm",
    priority: "norm",
    priorityLabel: "P3",
    title: "NotebookLM daily brief — audio rendered, ready",
    meta: "kairos · auto-resolved 14:02",
    cta: "Listen →",
  },
];

const PRIORITY_CLASS: Record<ActionTickerPriority, string> = {
  crit: "action-ticker__prio--crit",
  high: "action-ticker__prio--high",
  norm: "action-ticker__prio--norm",
};

export function ActionTicker({
  items,
  intervalMs = 5000,
  onItemActivate,
}: ActionTickerProps) {
  const slots = items && items.length > 0 ? items : STUB_ITEMS;

  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [buttonPaused, setButtonPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Keep the active index valid if the `items` prop changes length.
  useEffect(() => {
    setActiveIdx((idx) => (idx < slots.length ? idx : 0));
  }, [slots.length]);

  // Honour prefers-reduced-motion: when set, auto-rotation is treated as
  // an additional pause source so the first slot stays static. The pause
  // toggle still lets the user step manually.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const paused = hoverPaused || buttonPaused || reducedMotion;

  // Auto-rotation. A timer ref guarantees a single live interval and a
  // clean teardown across re-renders / prop changes.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || slots.length <= 1) {
      return;
    }
    timerRef.current = setInterval(() => {
      setActiveIdx((idx) => (idx + 1) % slots.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, slots.length, intervalMs]);

  const handleActivate = useCallback(
    (item: ActionTickerItem) => {
      onItemActivate?.(item);
    },
    [onItemActivate],
  );

  const togglePause = useCallback(() => {
    setButtonPaused((p) => !p);
  }, []);

  return (
    <div
      className="action-ticker"
      role="region"
      aria-label="Pending approvals ticker"
    >
      <div className="action-ticker__label">
        <span className="action-ticker__live-dot" aria-hidden="true" />
        <span>Fabric · live</span>
      </div>

      {/* Dedicated live region — announces only the active item's title,
          not the full button text, to avoid screen-reader spam. */}
      <span className="action-ticker__sr-live" aria-live="polite">
        {slots[activeIdx].title}
      </span>

      <div
        className="action-ticker__rail"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        {slots.map((item, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              type="button"
              key={item.id}
              className={`action-ticker__item${isActive ? " is-active" : ""}`}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleActivate(item)}
            >
              <span
                className={`action-ticker__prio ${PRIORITY_CLASS[item.priority]}`}
              >
                {item.priorityLabel}
              </span>
              <span className="action-ticker__title">{item.title}</span>
              <span className="action-ticker__meta">
                {item.meta}
                {item.metaEmphasis ? <strong>{item.metaEmphasis}</strong> : null}
              </span>
              <span className="action-ticker__cta">{item.cta}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="action-ticker__mobile-badge"
        aria-label={`${slots.length} pending approvals`}
        onClick={() => handleActivate(slots[activeIdx])}
      >
        <span className="action-ticker__mobile-dot" aria-hidden="true">
          ●
        </span>
        Fabric · {slots.length}
      </button>

      <div className="action-ticker__controls">
        <div className="action-ticker__dots" aria-hidden="true">
          {slots.map((item, i) => (
            <span
              key={item.id}
              className={`action-ticker__dot${i === activeIdx ? " is-active" : ""}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={`action-ticker__pause${buttonPaused ? " is-paused" : ""}`}
          aria-pressed={buttonPaused}
          aria-label={
            buttonPaused ? "Resume ticker rotation" : "Pause ticker rotation"
          }
          onClick={togglePause}
        >
          <span className="action-ticker__pause-bars" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </div>
    </div>
  );
}

export default ActionTicker;
