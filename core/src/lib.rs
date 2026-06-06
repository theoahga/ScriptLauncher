mod file_system;

use file_system::list_scripts;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_scripts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
