mod config;
mod file_system;
mod script_runner;

use config::{get_config, save_config};
use file_system::list_scripts;
use script_runner::{kill_script, run_script, run_script_stream, ScriptProcess};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Lance l'application Tauri.
///
/// # Panics
///
/// Panique si Tauri ne peut pas démarrer (contexte invalide, erreur de configuration).
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ScriptProcess(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            list_scripts,
            run_script,
            run_script_stream,
            kill_script,
            get_config,
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod config_tests {
    // -------------------------------------------------------------------------
    // Tests de configuration S-04 — parse statique des fichiers JSON de config
    // Utilise include_str! pour intégrer les fichiers au binaire de test :
    // pas d'accès FS au runtime, pas de dépendance à l'emplacement du CWD.
    // -------------------------------------------------------------------------

    const TAURI_CONF: &str = include_str!("../tauri.conf.json");
    const CAPABILITIES: &str = include_str!("../capabilities/default.json");

    // ------------------------------------------------------------------
    // AC-1 : capabilities/default.json — permissions déclarées
    // ------------------------------------------------------------------

    /// CA-1a : dialog:allow-open est présent dans les permissions.
    #[test]
    fn test_capabilities_contains_dialog_allow_open() {
        let v: serde_json::Value =
            serde_json::from_str(CAPABILITIES).expect("capabilities/default.json must be valid JSON");
        let perms = v["permissions"]
            .as_array()
            .expect("permissions must be an array");
        let has_dialog = perms
            .iter()
            .any(|p| p.as_str() == Some("dialog:allow-open"));
        assert!(
            has_dialog,
            "capabilities/default.json must declare 'dialog:allow-open'"
        );
    }

    /// CA-1b : core:default est présent dans les permissions (base IPC).
    #[test]
    fn test_capabilities_contains_core_default() {
        let v: serde_json::Value =
            serde_json::from_str(CAPABILITIES).expect("capabilities/default.json must be valid JSON");
        let perms = v["permissions"]
            .as_array()
            .expect("permissions must be an array");
        let has_core = perms.iter().any(|p| p.as_str() == Some("core:default"));
        assert!(
            has_core,
            "capabilities/default.json must include 'core:default'"
        );
    }

    /// CA-1c : principe du moindre privilège — aucune permission fs:* ni shell:*.
    #[test]
    fn test_capabilities_no_fs_or_shell_permissions() {
        let v: serde_json::Value =
            serde_json::from_str(CAPABILITIES).expect("capabilities/default.json must be valid JSON");
        let perms = v["permissions"]
            .as_array()
            .expect("permissions must be an array");
        for p in perms {
            let s = p.as_str().unwrap_or("");
            assert!(
                !s.starts_with("fs:"),
                "unexpected fs permission in capabilities: {s}"
            );
            assert!(
                !s.starts_with("shell:"),
                "unexpected shell permission in capabilities: {s}"
            );
        }
    }

    /// CA-1d : le fichier cible la fenêtre "main".
    #[test]
    fn test_capabilities_targets_main_window() {
        let v: serde_json::Value =
            serde_json::from_str(CAPABILITIES).expect("capabilities/default.json must be valid JSON");
        let windows = v["windows"]
            .as_array()
            .expect("windows must be an array");
        let has_main = windows.iter().any(|w| w.as_str() == Some("main"));
        assert!(
            has_main,
            "capabilities/default.json must target window 'main'"
        );
    }

    /// CA-1e : exactement deux permissions déclarées (périmètre minimal).
    #[test]
    fn test_capabilities_exactly_two_permissions() {
        let v: serde_json::Value =
            serde_json::from_str(CAPABILITIES).expect("capabilities/default.json must be valid JSON");
        let perms = v["permissions"]
            .as_array()
            .expect("permissions must be an array");
        assert_eq!(
            perms.len(),
            2,
            "capabilities must declare exactly 2 permissions (core:default + dialog:allow-open), got {}",
            perms.len()
        );
    }

    // ------------------------------------------------------------------
    // AC-2 : tauri.conf.json — champs de configuration
    // ------------------------------------------------------------------

    /// CA-2a : productName est "ScriptLauncher".
    #[test]
    fn test_tauri_conf_product_name() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        assert_eq!(
            v["productName"].as_str(),
            Some("ScriptLauncher"),
            "productName must be 'ScriptLauncher'"
        );
    }

    /// CA-2b : identifier est "dev.theoclere.scriptlauncher".
    #[test]
    fn test_tauri_conf_identifier() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        assert_eq!(
            v["identifier"].as_str(),
            Some("dev.theoclere.scriptlauncher"),
            "identifier must be 'dev.theoclere.scriptlauncher'"
        );
    }

    /// CA-2c : version est "0.1.0".
    #[test]
    fn test_tauri_conf_version() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        assert_eq!(
            v["version"].as_str(),
            Some("0.1.0"),
            "version must be '0.1.0'"
        );
    }

    /// CA-2d : bundle.active est true.
    #[test]
    fn test_tauri_conf_bundle_active() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        assert_eq!(
            v["bundle"]["active"].as_bool(),
            Some(true),
            "bundle.active must be true"
        );
    }

    /// CA-2e : bundle.icon est un tableau non vide.
    #[test]
    fn test_tauri_conf_bundle_icon_non_empty() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let icons = v["bundle"]["icon"]
            .as_array()
            .expect("bundle.icon must be an array");
        assert!(
            !icons.is_empty(),
            "bundle.icon must contain at least one icon path"
        );
    }

    /// CA-2f : app.security.csp est défini et non null.
    #[test]
    fn test_tauri_conf_csp_defined() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let csp = &v["app"]["security"]["csp"];
        assert!(
            !csp.is_null(),
            "app.security.csp must not be null — it was null in the original config"
        );
        assert!(
            csp.as_str().is_some(),
            "app.security.csp must be a string"
        );
    }

    /// CA-2g : la CSP contient les directives attendues (tauri:, asset:, script-src 'self').
    #[test]
    fn test_tauri_conf_csp_contains_required_directives() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let csp = v["app"]["security"]["csp"]
            .as_str()
            .expect("app.security.csp must be a string");
        assert!(
            csp.contains("tauri:"),
            "CSP must include 'tauri:' scheme, got: {csp}"
        );
        assert!(
            csp.contains("asset:"),
            "CSP must include 'asset:' scheme, got: {csp}"
        );
        assert!(
            csp.contains("script-src"),
            "CSP must include 'script-src' directive, got: {csp}"
        );
        assert!(
            csp.contains("'self'"),
            "CSP must include \"'self'\", got: {csp}"
        );
    }

    /// CA-2h : la CSP ne contient pas 'unsafe-eval' (ADR-04).
    #[test]
    fn test_tauri_conf_csp_no_unsafe_eval() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let csp = v["app"]["security"]["csp"]
            .as_str()
            .expect("app.security.csp must be a string");
        assert!(
            !csp.contains("'unsafe-eval'"),
            "CSP must not contain 'unsafe-eval', got: {csp}"
        );
    }

    /// CA-2i : build.beforeDevCommand est présent et non vide.
    #[test]
    fn test_tauri_conf_before_dev_command_present() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let cmd = v["build"]["beforeDevCommand"].as_str();
        assert!(
            cmd.is_some() && !cmd.unwrap().is_empty(),
            "build.beforeDevCommand must be present and non-empty"
        );
    }

    /// CA-2j : build.beforeBuildCommand est présent et non vide.
    #[test]
    fn test_tauri_conf_before_build_command_present() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let cmd = v["build"]["beforeBuildCommand"].as_str();
        assert!(
            cmd.is_some() && !cmd.unwrap().is_empty(),
            "build.beforeBuildCommand must be present and non-empty"
        );
    }

    // ------------------------------------------------------------------
    // AC-2 : cohérence croisée tauri.conf.json ↔ capabilities/default.json
    // ------------------------------------------------------------------

    /// CC-1 : les deux fichiers sont du JSON valide (test de parsing combiné).
    #[test]
    fn test_both_config_files_are_valid_json() {
        assert!(
            serde_json::from_str::<serde_json::Value>(TAURI_CONF).is_ok(),
            "tauri.conf.json must be valid JSON"
        );
        assert!(
            serde_json::from_str::<serde_json::Value>(CAPABILITIES).is_ok(),
            "capabilities/default.json must be valid JSON"
        );
    }
}
