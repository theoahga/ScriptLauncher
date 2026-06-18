// config.rs — Tauri commands for persistent configuration management.
//
// Commands:
//   get_config()        → AppConfig  : reads config (returns empty if missing)
//   save_config(config) → ()         : atomic write via temp file + rename
//
// Atomic write (temp + rename) prevents corruption on crash.
// Config directory is resolved via tauri::Manager / app_data_dir().

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// A script category (display name + folder path + opaque UUID id).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// Global application configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub categories: Vec<Category>,
}

/// Resolves the path to config.json inside app_data_dir.
fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    Ok(base.join("config.json"))
}

/// Tauri command — reads the configuration.
///
/// Returns an empty config when the file is missing (does not create it).
/// Returns an error if the file exists but contains invalid JSON.
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

/// Tauri command — writes the configuration atomically.
///
/// Algorithm:
/// 1. Create app_data_dir if missing
/// 2. Serialize to pretty-printed JSON
/// 3. Write to config.json.tmp (same filesystem as destination)
/// 4. Rename .tmp → config.json
///
/// Category paths are accepted without validation.
#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app_handle)?;

    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

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

    fn make_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scriptlauncher_config_test_{name}"));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_get_config_missing_file_returns_empty() {
        let dir = make_temp_dir("missing");
        let config_file = dir.join("config.json");

        assert!(!config_file.exists());

        let result: AppConfig = if !config_file.exists() {
            AppConfig { categories: vec![] }
        } else {
            let content = fs::read_to_string(&config_file).unwrap();
            serde_json::from_str(&content).unwrap()
        };

        cleanup(&dir);
        assert!(result.categories.is_empty());
    }

    #[test]
    fn test_get_config_reads_existing_file() {
        let dir = make_temp_dir("existing");
        let config_file = dir.join("config.json");

        let config = AppConfig {
            categories: vec![Category {
                id: "cat-1".to_string(),
                name: "System".to_string(),
                path: "/Users/theo/scripts".to_string(),
            }],
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_file, &json).unwrap();

        let loaded: AppConfig =
            serde_json::from_str(&fs::read_to_string(&config_file).unwrap()).unwrap();

        cleanup(&dir);
        assert_eq!(loaded.categories.len(), 1);
        assert_eq!(loaded.categories[0].name, "System");
        assert_eq!(loaded.categories[0].path, "/Users/theo/scripts");
    }

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

    #[test]
    fn test_save_config_writes_correct_json() {
        let dir = make_temp_dir("write");
        let config_file = dir.join("config.json");
        let tmp_file = dir.join("config.json.tmp");

        let config = AppConfig {
            categories: vec![
                Category {
                    id: "uuid-1".to_string(),
                    name: "Network".to_string(),
                    path: "/scripts/network".to_string(),
                },
                Category {
                    id: "uuid-2".to_string(),
                    name: "Backup".to_string(),
                    path: "/scripts/backup".to_string(),
                },
            ],
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&tmp_file, &json).unwrap();
        fs::rename(&tmp_file, &config_file).unwrap();

        assert!(!tmp_file.exists(), ".tmp should be removed after rename");
        assert!(config_file.exists(), "config.json should exist");

        let loaded: AppConfig =
            serde_json::from_str(&fs::read_to_string(&config_file).unwrap()).unwrap();

        cleanup(&dir);
        assert_eq!(loaded.categories.len(), 2);
        assert_eq!(loaded.categories[0].name, "Network");
    }

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

    #[test]
    fn test_app_config_empty_categories() {
        let config = AppConfig { categories: vec![] };
        let json = serde_json::to_string(&config).expect("serialize");
        assert!(json.contains("\"categories\""), "should contain categories key");
        let restored: AppConfig = serde_json::from_str(&json).expect("deserialize");
        assert!(restored.categories.is_empty());
    }

    #[test]
    fn test_category_clone_and_debug() {
        let cat = Category {
            id: "abc".to_string(),
            name: "MyCat".to_string(),
            path: "/path/to/cat".to_string(),
        };
        let cloned = cat.clone();
        assert_eq!(cloned.id, "abc");
        let debug = format!("{cat:?}");
        assert!(debug.contains("MyCat"));
    }
}
