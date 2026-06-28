/**
 * useLiveEvents — live event-stream rows for the home DashboardLowerGrid, sourced
 * from the Fabric activity log (/api/fabric/log) — real agent activity, not stubs.
 *
 * Maps fabric log rows → StreamEvent[] (ts, agent, agentLabel, message, code, status).
 * Polls every 30s; graceful [] on failure (the grid then shows its own fallback).
 */

import { useEffect, useState } from "react";
import type { StreamEvent, StreamAgent, StreamStatus } from "../components/DashboardLowerGrid";

interface FabricLogRow {
  request_id: string;
  created_at?: string;
  originating_agent?: string;
  action_type?: string;
  payload_preview?: string;
  action_line?: string;
  decision?: string | null;
  state?: string | null;
  lifecycle_state?: string | null;
}

function toAgent(a: string | undefined): StreamAgent {
  const s = (a || "").toLowerCase();
  if (s.includes("helm")) return "helm";
  if (s.includes("kairos")) return "kairos";
  if (s.includes("ogun")) return "ogun";
  return "other";
}

function toStatus(row: FabricLogRow): StreamStatus {
  const st = (row.state || row.lifecycle_state || "").toLowerCase();
  if (st.includes("resolved") || st.includes("approved") || st.includes("auto") || row.decision) return "done";
  if (st.includes("pending") || st.includes("await")) return "pending";
  return "running";
}

function hhmmss(iso: string | undefined): string {
  if (!iso) return "--:--:--";
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return "--:--:--";
  }
}

function truncate(s: string, max = 64): string {
  const c = (s || "").replace(/\s+/g, " ").trim();
  return c.length > max ? `${c.slice(0, max - 1)}…` : c;
}

function transform(rows: FabricLogRow[]): StreamEvent[] {
  return rows.slice(0, 12).map((row) => ({
    ts: hhmmss(row.created_at),
    agent: toAgent(row.originating_agent),
    agentLabel: row.originating_agent || "agent",
    message: truncate(row.action_line || row.payload_preview || `Request ${row.request_id.slice(0, 8)}`),
    code: row.action_type && row.action_type !== "other" ? row.action_type : undefined,
    status: toStatus(row),
  }));
}

export function useLiveEvents(): StreamEvent[] {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  useEffect(() => {
    let mounted = true;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/fabric/log", { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        const rows: FabricLogRow[] = Array.isArray(j.results) ? j.results : [];
        if (mounted) setEvents(transform(rows));
      } catch {
        if (mounted) setEvents([]);
      }
    };
    load();
    pollId = setInterval(load, 30000);
    return () => { mounted = false; if (pollId) clearInterval(pollId); };
  }, []);
  return events;
}
