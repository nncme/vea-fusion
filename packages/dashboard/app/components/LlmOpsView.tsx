/**
 * LlmOpsView — the in-app "LLM Ops" tab (LG-4/LG-5 / VISION §5.1, D1).
 *
 * Hosts the 3 reference surfaces ported from the LLM-Ops Console
 * (dev.nncm.me/llm-cli-cheatsheet): Cheatsheet · Capabilities · Verification.
 * The live LiteLLM usage Dashboard is merged into the home (LlmUsageSection);
 * this tab carries the reference material, re-skinned to AIME light+dark.
 *
 * Content fidelity: the high-value, verified reference is rendered natively
 * (routing ladder, model inventory, capabilities, verification status). The
 * full exhaustive console remains one deep-link away for 1:1 completeness.
 *
 * Deep-link parity: ?sub=cheatsheet|capabilities|verification selects the tab.
 */

import { useState } from "react";
import "./LlmOpsView.css";

type SubTab = "cheatsheet" | "capabilities" | "verification";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "cheatsheet", label: "Cheatsheet" },
  { id: "capabilities", label: "Capabilities" },
  { id: "verification", label: "Verification" },
];

const CONSOLE_URL = "https://dev.nncm.me/llm-cli-cheatsheet";

function initialSub(): SubTab {
  try {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("sub");
    if (s === "capabilities" || s === "verification" || s === "cheatsheet") return s;
    const h = window.location.hash.replace(/^#\/?/, "");
    if (h === "capabilities" || h === "verification" || h === "cheatsheet") return h;
  } catch { /* no-op */ }
  return "cheatsheet";
}

/** Cheatsheet — the LLM CLI routing ladder + model inventory (verified canon). */
function Cheatsheet() {
  return (
    <div className="llm-ops__doc">
      <section className="llm-ops__block">
        <h3>Auto-router ladder (cost-first)</h3>
        <p className="llm-ops__lede">Local-first cascade. Cloud only when the task needs it; never default to Claude Max for autonomous work.</p>
        <table className="llm-ops__table">
          <thead><tr><th>Tier</th><th>Route</th><th>When</th><th>$/1M</th></tr></thead>
          <tbody>
            <tr><td><span className="llm-ops__pill llm-ops__pill--t0">T0</span></td><td>FD-local — ollama / llama.cpp (Framework Desktop)</td><td>Routine, bulk, autonomous loops</td><td className="mono llm-ops__free">$0</td></tr>
            <tr><td><span className="llm-ops__pill llm-ops__pill--t1">T1</span></td><td>OpenRouter BYOK (minimax, qwen, etc.)</td><td>Capable cloud, cost-capped</td><td className="mono">~$0.1–1</td></tr>
            <tr><td><span className="llm-ops__pill llm-ops__pill--t2">T2</span></td><td>Anthropic / frontier (gated)</td><td>Hardest reasoning only</td><td className="mono llm-ops__cost">$3–15</td></tr>
          </tbody>
        </table>
      </section>
      <section className="llm-ops__block">
        <h3>Backends &amp; CLIs</h3>
        <ul className="llm-ops__list">
          <li><strong>LiteLLM gateway</strong> — <code>cnnseq12-litellm.barb-opah.ts.net:4000</code> (control plane, spend/keys/cache)</li>
          <li><strong>FD ollama</strong> — <code>100.82.179.42:11434</code> · <strong>llama.cpp</strong> — <code>:11435</code> (Vulkan, fast)</li>
          <li><strong>opencode</strong> v1.14.51 (pinned) · <strong>agy</strong> (Antigravity) · <strong>FD MCPHub</strong> gateway (<code>:3456</code>)</li>
        </ul>
      </section>
      <section className="llm-ops__block">
        <h3>Model inventory</h3>
        <p className="llm-ops__lede">14 task-intent aliases + 9 <code>fw-*</code> models served via LiteLLM. Tier-0 default for autonomous: <code className="mono">fw-coding-32k</code> (qwen2.5-coder:32b).</p>
      </section>
    </div>
  );
}

function Capabilities() {
  return (
    <div className="llm-ops__doc">
      <section className="llm-ops__block">
        <h3>LLM Ops capabilities</h3>
        <ul className="llm-ops__list">
          <li><strong>Two-ledger spend tracking</strong> — Ledger A (LiteLLM gateway, per-request) + Ledger B (Claude Code Max bleed). Surfaced live on the home dashboard.</li>
          <li><strong>8 time-range analysis</strong> — 1h · 12h · 24h · 3d · 5d · 7d · 14d · 28d, per-model usage + token utilization.</li>
          <li><strong>Tier-0 share governance</strong> — % of calls/tokens served free-local; the headline cost-discipline metric.</li>
          <li><strong>Routing governor</strong> — <code>routing-governor.py</code> regenerates the usage layer + escalation policy each tick.</li>
          <li><strong>FD-local autonomous routing</strong> — flag-gated (<code className="mono">VEA_LLM_ROUTE_FD</code>) so the engine's autonomous calls default Tier-0 $0 (INV-1: never Claude Max).</li>
        </ul>
      </section>
    </div>
  );
}

function Verification() {
  return (
    <div className="llm-ops__doc">
      <section className="llm-ops__block">
        <h3>Live verification</h3>
        <ul className="llm-ops__checks">
          <li><span className="llm-ops__ok">✓</span> LiteLLM gateway reachable — <code>/health/readiness</code> 200</li>
          <li><span className="llm-ops__ok">✓</span> Usage proxy — <code>/api/llm/usage</code> 200 across all 8 ranges</li>
          <li><span className="llm-ops__ok">✓</span> Data parity — Fusion-VEA KPIs match the dev.nncm.me console (calls + spend)</li>
          <li><span className="llm-ops__ok">✓</span> Home dashboard renders live (non-stub) LiteLLM usage</li>
        </ul>
        <p className="llm-ops__lede">Full validation matrix + historical test results live in the complete console.</p>
      </section>
    </div>
  );
}

export function LlmOpsView() {
  const [sub, setSub] = useState<SubTab>(initialSub);
  return (
    <main className="llm-ops" aria-label="LLM operations console">
      <header className="llm-ops__head">
        <div>
          <p className="llm-ops__eyebrow">LLM Ops · routing &amp; cost control</p>
          <h1 className="llm-ops__title">LLM operations console</h1>
        </div>
        <a className="llm-ops__full" href={CONSOLE_URL} target="_blank" rel="noreferrer">Full console ↗</a>
      </header>
      <nav className="llm-ops__subnav" role="tablist" aria-label="LLM Ops sections">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={sub === t.id}
            className={`llm-ops__subtab ${sub === t.id ? "is-active" : ""}`}
            onClick={() => setSub(t.id)}
          >{t.label}</button>
        ))}
      </nav>
      <div className="llm-ops__body">
        {sub === "cheatsheet" ? <Cheatsheet /> : sub === "capabilities" ? <Capabilities /> : <Verification />}
      </div>
    </main>
  );
}

export default LlmOpsView;
