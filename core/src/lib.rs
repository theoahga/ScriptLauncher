mod file_system;
mod script_runner;

use file_system::list_scripts;
use script_runner::run_script;

/// Lance l'application Tauri.
///
/// # Panics
///
/// Panique si Tauri ne peut pas démarrer (contexte invalide, erreur de configuration).
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_scripts, run_script])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
