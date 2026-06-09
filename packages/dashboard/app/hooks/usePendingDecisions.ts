/**
 * usePendingDecisions — fetch and transform Fabric stats into Pending Decisions card props.
 *
 * **Source:** GET /api/fabric/stats (relay from 100.68.214.103:8445/stats)
 * **Transform:** Extract request count, compute oldest age, build top-3 preview rows
 * **Fallback:** Returns stub data if fetch fails (graceful degradation)
 *
 * C.4.3 BLOCKER — Phase B data-wiring layer
 */

import { useEffect, useState } from "react";
import type { PendingDecisionsData, DecisionPriority, PendingDecisionItem } from "../components/DashboardCards";

interface FabricStats {
  requests?: Array<{
    id: string;
    created_at?: string;
    timestamp?: string;
    materiality?: number;
    status?: string;
    title?: string;
    action?: string;
  }>;
  pending_count?: number;
  queue_length?: number;
  resolved_count?: number;
}

/**
 * Stub/fallback data used when Fabric service is unavailable.
 * The dashboard will render sample data rather than failing.
 */
const STUB_DATA: PendingDecisionsData = {
  count: 0,
  oldest: "—",
  autoResolveCount: 0,
  preview: [],
};

/**
 * Parse an ISO 8601 timestamp and return human-readable age string.
 * Examples: "1h 12m", "23m", "2d 5h"
 */
function formatAge(timestamp: string | number | undefined): string {
  if (!timestamp) return "—";

  const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diffMs = now - ts;

  if (diffMs < 0) return "just now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ${diffHour % 24}h`;
  if (diffHour > 0) return `${diffHour}h ${diffMin % 60}m`;
  if (diffMin > 0) return `${diffMin}m`;
  return "just now";
}

/**
 * Classify a request's priority based on materiality score or status.
 * - materiality > 0.8 or status="critical" → "crit" (oxblood)
 * - materiality 0.5–0.8 or status="high" → "high" (gold)
 * - otherwise → "norm" (cream)
 */
function prioritizeRequest(req: FabricStats["requests"]?.[0]): DecisionPriority {
  if (!req) return "norm";

  const mat = req.materiality ?? 0;
  const status = req.status?.toLowerCase() ?? "";

  if (mat > 0.8 || status.includes("critical")) return "crit";
  if (mat > 0.5 || status.includes("high")) return "high";
  return "norm";
}

/**
 * Map priority to a short label ("P0", "P1", "P2", "…").
 */
function priorityLabel(p: DecisionPriority): string {
  switch (p) {
    case "crit":
      return "P0";
    case "high":
      return "P1";
    default:
      return "P2";
  }
}

/**
 * Transform Fabric stats JSON into Pending Decisions props shape.
 */
function transformStats(stats: FabricStats): PendingDecisionsData {
  if (!stats.requests || !Array.isArray(stats.requests) || stats.requests.length === 0) {
    return {
      ...STUB_DATA,
      count: stats.queue_length ?? stats.pending_count ?? 0,
    };
  }

  const requests = stats.requests;

  // Compute count
  const count = requests.length;

  // Find oldest request
  const timestamps = requests
    .map(r => {
      const ts = r.created_at || r.timestamp;
      return ts ? new Date(ts).getTime() : Date.now();
    })
    .filter(ts => ts > 0);

  const oldestTs = Math.min(...timestamps);
  const oldest = formatAge(oldestTs);

  // Compute auto-resolve count (requests with TTL < 1h remaining)
  // ← TBD: requires TTL field in Fabric stats; for now, assume 0
  const autoResolveCount = 0;

  // Build top-3 preview rows
  const preview: PendingDecisionItem[] = requests.slice(0, 3).map((req, idx) => {
    const priority = prioritizeRequest(req);
    return {
      priority,
      label: priorityLabel(priority),
      text: req.title || req.action || `Request #${req.id?.slice(0, 8)}`,
      age: formatAge(req.created_at || req.timestamp),
    };
  });

  return {
    count,
    oldest,
    autoResolveCount,
    preview,
  };
}

/**
 * Fetch Fabric stats and return Pending Decisions card props.
 * Re-fetches every 30 seconds if the API is healthy.
 */
export function usePendingDecisions(): PendingDecisionsData {
  const [data, setData] = useState<PendingDecisionsData>(STUB_DATA);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const response = await fetch("/api/fabric/stats", {
          credentials: "include", // Include auth cookie/session
        });

        if (!response.ok) {
          throw new Error(`Fabric stats returned ${response.status}`);
        }

        const stats: FabricStats = await response.json();

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
    console.warn("[usePendingDecisions] fetch error:", error);
  }

  return data;
}
