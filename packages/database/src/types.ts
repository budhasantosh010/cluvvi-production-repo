import type { RunStatus } from "@cluvvi/core";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_user_id: string;
  settings_json: Json;
  created_at: string;
  updated_at: string;
};

export type MissionRow = {
  id: string;
  workspace_id: string;
  name: string;
  website_url: string;
  raw_description: string;
  customer_outcome: string;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  geographies: string[];
  desired_count: number;
  exclusions: string[];
  capacity_notes: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type RunRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  status: RunStatus;
  phase: string;
  requested_count: number;
  candidate_target: number;
  candidate_limit: number;
  investigation_limit: number;
  enrichment_limit: number;
  budget_usd: number;
  budget_search_calls: number;
  budget_fetch_calls: number;
  budget_model_tokens: number;
  budget_enrichment_calls: number;
  actual_cost_usd: number;
  actual_search_calls: number;
  actual_fetch_calls: number;
  actual_model_tokens: number;
  actual_enrichment_calls: number;
  creation_idempotency_key: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

export type RunEventRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  event_type: string;
  from_status: RunStatus | null;
  to_status: RunStatus;
  actor_type: "user" | "worker" | "system";
  actor_id: string | null;
  idempotency_key: string;
  metadata_json: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: WorkspaceRow;
        Insert: Pick<WorkspaceRow, "name" | "owner_user_id"> &
          Partial<Pick<WorkspaceRow, "settings_json">>;
        Update: Partial<Pick<WorkspaceRow, "name" | "settings_json">>;
        Relationships: [];
      };
      workspace_memberships: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
        };
        Update: { role?: "owner" | "admin" | "member" };
        Relationships: [];
      };
      missions: {
        Row: MissionRow;
        Insert: Omit<MissionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<MissionRow, "id" | "workspace_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      runs: {
        Row: RunRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      run_events: {
        Row: RunEventRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      start_mission_run: {
        Args: {
          p_mission_id: string;
          p_requested_count: number;
          p_budget_usd: number;
          p_idempotency_key: string;
        };
        Returns: RunRow;
      };
      lease_mission_compile_messages: {
        Args: { p_quantity: number; p_visibility_timeout_seconds: number };
        Returns: Array<{
          queue_message_id: number;
          read_count: number;
          enqueued_at: string;
          visibility_deadline: string;
          message: Json;
        }>;
      };
      process_mission_compile_message: {
        Args: {
          p_queue_message_id: number;
          p_run_id: string;
          p_message_id: string;
          p_idempotency_key: string;
        };
        Returns: {
          outcome: "processed" | "duplicate" | "missing_run" | "invalid_state";
          run_id: string;
          status: RunStatus | null;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
