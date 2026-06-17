// history.rs — S-11
//
// Persistance de l'historique des exécutions dans un fichier JSONL
// situé dans app_data_dir() de Tauri 2.
//
// ADR-S11-01 : l'id UUID est généré côté frontend (crypto.randomUUID()),
//              pas de crate uuid côté Rust.
// ADR-S11-02 : format JSONL — append-only, résistant aux crashes, lisible humainement.
//
// Commandes exposées :
//   append_history(app, entry) → Result<(), String>
//   get_history(app, limit)    → Result<Vec<HistoryEntry>, String>
//   clear_history(app)         → Result<(), String>

use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use tauri::Manager;

/// Une entrée d'historique d'exécution de script.
/// L'id UUID v4 est généré côté frontend avant l'appel `append_history` (ADR-S11-01).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub script_name: String,
    pub script_path: String,
    pub started_at: String,
    pub duration_ms: u64,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Retourne le chemin du fichier history.jsonl dans app_data_dir().
/// Crée le répertoire parent si nécessaire.
fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app_data_dir: {e}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Cannot create app_data_dir: {e}"))?;
    Ok(data_dir.join("history.jsonl"))
}

/// Commande Tauri — ajoute une entrée à la fin du fichier history.jsonl.
/// Crée le fichier s'il n'existe pas (ADR-S11-02 : append-only, jamais rewrite).
#[tauri::command]
pub fn append_history(app: tauri::AppHandle, entry: HistoryEntry) -> Result<(), String> {
    let path = history_path(&app)?;
    let line = serde_json::to_string(&entry)
        .map_err(|e| format!("Serialization error: {e}"))?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Cannot open history file: {e}"))?;

    writeln!(file, "{line}").map_err(|e| format!("Cannot write to history file: {e}"))?;
    Ok(())
}

/// Commande Tauri — retourne les `limit` dernières entrées de history.jsonl.
/// Les entrées sont retournées les plus récentes en premier (ordre inversé).
/// Si le fichier n'existe pas → retourne Vec::new() (pas une erreur).
/// Les lignes corrompues sont ignorées silencieusement (edge case 3).
#[tauri::command]
pub fn get_history(app: tauri::AppHandle, limit: usize) -> Result<Vec<HistoryEntry>, String> {
    let path = history_path(&app)?;

    // Fichier absent → historique vide (edge case 1)
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&path).map_err(|e| format!("Cannot open history file: {e}"))?;
    let reader = BufReader::new(file);

    let entries: Vec<HistoryEntry> = reader
        .lines()
        .filter_map(|line| {
            let line = line.ok()?;
            if line.trim().is_empty() {
                return None;
            }
            // Lignes corrompues ignorées (edge case 3)
            serde_json::from_str(&line).ok()
        })
        .collect();

    // Retourner les `limit` dernières entrées en ordre inversé (plus récentes en premier)
    let result: Vec<HistoryEntry> = entries.into_iter().rev().take(limit).collect();
    Ok(result)
}

/// Commande Tauri — supprime le fichier history.jsonl.
/// Si le fichier n'existe pas → Ok(()) silencieux (edge case 5).
#[tauri::command]
pub fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let path = history_path(&app)?;

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Cannot delete history file: {e}"))?;
    }
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write as IoWrite;
    use std::path::PathBuf;

    /// Crée un dossier temporaire unique pour les tests.
    fn make_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sl_history_test_{name}"));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    fn make_entry(id: &str, script_name: &str, exit_code: i32) -> HistoryEntry {
        HistoryEntry {
            id: id.to_string(),
            script_name: script_name.to_string(),
            script_path: format!("/scripts/{script_name}"),
            started_at: "2026-06-17T14:32:00Z".to_string(),
            duration_ms: 100,
            exit_code,
            stdout: "output".to_string(),
            stderr: String::new(),
        }
    }

    // ── Helpers pour tester sans AppHandle (tests unitaires purs) ────────────

    fn append_to_file(path: &PathBuf, entry: &HistoryEntry) {
        let line = serde_json::to_string(entry).expect("serialize");
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .expect("open");
        writeln!(f, "{line}").expect("write");
    }

    fn read_from_file(path: &PathBuf, limit: usize) -> Vec<HistoryEntry> {
        if !path.exists() {
            return Vec::new();
        }
        let file = File::open(path).expect("open");
        let reader = BufReader::new(file);
        let entries: Vec<HistoryEntry> = reader
            .lines()
            .filter_map(|line| {
                let line = line.ok()?;
                if line.trim().is_empty() {
                    return None;
                }
                serde_json::from_str(&line).ok()
            })
            .collect();
        entries.into_iter().rev().take(limit).collect()
    }

    fn clear_file(path: &PathBuf) {
        if path.exists() {
            fs::remove_file(path).expect("remove");
        }
    }

    // ── TC-H01 : append puis get → entrée retrouvée ──────────────────────────
    #[test]
    fn test_append_then_get_returns_entry() {
        let dir = make_temp_dir("append_get");
        let path = dir.join("history.jsonl");
        let entry = make_entry("uuid-001", "deploy.sh", 0);

        append_to_file(&path, &entry);
        let result = read_from_file(&path, 50);
        cleanup(&dir);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "uuid-001");
        assert_eq!(result[0].script_name, "deploy.sh");
        assert_eq!(result[0].exit_code, 0);
    }

    // ── TC-H02 : get_history limite respectée ────────────────────────────────
    #[test]
    fn test_get_history_limit_respected() {
        let dir = make_temp_dir("limit");
        let path = dir.join("history.jsonl");

        // Écrire 10 entrées
        for i in 0..10 {
            let entry = make_entry(&format!("uuid-{i:03}"), "script.sh", 0);
            append_to_file(&path, &entry);
        }

        // Demander seulement 3
        let result = read_from_file(&path, 3);
        cleanup(&dir);

        assert_eq!(result.len(), 3, "should return exactly 3 entries");
        // Les plus récentes en premier (index 9, 8, 7)
        assert_eq!(result[0].id, "uuid-009");
        assert_eq!(result[1].id, "uuid-008");
        assert_eq!(result[2].id, "uuid-007");
    }

    // ── TC-H03 : clear_history → fichier supprimé, get retourne [] ───────────
    #[test]
    fn test_clear_history_removes_file() {
        let dir = make_temp_dir("clear");
        let path = dir.join("history.jsonl");
        let entry = make_entry("uuid-001", "script.sh", 0);

        append_to_file(&path, &entry);
        assert!(path.exists(), "file should exist before clear");

        clear_file(&path);
        let result = read_from_file(&path, 50);
        cleanup(&dir);

        assert!(!path.exists(), "file should be removed after clear");
        assert!(result.is_empty(), "get should return empty after clear");
    }

    // ── TC-H04 : fichier absent → get retourne [] sans erreur ────────────────
    #[test]
    fn test_get_history_file_absent_returns_empty() {
        let dir = make_temp_dir("absent");
        let path = dir.join("history.jsonl");
        // Ne pas créer le fichier

        let result = read_from_file(&path, 50);
        cleanup(&dir);

        assert!(result.is_empty(), "should return empty when file absent");
    }

    // ── TC-H05 : ordre inversé — entrées retournées les plus récentes en premier
    #[test]
    fn test_get_history_most_recent_first() {
        let dir = make_temp_dir("order");
        let path = dir.join("history.jsonl");

        let entries = vec![
            make_entry("first", "a.sh", 0),
            make_entry("second", "b.sh", 0),
            make_entry("third", "c.sh", 0),
        ];
        for e in &entries {
            append_to_file(&path, e);
        }

        let result = read_from_file(&path, 50);
        cleanup(&dir);

        assert_eq!(result.len(), 3);
        assert_eq!(result[0].id, "third");
        assert_eq!(result[1].id, "second");
        assert_eq!(result[2].id, "first");
    }

    // ── TC-H06 : lignes corrompues ignorées silencieusement ───────────────────
    #[test]
    fn test_get_history_corrupted_lines_ignored() {
        let dir = make_temp_dir("corrupt");
        let path = dir.join("history.jsonl");

        let entry = make_entry("uuid-ok", "ok.sh", 0);
        append_to_file(&path, &entry);

        // Ajouter une ligne corrompue
        let mut f = OpenOptions::new().append(true).open(&path).expect("open");
        writeln!(f, "{{invalid json}}").expect("write corrupt");
        writeln!(f, "not json at all").expect("write corrupt2");

        let result = read_from_file(&path, 50);
        cleanup(&dir);

        // Seule l'entrée valide est retournée
        assert_eq!(result.len(), 1, "corrupted lines should be ignored");
        assert_eq!(result[0].id, "uuid-ok");
    }

    // ── TC-H07 : clear_history sur fichier absent → Ok silencieux ─────────────
    #[test]
    fn test_clear_history_absent_file_is_ok() {
        let dir = make_temp_dir("clear_absent");
        let path = dir.join("history.jsonl");
        assert!(!path.exists());

        // Ne doit pas paniquer
        clear_file(&path);
        cleanup(&dir);
        // Pas d'assertion supplémentaire — la fonction ne doit pas paniquer
    }

    // ── TC-H08 : HistoryEntry implémente Clone et Debug ───────────────────────
    #[test]
    fn test_history_entry_clone_and_debug() {
        let entry = make_entry("uuid-clone", "clone.sh", 0);
        let cloned = entry.clone();
        assert_eq!(cloned.id, "uuid-clone");
        let debug = format!("{entry:?}");
        assert!(debug.contains("uuid-clone"));
        assert!(debug.contains("clone.sh"));
    }
}
