/**
 * useVeaRoster — fetch the canonical 8-agent VEA roster and map it to the
 * homepage Agent-roster panel (DashboardLowerGrid `roster` prop).
 *
 * **Source:** GET /api/vea/identities (reads config/identities.json)
 * **Transform:** Core-3 (by display_persona) + 5 domain orchestrators
 *   (by fusion_subagent_persona, shown as sub-personas under their Core-3
 *   parent_runtime) → RosterAgent[]. Renders the display persona, never the
 *   raw runtime hint (VISION §2 / B3).
 * **Fallback:** returns the built-in 8-persona default if the endpoint fails.
 *
 * SG5 / Wave AR — 8-agent roster display layer.
 */

import { useEffect, useState } from "react";
import type { RosterAgent, StreamAgent } from "../components/DashboardLowerGrid";

interface VeaIdentity {
  id: string;
  persona: string;
  kind: "core" | "domain";
  parent: string | null;
  runtime: string | null;
  graduation: string;
}

interface VeaIdentitiesResponse {
  count?: number;
  version?: number | null;
  agents?: VeaIdentity[];
}

const CORE_ACCENTS = new Set(["helm", "kairos", "ogun"]);

/** Built-in 8-persona roster — used until the live config is fetched. */
const DEFAULT_VEA_ROSTER: RosterAgent[] = [
  { glyph: "H", accent: "helm", name: "Helm", status: "ok", note: "core" },
  { glyph: "K", accent: "kairos", name: "Kairos", status: "ok", note: "core" },
  { glyph: "O", accent: "ogun", name: "Ogun", status: "ok", note: "core" },
  { glyph: "N", name: "Nexus", status: "ok", note: "↳ helm" },
  { glyph: "C", name: "Circles", status: "ok", note: "↳ ogun" },
  { glyph: "V", name: "Vitals", status: "ok", note: "↳ helm" },
  { glyph: "L", name: "Ledger", status: "ok", note: "↳ kairos" },
  { glyph: "A", name: "Atlas", status: "ok", note: "↳ ogun" },
];

/** Map a VEA identity to a homepage roster row (display persona, never runtime hint). */
function toRosterAgent(a: VeaIdentity): RosterAgent {
  const accent = CORE_ACCENTS.has(a.id) ? (a.id as StreamAgent) : undefined;
  return {
    glyph: (a.persona?.[0] ?? "?").toUpperCase(),
    accent,
    name: a.persona,
    status: "ok",
    note: a.kind === "core" ? "core" : `↳ ${a.parent ?? "?"}`,
  };
}

/**
 * Fetch the 8-agent roster from identities.json. Re-fetches every 60s
 * (the roster changes rarely; mtime hot-reload on the backend handles edits).
 */
export function useVeaRoster(): RosterAgent[] {
  const [roster, setRoster] = useState<RosterAgent[]>(DEFAULT_VEA_ROSTER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      try {
        const response = await fetch("/api/vea/identities", { credentials: "include" });
        if (!response.ok) {
          throw new Error(`identities returned ${response.status}`);
        }
        const data: VeaIdentitiesResponse = await response.json();
        const agents = Array.isArray(data.agents) ? data.agents : [];
        if (isMounted && agents.length > 0) {
          setRoster(agents.map(toRosterAgent));
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setError(msg);
          setRoster(DEFAULT_VEA_ROSTER);
        }
      }
    };

    fetchData();
    pollIntervalId = setInterval(fetchData, 60000);

    return () => {
      isMounted = false;
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, []);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[useVeaRoster] fetch error:", error);
  }

  return roster;
}
