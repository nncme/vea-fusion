import { readFileSync, watchFile, statSync } from 'node:fs';
import type {
  CoreAgent,
  DomainOrchestrator,
  IdentitiesConfig,
  LabelNamespace,
  SleepWindow,
} from './types.js';

export class IdentityBridge {
  private config: IdentitiesConfig;
  private lastMtimeMs: number;

  constructor(private readonly configPath: string) {
    this.config = this.load();
    this.lastMtimeMs = statSync(this.configPath).mtimeMs;
    this.watchForChanges();
  }

  private load(): IdentitiesConfig {
    const raw = readFileSync(this.configPath, 'utf-8');
    const parsed = JSON.parse(raw) as IdentitiesConfig;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.core_agents)) {
      throw new Error(`identities.json: invalid schema (missing version or core_agents)`);
    }
    return parsed;
  }

  private watchForChanges(): void {
    watchFile(this.configPath, { interval: 2000 }, () => {
      try {
        const next = this.load();
        const newMtime = statSync(this.configPath).mtimeMs;
        if (newMtime !== this.lastMtimeMs) {
          this.config = next;
          this.lastMtimeMs = newMtime;
        }
      } catch (err) {
        // Don't crash the daemon on a malformed write — keep last known good
        // eslint-disable-next-line no-console
        console.error('[IdentityBridge] reload failed:', (err as Error).message);
      }
    });
  }

  resolveByTodoistEmail(email: string): CoreAgent | null {
    const lower = email.toLowerCase().trim();
    return this.config.core_agents.find(a => a.todoist.guest_email.toLowerCase() === lower) ?? null;
  }

  resolveById(id: string): CoreAgent | null {
    return this.config.core_agents.find(a => a.id === id) ?? null;
  }

  resolveByTodoistUserId(userId: string): CoreAgent | null {
    return this.config.core_agents.find(a => a.todoist.guest_user_id === userId) ?? null;
  }

  resolveByAgentmailAddress(addr: string): CoreAgent | null {
    const lower = addr.toLowerCase().trim();
    return this.config.core_agents.find(a => a.agentmail_address.toLowerCase() === lower) ?? null;
  }

  runtimeHintToPersona(hint: string): string | null {
    return this.config.core_agents.find(a => a.runtime.hint === hint)?.display_persona ?? null;
  }

  listAgents(): readonly CoreAgent[] {
    return this.config.core_agents;
  }

  listDomainOrchestrators(): readonly DomainOrchestrator[] {
    return this.config.domain_orchestrators;
  }

  getLabelNamespace(): LabelNamespace {
    return { ...this.config.label_namespace };
  }

  getSleepWindow(): SleepWindow {
    return { ...this.config.emeka.sleep_window };
  }

  getVersion(): number {
    return this.config.version;
  }
}
