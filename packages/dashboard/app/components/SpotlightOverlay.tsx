import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Command, Layers, Zap, ArrowUpRight } from "lucide-react";
import "./SpotlightOverlay.css";

/**
 * SpotlightOverlay — the ⌘K Cinematic Fabric Spotlight (DESIGN.md §4.4).
 *
 * Option-E composite: Option-D's Cmd+K spotlight base + the summon-chip
 * pattern + Option-C's "Open Fabric in Full Detail ↗" escape affordance.
 *
 * Self-manages the ⌘K hotkey when uncontrolled; can also be driven by an
 * `open`/`onClose` prop pair (e.g. when the topbar Fabric pill summons it).
 * Live Fabric data is a deferred wave — entries here are sample stubs.
 */

type SpotlightKind = "command" | "workspace" | "fabric";

interface SpotlightEntry {
  id: string;
  kind: SpotlightKind;
  title: string;
  sub: string;
  /** Short meta chip text (e.g. "P0", "HEALTHY", "↵"). */
  meta?: string;
  /** Meta chip palette: oxblood accent (default), gold signal, or muted. */
  metaTone?: "accent" | "signal" | "muted";
}

interface SpotlightOverlayProps {
  /** Controlled-open flag. Omit to let the component self-manage ⌘K state. */
  open?: boolean;
  /** Called when the overlay requests dismissal (Esc, backdrop, selection). */
  onClose?: () => void;
  /** Invoked when a result is activated (Enter / click). */
  onSelect?: (entry: SpotlightEntry) => void;
  /** Invoked when "Open Fabric in Full Detail" is activated. */
  onOpenFabric?: () => void;
}

/** Sample stub entries — live Fabric data lands in a deferred wave. */
const SAMPLE_ENTRIES: SpotlightEntry[] = [
  {
    id: "fab-1",
    kind: "fabric",
    title: "Send BCG Senior Director counter-offer email",
    sub: "helm · Wave 1 / Offer-Review · 1h 12m ago",
    meta: "P0",
    metaTone: "accent",
  },
  {
    id: "fab-2",
    kind: "fabric",
    title: "Force-push to main on nncme/openclaw-harness",
    sub: "ogun · Wave 2 / Phase 3 · 47m ago",
    meta: "HIGH",
    metaTone: "accent",
  },
  {
    id: "fab-3",
    kind: "fabric",
    title: "Rebalance Polymarket exposure: trim ELECTION-2028 to 8%",
    sub: "kairos · Threshold guard · 22m ago",
    meta: "MED",
    metaTone: "muted",
  },
  {
    id: "ws-1",
    kind: "workspace",
    title: "job-applications",
    sub: "Jump to workspace · feat/option-e",
    meta: "WS",
    metaTone: "muted",
  },
  {
    id: "ws-2",
    kind: "workspace",
    title: "jasp-validation-studio-saas",
    sub: "Jump to workspace · main",
    meta: "WS",
    metaTone: "muted",
  },
  {
    id: "cmd-1",
    kind: "command",
    title: "Review all pending approvals",
    sub: "Command · open the Fabric queue",
    meta: "↵",
    metaTone: "muted",
  },
  {
    id: "cmd-2",
    kind: "command",
    title: "Runtime health check",
    sub: "Command · ping all 6 hosts",
    meta: "OK",
    metaTone: "signal",
  },
];

const KIND_ICON: Record<SpotlightKind, typeof Zap> = {
  fabric: Zap,
  workspace: Layers,
  command: Command,
};

const KIND_LABEL: Record<SpotlightKind, string> = {
  fabric: "Fabric Approvals",
  workspace: "Workspaces",
  command: "Commands",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

export function SpotlightOverlay({
  open: controlledOpen,
  onClose,
  onSelect,
  onOpenFabric,
}: SpotlightOverlayProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);

  const scrimRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Element that held focus before the overlay opened — restored on close. */
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  /** True once a genuine open has happened — gates the close-side focus restore. */
  const wasOpen = useRef(false);

  const close = useCallback(() => {
    if (!isControlled) {
      setInternalOpen(false);
    }
    onClose?.();
  }, [isControlled, onClose]);

  // --- Global ⌘K / Ctrl+K summon listener -------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isControlled) {
          // Controlled: only the owner can open; toggling closes.
          if (controlledOpen) {
            event.preventDefault();
            close();
          }
          // Controlled-and-closed: no-op — don't swallow the keystroke.
        } else {
          event.preventDefault();
          setInternalOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isControlled, controlledOpen, close]);

  // --- Filtered results --------------------------------------------------
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return SAMPLE_ENTRIES;
    }
    return SAMPLE_ENTRIES.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.sub.toLowerCase().includes(q),
    );
  }, [query]);

  /** Grouped for section labels — preserves the result ordering. */
  const grouped = useMemo(() => {
    const order: SpotlightKind[] = ["fabric", "workspace", "command"];
    return order
      .map((kind) => ({
        kind,
        items: results.filter((entry) => entry.kind === kind),
      }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  /** Total navigable rows = results + the "Open Fabric" footer row. */
  const navCount = results.length + 1;
  const fullViewIndex = results.length;

  // --- Reset transient state on open ------------------------------------
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setQuery("");
      setFocusedIndex(0);
      // Defer to let the panel mount before focusing the input.
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    // Restore focus to the summoning element — only after a real open→close.
    if (wasOpen.current) {
      wasOpen.current = false;
      restoreFocusRef.current?.focus();
    }
    return undefined;
  }, [isOpen]);

  // Keep the focused index in range when the result set shrinks.
  useEffect(() => {
    setFocusedIndex((prev) => Math.min(prev, Math.max(navCount - 1, 0)));
  }, [navCount]);

  const activate = useCallback(
    (index: number) => {
      if (index === fullViewIndex) {
        onOpenFabric?.();
        close();
        return;
      }
      const entry = results[index];
      if (entry) {
        onSelect?.(entry);
        close();
      }
    },
    [fullViewIndex, results, onOpenFabric, onSelect, close],
  );

  // --- Keyboard navigation + focus trap (panel-scoped) ------------------
  const onPanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % navCount);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + navCount) % navCount);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        activate(focusedIndex);
        return;
      }
      // Focus trap — keep Tab cycling inside the panel.
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) {
          return;
        }
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(
          (el) =>
            el.getClientRects().length > 0 || el === document.activeElement,
        );
        if (focusables.length === 0) {
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [close, navCount, activate, focusedIndex],
  );

  if (!isOpen) {
    return null;
  }

  // Running index across groups so section breaks don't desync nav.
  let flatIndex = -1;

  return (
    <div
      ref={scrimRef}
      className="spotlight-scrim"
      role="presentation"
      onMouseDown={(event) => {
        // Backdrop click — dismiss only when the scrim itself is the target.
        if (event.target === scrimRef.current) {
          close();
        }
      }}
    >
      <div
        ref={panelRef}
        className="spotlight"
        role="dialog"
        aria-modal="true"
        aria-label="Fabric command spotlight"
        onKeyDown={onPanelKeyDown}
      >
        {/* Search row */}
        <div className="spotlight-search">
          <Search size={18} className="spotlight-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setFocusedIndex(0);
            }}
            placeholder="Search approvals, jump to a workspace, or type a command…"
            aria-label="Search Fabric, workspaces, and commands"
            aria-controls="spotlight-results"
          />
          <span className="spotlight-escape-hint" aria-hidden="true">
            esc
          </span>
        </div>

        {/* Results */}
        <div
          className="spotlight-body"
          id="spotlight-results"
          role="listbox"
          aria-label="Spotlight results"
        >
          {results.length === 0 ? (
            <div className="spotlight-empty">No matches for “{query}”.</div>
          ) : (
            grouped.map((group) => {
              const GroupIcon = KIND_ICON[group.kind];
              return (
                <div key={group.kind}>
                  <div className="spotlight-section-label">
                    {KIND_LABEL[group.kind]}
                  </div>
                  {group.items.map((entry) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const isFocused = index === focusedIndex;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={isFocused}
                        className={`spotlight-result${isFocused ? " is-focused" : ""}`}
                        onMouseEnter={() => setFocusedIndex(index)}
                        onClick={() => activate(index)}
                      >
                        <GroupIcon
                          size={16}
                          className="spotlight-result-icon"
                          aria-hidden="true"
                        />
                        <span className="spotlight-result-text">
                          <span className="spotlight-result-title">
                            {entry.title}
                          </span>
                          <span className="spotlight-result-sub">
                            {entry.sub}
                          </span>
                        </span>
                        {entry.meta ? (
                          <span
                            className={`spotlight-result-meta${
                              entry.metaTone === "signal"
                                ? " is-signal"
                                : entry.metaTone === "muted"
                                  ? " is-muted"
                                  : ""
                            }`}
                          >
                            {entry.meta}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* "Open Fabric in Full Detail ↗" — Option-C escape affordance. */}
          <button
            type="button"
            role="option"
            aria-selected={focusedIndex === fullViewIndex}
            className={`spotlight-fullview${
              focusedIndex === fullViewIndex ? " is-focused" : ""
            }`}
            onMouseEnter={() => setFocusedIndex(fullViewIndex)}
            onClick={() => activate(fullViewIndex)}
          >
            <span>
              <span className="spotlight-fullview-title">
                Open Fabric in Full Detail
              </span>
              <span className="spotlight-fullview-sub">
                Dedicated route · history · filters · audit log
              </span>
            </span>
            <span className="spotlight-fullview-cta">
              Maximize
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
          </button>
        </div>

        {/* Footer legend */}
        <div className="spotlight-footer">
          <div className="spotlight-footer-legend">
            <span>
              <kbd>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd>↵</kbd> Select
            </span>
            <span>
              <kbd>esc</kbd> Dismiss
            </span>
          </div>
          <div className="spotlight-footer-status">
            {results.length} result{results.length === 1 ? "" : "s"} · ⌘K to
            summon anywhere
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SpotlightSummonChip — the small "Press ⌘K to summon Fabric" affordance
 * (DESIGN.md summon-chip pattern). Stateless; the host wires `onSummon`.
 */
export function SpotlightSummonChip({ onSummon }: { onSummon?: () => void }) {
  return (
    <button
      type="button"
      className="spotlight-chip"
      onClick={onSummon}
      aria-label="Summon the Fabric spotlight"
    >
      Press <kbd>⌘K</kbd> anywhere to summon Fabric
    </button>
  );
}

export default SpotlightOverlay;
export type { SpotlightEntry, SpotlightOverlayProps };
