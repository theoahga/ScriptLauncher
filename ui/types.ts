/**
 * Types partagés ScriptLauncher
 * Correspondent aux structs Rust sérialisées via serde dans core/src/
 */

export interface ScriptInfo {
  /** Nom complet du fichier (ex: "deploy.sh") */
  name: string;
  /** Chemin absolu complet (ex: "/scripts/deploy.sh") */
  path: string;
  /** Extension sans point (ex: "sh", "py", "js") */
  extension: string;
}

export interface ScriptOutput {
  /** Sortie standard du script */
  stdout: string;
  /** Sortie d'erreur du script */
  stderr: string;
  /** Code de retour (0 = succès, !=0 = erreur, -1 = tué par signal) */
  exit_code: number;
}

export interface HistoryEntry {
  /** UUID v4 généré côté frontend via crypto.randomUUID() */
  id: string;
  /** Nom du fichier script (ex: "deploy.sh") */
  script_name: string;
  /** Chemin absolu du script */
  script_path: string;
  /** Timestamp de début d'exécution (ISO 8601) */
  started_at: string;
  /** Durée d'exécution en millisecondes */
  duration_ms: number;
  /** Code de retour (0 = succès, !=0 = erreur, -1 = tué par signal) */
  exit_code: number;
  /** Sortie standard capturée */
  stdout: string;
  /** Sortie d'erreur capturée */
  stderr: string;
}

export interface ExecutionTab {
  /** UUID de l'onglet, aussi utilisé comme execution_id côté backend */
  id: string;
  script: ScriptInfo;
}

// S-09 — Config système : catégories de scripts

export interface Category {
  /** Identifiant unique opaque (UUID v4 généré côté frontend) */
  id: string;
  /** Nom affiché dans la sidebar */
  name: string;
  /** Chemin absolu vers le dossier de scripts */
  path: string;
}

export interface AppConfig {
  /** Liste ordonnée des catégories de scripts */
  categories: Category[];
}
