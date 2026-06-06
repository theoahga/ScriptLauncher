use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const ALLOWED_EXTENSIONS: &[&str] = &[
    "sh", "py", "js", "ts", "ps1", "bat", "cmd", "rb", "fish",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptInfo {
    pub name: String,
    pub path: String,
    pub extension: String,
}

#[tauri::command]
// `folder` doit être String (pas &str) : contrat imposé par l'IPC Tauri (serde JSON)
#[allow(clippy::needless_pass_by_value)]
pub fn list_scripts(folder: String) -> Result<Vec<ScriptInfo>, String> {
    let path = PathBuf::from(&folder);

    if !path.exists() {
        return Err(format!("Path does not exist: {folder}"));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {folder}"));
    }

    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {e}"))?;

    let mut scripts: Vec<ScriptInfo> = Vec::new();

    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };

        let entry_path = entry.path();

        // Ignorer les sous-dossiers
        if entry_path.is_dir() {
            continue;
        }

        // Récupérer l'extension en minuscules
        let Some(ext_os) = entry_path.extension() else {
            continue;
        };
        let extension = ext_os.to_string_lossy().to_lowercase();

        // Filtrer par extension reconnue
        if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
            continue;
        }

        // Calculer le chemin absolu canonique (ADR-03)
        let Ok(canonical) = fs::canonicalize(&entry_path) else {
            continue; // ignore silencieusement (ADR-02)
        };

        let Some(name_os) = entry_path.file_name() else {
            continue;
        };
        let name = name_os.to_string_lossy().into_owned();

        scripts.push(ScriptInfo {
            name,
            path: canonical.to_string_lossy().into_owned(),
            extension: extension.clone(),
        });
    }

    // Tri alphabétique insensible à la casse (ADR-04)
    scripts.sort_by_key(|s| s.name.to_lowercase());

    Ok(scripts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::path::PathBuf;

    /// Crée un dossier temporaire unique basé sur un nom donné.
    /// Retourne le chemin. L'appelant est responsable de la suppression.
    fn make_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scriptlauncher_test_{}", name));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_list_scripts_nominal() {
        let dir = make_temp_dir("nominal");
        File::create(dir.join("a.sh")).unwrap();
        File::create(dir.join("b.py")).unwrap();
        File::create(dir.join("c.txt")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 2);
        assert!(scripts.iter().any(|s| s.name == "a.sh"));
        assert!(scripts.iter().any(|s| s.name == "b.py"));
    }

    #[test]
    fn test_list_scripts_sorted() {
        let dir = make_temp_dir("sorted");
        File::create(dir.join("zebra.sh")).unwrap();
        File::create(dir.join("alpha.py")).unwrap();
        File::create(dir.join("Mango.js")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 3);
        assert_eq!(scripts[0].name, "alpha.py");
        assert_eq!(scripts[1].name, "Mango.js");
        assert_eq!(scripts[2].name, "zebra.sh");
    }

    #[test]
    fn test_list_scripts_filtered() {
        let dir = make_temp_dir("filtered");
        File::create(dir.join("run.txt")).unwrap();
        File::create(dir.join("data.csv")).unwrap();
        File::create(dir.join("notes.md")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 0);
    }

    #[test]
    fn test_list_scripts_empty_dir() {
        let dir = make_temp_dir("empty");

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 0);
    }

    #[test]
    fn test_list_scripts_invalid_path() {
        let result = list_scripts("/tmp/does_not_exist_xyz_123".to_string());

        let err = result.expect_err("should fail");
        assert!(
            err.contains("does not exist"),
            "error message should contain 'does not exist', got: {}",
            err
        );
    }

    #[test]
    fn test_list_scripts_file_path() {
        let dir = make_temp_dir("file_path");
        let file_path = dir.join("script.sh");
        File::create(&file_path).unwrap();

        let result = list_scripts(file_path.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail");
        assert!(
            err.contains("not a directory"),
            "error message should contain 'not a directory', got: {}",
            err
        );
    }

    #[test]
    fn test_list_scripts_subdirs_ignored() {
        let dir = make_temp_dir("subdirs");
        fs::create_dir(dir.join("subdir")).unwrap();
        File::create(dir.join("script.sh")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].name, "script.sh");
    }

    #[test]
    fn test_list_scripts_extension_case() {
        let dir = make_temp_dir("ext_case");
        File::create(dir.join("DEPLOY.SH")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].name, "DEPLOY.SH");
        assert_eq!(scripts[0].extension, "sh");
    }

    // EC6 — fichier sans extension : ignoré
    #[test]
    fn test_list_scripts_no_extension_ignored() {
        let dir = make_temp_dir("no_ext");
        File::create(dir.join("Makefile")).unwrap();
        File::create(dir.join("README")).unwrap();
        File::create(dir.join("run.sh")).unwrap(); // seul attendu

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].name, "run.sh");
    }

    // EC8 — fichier commençant par un point (.bashrc, .zshrc) : ignoré car extension absente
    #[test]
    fn test_list_scripts_dotfile_ignored() {
        let dir = make_temp_dir("dotfile");
        File::create(dir.join(".bashrc")).unwrap();
        File::create(dir.join(".zshrc")).unwrap();
        File::create(dir.join("hello.py")).unwrap(); // seul attendu

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].name, "hello.py");
    }

    // EC12 — chemin avec espaces et caractères Unicode
    #[test]
    fn test_list_scripts_path_with_spaces_and_unicode() {
        let dir = make_temp_dir("spaced dir ñoño");
        File::create(dir.join("mon script.py")).unwrap();
        File::create(dir.join("données.sh")).unwrap();
        File::create(dir.join("ignore.txt")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed with spaces and unicode");
        assert_eq!(scripts.len(), 2);
        // Tri : "d" < "m"
        assert_eq!(scripts[0].name, "données.sh");
        assert_eq!(scripts[1].name, "mon script.py");
    }

    // Vérifie que le champ `path` est un chemin absolu (commence par "/")
    #[test]
    fn test_list_scripts_path_field_is_absolute() {
        let dir = make_temp_dir("abs_path");
        File::create(dir.join("script.sh")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert!(
            std::path::Path::new(&scripts[0].path).is_absolute(),
            "path field should be absolute, got: {}",
            scripts[0].path
        );
    }

    // Vérifie que le champ `extension` ne contient pas le point
    #[test]
    fn test_list_scripts_extension_has_no_dot() {
        let dir = make_temp_dir("ext_no_dot");
        File::create(dir.join("run.py")).unwrap();

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 1);
        assert!(
            !scripts[0].extension.starts_with('.'),
            "extension should not start with '.', got: {}",
            scripts[0].extension
        );
        assert_eq!(scripts[0].extension, "py");
    }

    // Toutes les 9 extensions reconnues sont acceptées
    #[test]
    fn test_list_scripts_all_allowed_extensions() {
        let dir = make_temp_dir("all_exts");
        let files = &[
            "a.sh", "b.py", "c.js", "d.ts", "e.ps1", "f.bat", "g.cmd", "h.rb", "i.fish",
        ];
        for f in files {
            File::create(dir.join(f)).unwrap();
        }

        let result = list_scripts(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let scripts = result.expect("should succeed");
        assert_eq!(scripts.len(), 9, "all 9 allowed extensions should be accepted");
    }
}
