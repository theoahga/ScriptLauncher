// config.rs — S-09
//
// Commandes Tauri pour la gestion de la configuration persistante :
//   - get_config() → AppConfig   : lecture (crée config vide si absent)
//   - save_config(config) → ()   : écriture atomique via fichier .tmp + rename
//
// ADR-01 : écriture atomique (temp + rename) pour éviter la corruption
// ADR-06 : app_data_dir() via tauri::Manager sur AppHandle

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Une catégorie de scripts (nom + chemin + identifiant opaque).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// Configuration globale de l'application.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub categories: Vec<Category>,
}

/// Résout le chemin du fichier config.json dans app_data_dir.
fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    Ok(base.join("config.json"))
}

/// Commande Tauri — lit la configuration.
///
/// Si le fichier est absent, retourne une config vide (ne crée pas le fichier).
/// Si le fichier est corrompu (JSON invalide), retourne une erreur.
#[tauri::command]
pub fn get_config(app_handle: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app_handle)?;

    if !path.exists() {
        return Ok(AppConfig { categories: vec![] });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {e}"))?;

    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {e}"))?;

    Ok(config)
}

/// Commande Tauri — écrit la configuration de façon atomique.
///
/// Algorithme (ADR-01) :
/// 1. Crée app_data_dir si absent
/// 2. Sérialise en JSON formaté
/// 3. Écrit dans config.json.tmp (même répertoire = même filesystem)
/// 4. Renomme .tmp → config.json
///
/// Les chemins invalides dans les catégories sont acceptés sans validation.
#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app_handle)?;

    // Créer le répertoire si absent
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    // Écriture atomique : .tmp dans le même répertoire (même filesystem)
    let tmp_path = path.with_extension("json.tmp");

    fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write config temp file: {e}"))?;

    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to finalize config file: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    /// Crée un répertoire temporaire unique.
    fn make_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scriptlauncher_config_test_{name}"));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    /// Simule get_config sur un fichier inexistant → config vide
    #[test]
    fn test_get_config_missing_file_returns_empty() {
        let dir = make_temp_dir("missing");
        let config_file = dir.join("config.json");

        // Le fichier n'existe pas
        assert!(!config_file.exists());

        // Simulation : lire manuellement (sans AppHandle dans les tests unitaires)
        let result: AppConfig = if !config_file.exists() {
            AppConfig { categories: vec![] }
        } else {
            let content = fs::read_to_string(&config_file).unwrap();
            serde_json::from_str(&content).unwrap()
        };

        cleanup(&dir);
        assert!(result.categories.is_empty());
    }

    /// Simule get_config sur un fichier valide
    #[test]
    fn test_get_config_reads_existing_file() {
        let dir = make_temp_dir("existing");
        let config_file = dir.join("config.json");

        let config = AppConfig {
            categories: vec![Category {
                id: "cat-1".to_string(),
                name: "Système".to_string(),
                path: "/Users/theo/scripts".to_string(),
            }],
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_file, &json).unwrap();

        let loaded: AppConfig = serde_json::from_str(&fs::read_to_string(&config_file).unwrap()).unwrap();

        cleanup(&dir);
        assert_eq!(loaded.categories.len(), 1);
        assert_eq!(loaded.categories[0].name, "Système");
        assert_eq!(loaded.categories[0].path, "/Users/theo/scripts");
    }

    /// Config corrompue → erreur de parsing
    #[test]
    fn test_get_config_corrupt_file_returns_err() {
        let dir = make_temp_dir("corrupt");
        let config_file = dir.join("config.json");
        fs::write(&config_file, "{ invalid json {{{{").unwrap();

        let result: Result<AppConfig, _> =
            serde_json::from_str(&fs::read_to_string(&config_file).unwrap());

        cleanup(&dir);
        assert!(result.is_err(), "corrupt JSON should fail to parse");
    }

    /// Écriture atomique : le fichier final est correct
    #[test]
    fn test_save_config_writes_correct_json() {
        let dir = make_temp_dir("write");
        let config_file = dir.join("config.json");
        let tmp_file = dir.join("config.json.tmp");

        let config = AppConfig {
            categories: vec![
                Category {
                    id: "uuid-1".to_string(),
                    name: "Réseau".to_string(),
                    path: "/scripts/réseau".to_string(),
                },
                Category {
                    id: "uuid-2".to_string(),
                    name: "Backup".to_string(),
                    path: "/scripts/backup".to_string(),
                },
            ],
        };

        // Simulation de save_config sans AppHandle
        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&tmp_file, &json).unwrap();
        fs::rename(&tmp_file, &config_file).unwrap();

        assert!(!tmp_file.exists(), ".tmp should be removed after rename");
        assert!(config_file.exists(), "config.json should exist");

        let loaded: AppConfig =
            serde_json::from_str(&fs::read_to_string(&config_file).unwrap()).unwrap();

        cleanup(&dir);
        assert_eq!(loaded.categories.len(), 2);
        assert_eq!(loaded.categories[0].name, "Réseau");
    }

    /// AppConfig sérialise et désérialise (round-trip)
    #[test]
    fn test_app_config_roundtrip() {
        let config = AppConfig {
            categories: vec![Category {
                id: "test-id".to_string(),
                name: "Test Cat".to_string(),
                path: "/tmp/test".to_string(),
            }],
        };

        let json = serde_json::to_string(&config).expect("serialize");
        let restored: AppConfig = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(restored.categories.len(), 1);
        assert_eq!(restored.categories[0].id, "test-id");
    }

    /// AppConfig vide sérialise correctement
    #[test]
    fn test_app_config_empty_categories() {
        let config = AppConfig { categories: vec![] };
        let json = serde_json::to_string(&config).expect("serialize");
        assert!(json.contains("\"categories\""), "should contain categories key");
        let restored: AppConfig = serde_json::from_str(&json).expect("deserialize");
        assert!(restored.categories.is_empty());
    }

    /// Category implémente Clone et Debug
    #[test]
    fn test_category_clone_and_debug() {
        let cat = Category {
            id: "abc".to_string(),
            name: "MonCat".to_string(),
            path: "/chemin".to_string(),
        };
        let cloned = cat.clone();
        assert_eq!(cloned.id, "abc");
        let debug = format!("{cat:?}");
        assert!(debug.contains("MonCat"));
    }
}
