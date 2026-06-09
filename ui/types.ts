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
