import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IdentityBridge } from '../bridge.js';
import { writeFileSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURE = {
  version: 1,
  core_agents: [
    {
      id: 'helm',
      display_persona: 'Helm',
      agentmail_address: 'helm@hq.emeka.md',
      todoist: { guest_email: 'helm@hq.emeka.md', guest_user_id: '58905937', invitation_status: 'joined' as const },
      runtime: { hint: 'claude-code', host: 'cnnsm1mini', endpoint: 'local' },
      telemetry: { surfaces: ['claude_code_hook'], ingest_url: 'http://x:9876/ingest' },
      approval: { materiality_default: 'low' as const, pushcut_recipient: 'default' },
    },
    {
      id: 'kairos',
      display_persona: 'Kairos',
      agentmail_address: 'kairos@hq.emeka.md',
      todoist: { guest_email: 'kairos@hq.emeka.md', guest_user_id: '58905949', invitation_status: 'joined' as const },
      runtime: { hint: 'hermes', host: 'cnnsvps1do', endpoint: 'ssh://...' },
      telemetry: { surfaces: ['claude_code_hook', 'hermes_log_tailer'], ingest_url: 'http://x:9876/ingest' },
      approval: { materiality_default: 'medium' as const, pushcut_recipient: 'default' },
    },
  ],
  domain_orchestrators: [
    { id: 'nexus', parent_runtime: 'helm', fusion_subagent_persona: 'Nexus', graduation_status: 'internal-only' as const },
  ],
  label_namespace: { no_fusion: 'NoFusion', bypass_permissions: 'BypassPermissions', force_high_materiality: 'high-materiality' },
  emeka: { sleep_window: { start: '23:00', end: '07:00', tz: 'US/Eastern' } },
};

describe('IdentityBridge', () => {
  let tmpDir: string;
  let configPath: string;
  let bridge: IdentityBridge;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'vea-id-'));
    configPath = join(tmpDir, 'identities.json');
    writeFileSync(configPath, JSON.stringify(FIXTURE));
    bridge = new IdentityBridge(configPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves by Todoist guest email (case-insensitive)', () => {
    expect(bridge.resolveByTodoistEmail('kairos@hq.emeka.md')?.id).toBe('kairos');
    expect(bridge.resolveByTodoistEmail('KAIROS@HQ.emeka.md')?.id).toBe('kairos');
  });

  it('resolves by id', () => {
    expect(bridge.resolveById('helm')?.display_persona).toBe('Helm');
  });

  it('resolves by todoist_user_id (string)', () => {
    expect(bridge.resolveByTodoistUserId('58905949')?.id).toBe('kairos');
  });

  it('resolves by agentmail address (case-insensitive)', () => {
    expect(bridge.resolveByAgentmailAddress('helm@hq.emeka.md')?.id).toBe('helm');
    expect(bridge.resolveByAgentmailAddress('HELM@hq.emeka.md')?.id).toBe('helm');
  });

  it('returns null for unknown email — never crashes', () => {
    expect(bridge.resolveByTodoistEmail('alien@hq.emeka.md')).toBeNull();
    expect(bridge.resolveById('nonexistent')).toBeNull();
    expect(bridge.resolveByTodoistUserId('99999999')).toBeNull();
  });

  it('maps runtime_hint to display_persona', () => {
    expect(bridge.runtimeHintToPersona('hermes')).toBe('Kairos');
    expect(bridge.runtimeHintToPersona('claude-code')).toBe('Helm');
    expect(bridge.runtimeHintToPersona('unknown-runtime')).toBeNull();
  });

  it('lists agents and domain orchestrators (immutable views)', () => {
    expect(bridge.listAgents()).toHaveLength(2);
    expect(bridge.listDomainOrchestrators()).toHaveLength(1);
  });

  it('exposes label namespace + sleep window as fresh copies', () => {
    const ns = bridge.getLabelNamespace();
    ns.no_fusion = 'TAMPER';
    expect(bridge.getLabelNamespace().no_fusion).toBe('NoFusion');

    const sw = bridge.getSleepWindow();
    sw.start = '00:00';
    expect(bridge.getSleepWindow().start).toBe('23:00');
  });

  it('hot-reloads when identities.json mtime changes', async () => {
    expect(bridge.resolveById('newcomer')).toBeNull();

    const updated = JSON.parse(JSON.stringify(FIXTURE));
    updated.core_agents.push({
      id: 'newcomer',
      display_persona: 'Newcomer',
      agentmail_address: 'newcomer@hq.emeka.md',
      todoist: { guest_email: 'newcomer@hq.emeka.md', guest_user_id: '12345', invitation_status: 'joined' },
      runtime: { hint: 'noop', host: 'localhost', endpoint: 'local' },
      telemetry: { surfaces: [], ingest_url: '' },
      approval: { materiality_default: 'low', pushcut_recipient: 'default' },
    });
    writeFileSync(configPath, JSON.stringify(updated));
    // Bump mtime explicitly to force watcher
    const future = new Date(Date.now() + 5000);
    utimesSync(configPath, future, future);

    // Wait for watchFile interval (2000ms + safety)
    await new Promise(r => setTimeout(r, 5000));
    expect(bridge.resolveById('newcomer')?.display_persona).toBe('Newcomer');
  }, 15000);

  it('returns null on malformed JSON during reload (does not crash)', async () => {
    expect(bridge.resolveById('helm')).not.toBeNull();
    writeFileSync(configPath, '{ NOT VALID JSON');
    const future = new Date(Date.now() + 5000);
    utimesSync(configPath, future, future);
    await new Promise(r => setTimeout(r, 5000));
    // Should still resolve to last-known-good
    expect(bridge.resolveById('helm')).not.toBeNull();
  }, 15000);
});
