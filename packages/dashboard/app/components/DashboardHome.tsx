/**
 * DashboardHome — the Option E composite homepage (DESIGN.md §4.3 / §2).
 *
 * An ADDITIVE landing surface that composes the three A1 homepage cards
 * (DashboardCards) under the persistent ActionTicker. It does NOT replace
 * any existing Fusion view — the TopBar + SpotlightOverlay that frame it
 * are mounted by App.tsx and persist across every Fusion view.
 *
 * Presentational; props-driven. Live data binding is a deferred wave —
 * App.tsx currently passes derived/stub values (see DESIGN.md §7).
 */

import { DashboardCards } from "./DashboardCards";
import type { DashboardCardsProps } from "./DashboardCards";
import { SpotlightSummonChip } from "./SpotlightOverlay";
import "./DashboardHome.css";

export interface DashboardHomeProps {
  /** Pending Decisions card data (forwarded to DashboardCards). */
  pending?: DashboardCardsProps["pending"];
  /** Tokens / Hour card data (forwarded to DashboardCards). */
  tokens?: DashboardCardsProps["tokens"];
  /** Runtime Health host list (forwarded to DashboardCards). */
  runtime?: DashboardCardsProps["runtime"];
  /** Summons the ⌘K Fabric spotlight — wired from the Pending card + chip. */
  onSummonSpotlight?: () => void;
}

/** The Option E composite homepage body (rendered below the ActionTicker). */
export function DashboardHome({
  pending,
  tokens,
  runtime,
  onSummonSpotlight,
}: DashboardHomeProps) {
  return (
    <main className="dashboard-home" aria-label="VEA dashboard overview">
      <header className="dashboard-home__masthead">
        <div>
          <p className="dashboard-home__eyebrow">VEA · Fusion control surface</p>
          <h1 className="dashboard-home__title">Today at a glance</h1>
        </div>
        <SpotlightSummonChip onSummon={onSummonSpotlight} />
      </header>
      <DashboardCards
        pending={pending}
        tokens={tokens}
        runtime={runtime}
        onSummonSpotlight={onSummonSpotlight}
      />
    </main>
  );
}

export default DashboardHome;
