# W2-B — Hermes + OpenClaw runtime plugins enabled

**Date:** 2026-04-28
**Branch:** `feat/runtime-plugins-installed`

## Status

Both upstream-shipped runtime plugins installed + enabled in Fusion's plugin DB.

```
fn plugin install ./plugins/fusion-plugin-hermes-runtime
fn plugin install ./plugins/fusion-plugin-openclaw-runtime
```

API verification (`/api/plugins`):
- `fusion-plugin-hermes-runtime` v0.1.0 — state=installed, enabled=true
- `fusion-plugin-openclaw-runtime` v0.1.0 — state=installed, enabled=true

## CRITICAL architectural finding (2026-04-28)

These plugins are **local runtime variants**, NOT remote dispatch adapters. They wrap the local pi CLI with Hermes/OpenClaw branding — they do not SSH or HTTP to cnnsvps1do/cnnsvps2do.

The VEA spec's premise of "runtime plugin → remote droplet" was based on a misreading of the plugin architecture. See memory `feedback_fusion_runtime_plugins_local_only.md` for the corrected model.

## Deferred work (not in this commit)

- **B3** — persona-display layer (requires Fusion UI / React source mods to map runtimeHint → display_persona on cards)
- **B4** — 5 domain orchestrators as Fusion sub-agent personas (requires understanding Fusion's "agent companies" mechanism — separate format)
- **B5** — smoke test with persona display (depends on B3)

## Next-step plan (Wave 2.5 B-remote)

For actual Fusion → droplet dispatch (which the original spec meant):
- Build a custom remote-dispatch adapter, OR
- Use Fusion's existing inter-agent mailbox + AgentMail bridge:
  - Fusion task → AgentMail email to kairos@hq.emeka.md
  - Hermes-on-cnnsvps1do receives + processes
  - Reply lands back in Fusion via inbound mail handler
- Estimated effort: ~1-2 days new sub-project

