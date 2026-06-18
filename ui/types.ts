/**
 * Shared ScriptLauncher types.
 * Match the Rust structs serialized via serde in core/src/.
 */

export interface ScriptInfo {
  /** Full filename (e.g., "deploy.sh") */
  name: string;
  /** Absolute path (e.g., "/scripts/deploy.sh") */
  path: string;
  /** Extension without dot (e.g., "sh", "py", "js") */
  extension: string;
}

export interface ScriptOutput {
  /** Script stdout */
  stdout: string;
  /** Script stderr */
  stderr: string;
  /** Exit code (0 = success, !=0 = error, -1 = killed by signal) */
  exit_code: number;
}

export interface HistoryEntry {
  /** UUID v4 generated client-side via crypto.randomUUID() */
  id: string;
  /** Script filename (e.g., "deploy.sh") */
  script_name: string;
  /** Absolute path of the script */
  script_path: string;
  /** Execution start timestamp (ISO 8601) */
  started_at: string;
  /** Execution duration in milliseconds */
  duration_ms: number;
  /** Exit code (0 = success, !=0 = error, -1 = killed by signal) */
  exit_code: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
}

export interface ExecutionTab {
  /** Tab UUID, also used as execution_id on the backend */
  id: string;
  script: ScriptInfo;
}

export interface Category {
  /** Opaque unique ID (UUID v4 generated client-side) */
  id: string;
  /** Display name shown in the sidebar */
  name: string;
  /** Absolute path to the scripts folder */
  path: string;
}

export interface AppConfig {
  /** Ordered list of script categories */
  categories: Category[];
}
