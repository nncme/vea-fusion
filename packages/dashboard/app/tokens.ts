/**
 * Fusion Dashboard — Design Token Map (AIME Leon Dore, Option E)
 * ----------------------------------------------------------------
 * Typed mirror of the CSS custom properties declared in `app/styles.css`.
 * Canonical spec: VEA/DESIGN.md §3 (light-mode editorial palette).
 *
 * This is the A0-wave token layer. Components import typed references
 * from here instead of hardcoding hex values. Each entry maps a token
 * name to its `var(--token)` reference string so it can be dropped
 * directly into inline styles, styled-component template literals, or
 * CSS-in-JS objects:
 *
 *   import { tokens } from "./tokens";
 *   <div style={{ background: tokens.paper, color: tokens.ink }} />
 *
 * Raw literal values (for non-CSS contexts — canvas, charts, SSR) are
 * exposed via `tokenValues`. Keep BOTH in sync with `styles.css`.
 */

/** CSS `var(--token)` references — primary surface for components. */
export const tokens = {
  // --- AIME warm-neutral spine -------------------------------------
  paper: "var(--paper)",
  paper2: "var(--paper-2)",
  paper3: "var(--paper-3)",
  linen: "var(--linen)",
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  ink3: "var(--ink-3)",
  ink4: "var(--ink-4)",
  hairline: "var(--hairline)",
  underline: "var(--underline)",

  // --- One disciplined accent — deep oxblood -----------------------
  accent: "var(--accent)",
  accent2: "var(--accent-2)",
  accentSoft: "var(--accent-soft)",

  // --- Support — muted gold signal ---------------------------------
  signal: "var(--signal)",
  signalSoft: "var(--signal-soft)",

  // --- Legacy surface / text tokens (rebased onto AIME palette) ----
  bg: "var(--bg)",
  surface: "var(--surface)",
  card: "var(--card)",
  cardHover: "var(--card-hover)",
  surfaceHover: "var(--surface-hover)",
  surfaceSubtle: "var(--surface-subtle)",
  surfaceMuted: "var(--surface-muted)",
  surfaceEmphasis: "var(--surface-emphasis)",
  surfaceHoverStrong: "var(--surface-hover-strong)",
  bgSecondary: "var(--bg-secondary)",
  bgTertiary: "var(--bg-tertiary)",
  border: "var(--border)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-dim)",

  // --- Typography --------------------------------------------------
  fontSans: "var(--font-sans)",
  fontDisplay: "var(--font-display)",
  fontPrimary: "var(--font-primary)",
  fontMono: "var(--font-mono)",

  // --- Spacing — semantic scale ------------------------------------
  spaceXs: "var(--space-xs)",
  spaceSm: "var(--space-sm)",
  spaceMd: "var(--space-md)",
  spaceLg: "var(--space-lg)",
  spaceXl: "var(--space-xl)",
  space2xl: "var(--space-2xl)",

  // --- Spacing — AIME 4pt grid -------------------------------------
  s1: "var(--s1)",
  s2: "var(--s2)",
  s3: "var(--s3)",
  s4: "var(--s4)",
  s5: "var(--s5)",
  s6: "var(--s6)",
  s7: "var(--s7)",
  s8: "var(--s8)",
  s9: "var(--s9)",

  // --- Radii -------------------------------------------------------
  radiusSm: "var(--radius-sm)",
  radiusMd: "var(--radius-md)",
  radiusLg: "var(--radius-lg)",
  radiusXl: "var(--radius-xl)",
  radiusPill: "var(--radius-pill)",
  radius: "var(--radius)",
  rSm: "var(--r-sm)",
  r: "var(--r)",
  rLg: "var(--r-lg)",
  rPill: "var(--r-pill)",

  // --- Layout ------------------------------------------------------
  max: "var(--max)",
  headerHeight: "var(--header-height)",

  // --- Shadows -----------------------------------------------------
  shadowSm: "var(--shadow-sm)",
  shadowMd: "var(--shadow-md)",
  shadowLg: "var(--shadow-lg)",
  shadow: "var(--shadow)",
  shadowSoft: "var(--shadow-soft)",
  shadowCard: "var(--shadow-card)",
  shadowGlow: "var(--shadow-glow)",
  focusRing: "var(--focus-ring)",
  focusRingStrong: "var(--focus-ring-strong)",

  // --- Transitions -------------------------------------------------
  transitionInstant: "var(--transition-instant)",
  transitionFast: "var(--transition-fast)",
  transitionNormal: "var(--transition-normal)",
  transitionSlow: "var(--transition-slow)",

  // --- Legacy token aliases → AIME spine (A0.1) --------------------
  // Typed mirrors of the `:root` alias block in styles.css. Components
  // still referencing legacy token names resolve through these onto
  // the canonical AIME palette — no off-palette literal is reachable.
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textTertiary: "var(--text-tertiary)",
  textAccent: "var(--text-accent)",
  textOnAccent: "var(--text-on-accent)",
  bgPrimary: "var(--bg-primary)",
  bgSurface: "var(--bg-surface)",
  bgCard: "var(--bg-card)",
  bgElevated: "var(--bg-elevated)",
  bgHover: "var(--bg-hover)",
  surfaceDimmed: "var(--surface-dimmed)",
  surfaceElevated: "var(--surface-elevated)",
  borderColor: "var(--border-color)",
  borderSubtle: "var(--border-subtle)",
  accentColor: "var(--accent-color)",
} as const;

/**
 * Raw literal token values — for non-CSS rendering contexts where a
 * `var(--token)` string is not resolvable (SVG/canvas fills, chart
 * libraries, SSR colour math). Mirror of the values in `styles.css`.
 */
export const tokenValues = {
  // AIME warm-neutral spine
  paper: "#f3eee5",
  paper2: "#ece5d7",
  paper3: "#e0d6c2",
  linen: "#f8f4ec",
  ink: "#1c1a17",
  ink2: "#3a352e",
  ink3: "#6e6457",
  ink4: "#a59783",
  underline: "rgba(28, 26, 23, 0.14)",

  // One disciplined accent — deep oxblood
  accent: "#6b1d20",
  accent2: "#8a2a2e",
  accentSoft: "#f0d9da",

  // Support — muted gold signal
  signal: "#8a6b2a",
  signalSoft: "#ece1c1",

  // Typography
  fontSans:
    '"Söhne", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontDisplay: '"GT Sectra", "Newsreader", Georgia, "Times New Roman", serif',
  fontMono:
    '"JetBrains Mono", ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',

  // AIME 4pt grid (px)
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
  s9: 96,

  // Radii (px)
  rSm: 6,
  r: 10,
  rLg: 18,
  rPill: 999,

  // Layout
  max: 1320,
  headerHeight: 57,

  // Shadows — tinted to warm ink, never neutral black
  shadowSoft:
    "0 1px 0 rgba(28, 26, 23, 0.04), 0 12px 32px -18px rgba(28, 26, 23, 0.18)",
  shadowCard:
    "0 1px 0 rgba(28, 26, 23, 0.05), 0 24px 56px -28px rgba(28, 26, 23, 0.28)",
} as const;

/** Token reference key (e.g. `"paper"`, `"accent"`). */
export type TokenName = keyof typeof tokens;

/** Raw literal token value key. */
export type TokenValueName = keyof typeof tokenValues;

export default tokens;
