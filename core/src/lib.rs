mod config;
mod file_system;
mod history;
mod script_runner;

use config::{get_config, save_config};
use file_system::list_scripts;
use history::{append_history, clear_history, get_history};
use script_runner::{
    kill_script, run_script, run_script_stream, send_ctrl_c, write_stdin, ScriptProcess,
    ScriptStdin,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Launches the Tauri application.
///
/// # Panics
///
/// Panics if Tauri cannot start (invalid context or configuration error).
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ScriptProcess(Arc::new(Mutex::new(HashMap::new()))))
        .manage(ScriptStdin(Arc::new(Mutex::new(HashMap::new()))))
        .invoke_handler(tauri::generate_handler![
            list_scripts,
            run_script,
            get_config,
            save_config,
            run_script_stream,
            kill_script,
            write_stdin,
            send_ctrl_c,
            append_history,
            get_history,
            clear_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


#[cfg(test)]
mod config_tests {
    const TAURI_CONF: &str = include_str!("../tauri.conf.json");
    const CAPABILITIES: &str = include_str!("../capabilities/default.json");

    // ── capabilities/default.json ──────────────────────────────────────────────

    /// dialog:allow-open is declared in permissions.
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

    /// core:default is declared in permissions (base IPC).
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

    /// Least privilege — no fs:* or shell:* permissions.
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

    /// The file targets the "main" window.
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

    /// Exactly two permissions declared (minimal scope).
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

    // ── tauri.conf.json ────────────────────────────────────────────────────────

    /// productName is "ScriptLauncher".
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

    /// identifier is "dev.theoclere.scriptlauncher".
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

    /// version is "0.1.0".
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

    /// bundle.active is true.
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

    /// bundle.icon is a non-empty array.
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

    /// app.security.csp is defined and non-null.
    #[test]
    fn test_tauri_conf_csp_defined() {
        let v: serde_json::Value =
            serde_json::from_str(TAURI_CONF).expect("tauri.conf.json must be valid JSON");
        let csp = &v["app"]["security"]["csp"];
        assert!(
            !csp.is_null(),
            "app.security.csp must not be null"
        );
        assert!(
            csp.as_str().is_some(),
            "app.security.csp must be a string"
        );
    }

    /// CSP contains the required directives (tauri:, asset:, script-src 'self').
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

    /// CSP does not contain 'unsafe-eval'.
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

    /// build.beforeDevCommand is present and non-empty.
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

    /// build.beforeBuildCommand is present and non-empty.
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

    // ── Cross-file consistency ─────────────────────────────────────────────────

    /// Both config files are valid JSON.
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
