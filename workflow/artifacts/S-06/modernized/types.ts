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
