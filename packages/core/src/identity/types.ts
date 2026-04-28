export type CoreAgent = {
  id: string;
  display_persona: string;
  agentmail_address: string;
  todoist: {
    guest_email: string;
    guest_user_id: string | null; // string in JSON since Todoist user_ids are large numerics
    invitation_status: 'pending' | 'joined' | 'declined';
  };
  runtime: {
    hint: string;
    host: string;
    endpoint: string;
    model_tier?: Record<string, string>;
  };
  telemetry: {
    surfaces: string[];
    ingest_url: string;
  };
  approval: {
    materiality_default: 'low' | 'medium' | 'high-reversible' | 'high-destructive';
    pushcut_recipient: string;
  };
};

export type DomainOrchestrator = {
  id: string;
  parent_runtime: string;
  fusion_subagent_persona: string;
  graduation_status: 'internal-only' | 'graduating' | 'graduated';
};

export type LabelNamespace = {
  no_fusion: string;
  bypass_permissions: string;
  force_high_materiality: string;
};

export type SleepWindow = {
  start: string; // "HH:MM"
  end: string;
  tz: string;
};

export type IdentitiesConfig = {
  version: number;
  core_agents: CoreAgent[];
  domain_orchestrators: DomainOrchestrator[];
  label_namespace: LabelNamespace;
  emeka: { sleep_window: SleepWindow };
};
