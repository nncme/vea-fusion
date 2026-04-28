/**
 * `fn identity list` — print the canonical VEA identity table.
 *
 * Reads the identities.json config (default: ~/Documents/Development/VEA/config/identities.json)
 * via the @fusion/core IdentityBridge and prints both the Core agents and
 * Domain orchestrators in a fixed-width tabular format.
 */

import { IdentityBridge } from "@fusion/core";

/**
 * Run the identity-list command.
 *
 * @param configPath Optional override path to identities.json. Defaults to
 *                   `${HOME}/Documents/Development/VEA/config/identities.json`.
 */
export async function runIdentityList(configPath?: string): Promise<void> {
  const path =
    configPath ?? `${process.env.HOME}/Documents/Development/VEA/config/identities.json`;

  const bridge = new IdentityBridge(path);

  const agents = bridge.listAgents();
  const domains = bridge.listDomainOrchestrators();

  console.log(`Identities config: ${path}`);
  console.log(`Schema version: ${bridge.getVersion()}`);
  console.log("");
  console.log(`Core agents (${agents.length}):`);
  for (const a of agents) {
    const uid = a.todoist.guest_user_id ?? "null";
    console.log(
      `  ${a.id.padEnd(8)} ${a.display_persona.padEnd(10)} ` +
        `email=${a.agentmail_address.padEnd(30)} ` +
        `runtime=${a.runtime.hint.padEnd(12)} ` +
        `todoist_uid=${uid}`,
    );
  }

  console.log("");
  console.log(`Domain orchestrators (${domains.length}):`);
  for (const d of domains) {
    console.log(
      `  ${d.id.padEnd(10)} ${d.fusion_subagent_persona.padEnd(12)} ` +
        `parent=${d.parent_runtime.padEnd(8)} status=${d.graduation_status}`,
    );
  }

  // IdentityBridge installs a watchFile poller; force-exit so the CLI doesn't hang.
  process.exit(0);
}
