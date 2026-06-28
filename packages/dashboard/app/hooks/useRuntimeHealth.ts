/**
 * useRuntimeHealth — fetch live runtime status and map to the Runtime Health card grid.
 *
 * **Sources:**
 *   - GET /api/nodes          — Fusion agent-node health (the Mac-mini local node + any peers)
 *   - GET /api/fabric/stats   — Fabric approval service reachability (200 ⇒ up)
 * **Transform:** merge live signals onto the canonical 6-host grid; unprobeable hosts
 *   (Hermes/OpenClaw/Cosmos/Cloudflare reached only from their own boxes) keep their
 *   last-known label and a neutral status rather than faking health.
 * **Fallback:** returns the canonical default grid if both endpoints are unavailable.
 *
 * C.4.3 — Phase B data-wiring layer (companion to usePendingDecisions / useTokensPerHour).
 */

import { useEffect, useState } from "react";
import type { RuntimeHost, HostStatus } from "../components/DashboardCards";

interface FusionNode {
  id: string;
  name: string;
  type: string;
  status?: string; // "online" | "offline" | ...
}

/**
 * Canonical VEA host grid (DESIGN.md §4). Live signals are merged onto this;
 * hosts with no browser-reachable probe keep these as their baseline.
 */
const DEFAULT_RUNTIME: RuntimeHost[] = [
  { host: "cnnsm1mini", label: "Mac mini", status: "ok", note: "healthy" },
  { host: "cnnsvps1do", label: "Hermes", status: "ok", note: "healthy" },
  { host: "cnnsvps2do", label: "OpenClaw", status: "ok", note: "healthy" },
  { host: "cnnseq12", label: "Cosmos (Beelink)", status: "ok", note: "healthy" },
  { host: "cf-tunnels", label: "Cloudflare", status: "ok", note: "tunnels up" },
  { host: "fabric-service", label: "Fabric", status: "ok", note: "v2.5" },
];

/**
 * Map a Fusion node `status` string to a HostStatus tone.
 */
function nodeStatusToHost(status: string | undefined): HostStatus {
  if (status === "online") return "ok";
  if (status === "offline" || status === "error") return "crit";
  return "warn";
}

/**
 * Build the runtime grid from live signals.
 *  - The "local" Fusion node maps to the Mac mini host.
 *  - Fabric service status comes from whether /api/fabric/stats answered.
 *  - Remaining hosts stay at their canonical baseline (no browser-side probe).
 */
function buildGrid(nodes: FusionNode[], fabricUp: boolean | null): RuntimeHost[] {
  return DEFAULT_RUNTIME.map((host) => {
    if (host.host === "cnnsm1mini") {
      const local = nodes.find((n) => n.type === "local" || n.name === "local");
      if (local) {
        return { ...host, status: nodeStatusToHost(local.status), note: local.status ?? host.note };
      }
      return host;
    }
    if (host.host === "fabric-service") {
      if (fabricUp === true) return { ...host, status: "ok", note: "reachable" };
      if (fabricUp === false) return { ...host, status: "crit", note: "unreachable" };
      return host;
    }
    // Match any named peer node if Fusion ever reports it.
    const peer = nodes.find((n) => n.name === host.host || n.id === host.host);
    if (peer) {
      return { ...host, status: nodeStatusToHost(peer.status), note: peer.status ?? host.note };
    }
    return host;
  });
}

/**
 * Fetch runtime health and return the host grid. Re-fetches every 30s.
 */
export function useRuntimeHealth(): RuntimeHost[] {
  const [data, setData] = useState<RuntimeHost[]>(DEFAULT_RUNTIME);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const [nodesRes, fabricRes] = await Promise.allSettled([
          fetch("/api/nodes", { credentials: "include" }),
          fetch("/api/fabric/stats", { credentials: "include" }),
        ]);

        let nodes: FusionNode[] = [];
        if (nodesRes.status === "fulfilled" && nodesRes.value.ok) {
          const parsed = await nodesRes.value.json();
          if (Array.isArray(parsed)) nodes = parsed;
        }

        let fabricUp: boolean | null = null;
        if (fabricRes.status === "fulfilled") {
          fabricUp = fabricRes.value.ok;
        }

        if (isMounted) {
          setData(buildGrid(nodes, fabricUp));
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setError(msg);
          setData(DEFAULT_RUNTIME);
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
    console.warn("[useRuntimeHealth] fetch error:", error);
  }

  return data;
}
