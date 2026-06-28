import { useState, useEffect, useRef, useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import type { ThemeMode } from "@fusion/core";
import "./TopBar.css";

/**
 * TopBar — Fusion · VEA "Option E" 56px persistent top navigation bar.
 *
 * Composite design per VEA/DESIGN.md §4.1:
 *   [Fusion·VEA]  Dashboard · Agents · Knowledge Graph · Decisions · Settings
 *                 Jobs↗ · VitalOS↗ · Cosmos↗   [theme]  [Fabric N]  [⊙ tailnet]
 *
 * Presentational + nav only. Accepts the active tab + a change callback —
 * NOT wired into App.tsx (that is the A2 integration wave). Styled entirely
 * with AIME Leon Dore design tokens (var(--token)); no hardcoded colors.
 */

/** Internal Fusion view identifiers reachable from the primary nav. */
export type TopBarTab =
  | "dashboard"
  | "agents"
  | "kg"
  | "decisions"
  | "llm-ops"
  | "settings";

interface PrimaryNavItem {
  id: TopBarTab;
  label: string;
}

/** Primary internal nav tabs — order matches DESIGN.md §4.1. */
const PRIMARY_TABS: PrimaryNavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "agents", label: "Agents" },
  { id: "kg", label: "Knowledge Graph" },
  { id: "decisions", label: "Decisions" },
  { id: "llm-ops", label: "LLM Ops" },
  { id: "settings", label: "Settings" },
];

interface ExternalNavLink {
  label: string;
  href: string;
  /** When true, render a disabled <span> instead of an <a> (domain not yet provisioned). */
  disabled?: boolean;
  /** Tooltip shown on hover. */
  title: string;
}

/** External dashboard nav links — DESIGN.md §5. */
const EXTERNAL_LINKS: ExternalNavLink[] = [
  {
    label: "Jobs",
    href: "https://jobscc.anen.me",
    title: "Open Jobs Dashboard in a new tab",
  },
  {
    label: "VitalOS",
    href: "https://vitals-app.anen.me/",
    title: "Open VitalOS Dashboard in a new tab",
  },
  {
    label: "CosmosOS",
    href: "https://cosmos-app.anen.me",
    title: "Open CosmosOS Dashboard in a new tab",
  },
  // Wave-E LLM telemetry surface — served by llm_telemetry_server.py
  // on Mac loopback (8446) + Tailscale. External hostname pending DNS;
  // until then operators hit the Tailscale URL directly.
  {
    label: "LLM",
    href: "http://100.82.179.42:8446/",
    title: "Open LLM Telemetry (Wave E) in a new tab",
  },
];

const THEME_ORDER: ThemeMode[] = ["light", "dark", "system"];

export interface TopBarProps {
  /** Currently-active internal nav tab. */
  activeTab?: TopBarTab;
  /** Fired when the user selects an internal nav tab. */
  onTabChange?: (tab: TopBarTab) => void;
  /** Count of pending Fabric approvals (drives the oxblood badge). */
  fabricPendingCount?: number;
  /** Fired when the Fabric pill is clicked — summons the ⌘K spotlight. */
  onSummonFabric?: () => void;
  /** Tailnet IP shown in the right-hand status pill. */
  tailnetIp?: string;
  /** Operator initials shown in the avatar disc. */
  operatorInitials?: string;
  /** Current theme mode — when provided alongside onThemeModeChange, the toggle renders. */
  themeMode?: ThemeMode;
  /** Fired when the theme toggle cycles to the next mode. */
  onThemeModeChange?: (mode: ThemeMode) => void;
}

const THEME_ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

/** Fabric icon — small drawer/inbox glyph, drawn with currentColor. */
function FabricGlyph() {
  return (
    <svg
      className="topbar-fabric-glyph"
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="12"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M3.5 5.5h7M3.5 8.5h7"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopBar({
  activeTab = "dashboard",
  onTabChange,
  fabricPendingCount = 0,
  onSummonFabric,
  tailnetIp = "—",
  operatorInitials = "CN",
  themeMode,
  onThemeModeChange,
}: TopBarProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const handleTabClick = useCallback(
    (tab: TopBarTab) => {
      onTabChange?.(tab);
      setIsMobileNavOpen(false);
    },
    [onTabChange]
  );

  const handleThemeCycle = useCallback(() => {
    if (!themeMode || !onThemeModeChange) return;
    const idx = THEME_ORDER.indexOf(themeMode);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    onThemeModeChange(next);
  }, [themeMode, onThemeModeChange]);

  // Close the mobile nav drawer on outside click.
  useEffect(() => {
    if (!isMobileNavOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsMobileNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileNavOpen]);

  // Close the mobile nav drawer on Escape.
  useEffect(() => {
    if (!isMobileNavOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  // Drawer focus management (A2): on open, move focus into the drawer (its
  // first focusable nav control); on close, return focus to the hamburger.
  // The close-side restore is gated by a ref so the very first render —
  // which is also "closed" — does not steal focus on mount.
  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (isMobileNavOpen) {
      drawerWasOpen.current = true;
      // Defer one frame so the drawer's nav items have rendered/laid out.
      const raf = requestAnimationFrame(() => {
        const firstFocusable = navRef.current?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
    if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      hamburgerRef.current?.focus();
    }
    return undefined;
  }, [isMobileNavOpen]);

  const showThemeToggle = Boolean(themeMode && onThemeModeChange);
  const ThemeIcon = THEME_ICON[themeMode ?? "system"];

  return (
    <header className="topbar" role="banner">
      {/* --- Brand --------------------------------------------------- */}
      <div className="topbar-brand">
        <span className="topbar-brand-mark" aria-hidden="true" />
        <span className="topbar-brand-name">
          Fusion<em>·VEA</em>
        </span>
      </div>

      {/* --- Primary + external nav --------------------------------- */}
      <nav
        ref={navRef}
        className={`topbar-nav${isMobileNavOpen ? " topbar-nav--open" : ""}`}
        role="navigation"
        aria-label="Primary"
      >
        {PRIMARY_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`topbar-tab${isActive ? " topbar-tab--active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
              aria-current={isActive ? "page" : undefined}
              data-testid={`topbar-tab-${tab.id}`}
            >
              {tab.id === "dashboard" && (
                <span className="topbar-tab-dot" aria-hidden="true" />
              )}
              {tab.label}
            </button>
          );
        })}

        <span className="topbar-ext-divider" aria-hidden="true" />

        {EXTERNAL_LINKS.map((link) =>
          link.disabled ? (
            <span
              key={link.label}
              className="topbar-tab topbar-tab--external topbar-tab--disabled"
              title={link.title}
              aria-disabled="true"
              aria-label={`${link.label} — reserved, coming soon`}
              data-testid={`topbar-ext-${link.label.toLowerCase()}`}
            >
              {link.label}
              <span className="topbar-ext-glyph" aria-hidden="true">
                ↗
              </span>
            </span>
          ) : (
            <a
              key={link.label}
              className="topbar-tab topbar-tab--external"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.title}
              data-testid={`topbar-ext-${link.label.toLowerCase()}`}
            >
              {link.label}
              <span className="topbar-ext-glyph" aria-hidden="true">
                ↗
              </span>
            </a>
          )
        )}
      </nav>

      {/* --- Right cluster ------------------------------------------ */}
      <div className="topbar-right">
        {showThemeToggle && (
          <button
            type="button"
            className="topbar-theme-toggle"
            onClick={handleThemeCycle}
            title={`Theme: ${themeMode} — click to cycle`}
            aria-label={`Theme mode: ${themeMode}. Click to cycle.`}
            data-testid="topbar-theme-toggle"
          >
            <ThemeIcon size={15} />
          </button>
        )}

        <button
          type="button"
          className="topbar-fabric"
          onClick={onSummonFabric}
          aria-label={`Fabric approvals, ${fabricPendingCount} pending. Press Cmd+K to summon.`}
          data-testid="topbar-fabric-pill"
        >
          <FabricGlyph />
          <span className="topbar-fabric-label">Fabric</span>
          <span
            className="topbar-fabric-badge"
            aria-live="polite"
            data-testid="topbar-fabric-badge"
          >
            {fabricPendingCount}
          </span>
          <kbd className="topbar-kbd">⌘K</kbd>
        </button>

        <span className="topbar-tailnet" data-testid="topbar-tailnet-pill">
          <span className="topbar-tailnet-pulse" aria-hidden="true" />
          <span className="topbar-tailnet-label">tailnet · {tailnetIp}</span>
          <span
            className="topbar-avatar"
            aria-label={`Operator ${operatorInitials}`}
          >
            {operatorInitials}
          </span>
        </span>
      </div>

      {/* --- Mobile hamburger --------------------------------------- */}
      {/* Drawer focus management is handled in the isMobileNavOpen effect
          above: focus moves into the drawer on open and returns to this
          hamburger button on close (Esc / outside-click / tab select). */}
      <button
        ref={hamburgerRef}
        type="button"
        className="topbar-hamburger"
        onClick={() => setIsMobileNavOpen((prev) => !prev)}
        aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMobileNavOpen}
        data-testid="topbar-hamburger"
      >
        <span className="topbar-hamburger-bar" aria-hidden="true" />
        <span className="topbar-hamburger-bar" aria-hidden="true" />
        <span className="topbar-hamburger-bar" aria-hidden="true" />
      </button>
    </header>
  );
}

export default TopBar;
