/**
 * useActionTickerItems — fetch the Fabric activity log and map it to ActionTicker slots.
 *
 * **Source:** GET /api/fabric/log  (recent approval-fabric decisions, newest first)
 * **Transform:** Fabric log rows → ActionTickerItem[] (id, priority, title, meta, cta)
 * **Fallback:** returns [] on failure so the ActionTicker falls back to its own stub set.
 *
 * C.4.4 — Phase B data-wiring layer (companion to usePendingDecisions / useTokensPerHour /
 * useRuntimeHealth). Polls every 30s.
 */

import { useEffect, useState } from "react";
import type { ActionTickerItem, ActionTickerPriority } from "../components/ActionTicker";

interface FabricLogRow {
  request_id: string;
  created_at?: string;
  originating_agent?: string;
  action_type?: string;
  payload_preview?: string;
  action_line?: string;
  materiality_score?: number;
  threshold?: number;
  requires_approval?: boolean;
  decision?: string | null;
  state?: string | null;
  lifecycle_state?: string | null;
}

interface FabricLogResponse {
  count?: number;
  results?: FabricLogRow[];
}

/** Action types that imply a materially higher-stakes operation. */
const HIGH_STAKES_ACTIONS = new Set([
  "credential_access",
  "file_write",
  "account_create",
  "external_comm",
  "upload",
]);

/**
 * Classify a fabric log row into an ActionTicker priority bucket.
 *  - Still-pending approval gates are the most attention-worthy → crit.
 *  - High-stakes action types or above-threshold materiality → high.
 *  - Everything else → norm.
 */
function classify(row: FabricLogRow): ActionTickerPriority {
  const pending =
    row.requires_approval === true &&
    !row.decision &&
    row.state !== "resolved" &&
    row.state !== "auto_approved";
  if (pending) return "crit";

  const aboveThreshold =
    typeof row.materiality_score === "number" &&
    typeof row.threshold === "number" &&
    row.materiality_score >= row.threshold;
  if (aboveThreshold || (row.action_type && HIGH_STAKES_ACTIONS.has(row.action_type))) {
    return "high";
  }
  return "norm";
}

const PRIORITY_LABEL: Record<ActionTickerPriority, string> = {
  crit: "P0",
  high: "P1",
  norm: "P2",
};

/** Truncate a string to a readable headline length. */
function truncate(s: string, max = 72): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Human-readable state caption. */
function stateCaption(row: FabricLogRow): string {
  if (row.decision) return String(row.decision);
  return row.state ?? row.lifecycle_state ?? "pending";
}

/**
 * Transform a fabric log response into ActionTicker slots (newest first, capped at 20).
 */
function transform(resp: FabricLogResponse): ActionTickerItem[] {
  const rows = Array.isArray(resp.results) ? resp.results : [];
  return rows.slice(0, 20).map((row) => {
    const priority = classify(row);
    const title = truncate(row.action_line || row.payload_preview || `Request ${row.request_id.slice(0, 8)}`);
    const agent = row.originating_agent ?? "agent";
    return {
      id: row.request_id,
      priority,
      priorityLabel: PRIORITY_LABEL[priority],
      title,
      meta: `${agent} · `,
      metaEmphasis: stateCaption(row),
      cta: priority === "crit" ? "Review →" : "Open →",
    };
  });
}

/**
 * Fetch the Fabric activity log and return ActionTicker slots. Re-fetches every 30s.
 * Returns [] on error → ActionTicker renders its own stub set (self-contained).
 */
export function useActionTickerItems(): ActionTickerItem[] {
  const [items, setItems] = useState<ActionTickerItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const response = await fetch("/api/fabric/log", { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Fabric log returned ${response.status}`);
        }
        const resp: FabricLogResponse = await response.json();
        if (isMounted) {
          setItems(transform(resp));
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setError(msg);
          setItems([]); // let ActionTicker fall back to its stub set
        }
      }
    };

    fetchData();
    pollIntervalId = setInterval(fetchData, 30000);

    return () => {
      isMounted = false;
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, []);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[useActionTickerItems] fetch error:", error);
  }

  return items;
}
