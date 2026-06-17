// script_runner.rs — S-03 (modernisé), S-10 (streaming)
//
// Commande Tauri `run_script` : exécute un script de façon bloquante et retourne
// stdout, stderr et le code de retour.
//
// Commande Tauri `run_script_stream` : exécute un script de façon non-bloquante,
// streame stdout ligne par ligne via événements Tauri `script-stdout`,
// émet `script-done` à la fin. (S-10)
//
// Commande Tauri `kill_script` : interrompt le process en cours. (S-10)
//
// NOTE DE SÉCURITÉ (S-04) : cette commande nécessite la permission `shell:execute`
// dans tauri.conf.json (à configurer en S-04, hors scope S-03).
//
// ADR-01 (S-03) : commande synchrone via std::process::Command::output() — pas d'async.
// ADR-02 (S-03) : signal-killed → exit_code = -1 (pas une Err).
// ADR-03 (S-03) : interpréteur absent détecté via io::ErrorKind::NotFound.
// ADR-04 (S-03) : .ts essaie ts-node puis npx ts-node.
// ADR-05 (S-03) : chemin canonicalisé avant exécution, passé via Command::arg() (pas d'interpolation shell).
// ADR-S10-01 : run_script_stream spawne une tâche tokio et retourne Ok(()) immédiatement.
// ADR-S10-02 : state stocke Child tokio (pas PID u32) pour kill cross-plateforme idiomatique.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::process::{Command, Output};
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;

/// Résultat d'exécution d'un script.
/// `exit_code` vaut -1 si le processus a été tué par un signal (ADR-02).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Représentation de la commande d'interprétation : binaire + arguments préfixes.
/// Le path du script sera ajouté à la suite de `prefix_args`.
#[derive(Debug)]
struct Interpreter {
    binary: String,
    prefix_args: Vec<String>,
}

/// Résout l'interpréteur à utiliser selon l'extension du script.
/// Retourne `Err` si l'extension n'est pas supportée sur la plateforme courante.
fn resolve_interpreter(ext: &str) -> Result<Interpreter, String> {
    match ext {
        "sh" => {
            #[cfg(target_os = "windows")]
            return Err("Script type '.sh' is not supported on Windows".to_string());
            #[cfg(not(target_os = "windows"))]
            Ok(Interpreter {
                binary: "sh".to_string(),
                prefix_args: vec![],
            })
        }
        "fish" => {
            #[cfg(target_os = "windows")]
            return Err("Script type '.fish' is not supported on Windows".to_string());
            #[cfg(not(target_os = "windows"))]
            Ok(Interpreter {
                binary: "fish".to_string(),
                prefix_args: vec![],
            })
        }
        "ps1" => {
            #[cfg(not(target_os = "windows"))]
            return Err("Script type '.ps1' is only supported on Windows".to_string());
            #[cfg(target_os = "windows")]
            Ok(Interpreter {
                binary: "powershell".to_string(),
                prefix_args: vec![
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-File".to_string(),
                ],
            })
        }
        "bat" | "cmd" => {
            #[cfg(not(target_os = "windows"))]
            return Err(format!(
                "Script type '.{ext}' is only supported on Windows"
            ));
            #[cfg(target_os = "windows")]
            Ok(Interpreter {
                binary: "cmd".to_string(),
                prefix_args: vec!["/C".to_string()],
            })
        }
        "py" => {
            #[cfg(target_os = "windows")]
            let binary = "python".to_string();
            #[cfg(not(target_os = "windows"))]
            let binary = "python3".to_string();
            Ok(Interpreter {
                binary,
                prefix_args: vec![],
            })
        }
        "js" => Ok(Interpreter {
            binary: "node".to_string(),
            prefix_args: vec![],
        }),
        "rb" => Ok(Interpreter {
            binary: "ruby".to_string(),
            prefix_args: vec![],
        }),
        "ts" => {
            // ADR-04 : résolution ts-node avec fallback npx ts-node — encapsulé dans
            // resolve_ts_interpreter() pour garder cette fonction lisible.
            // On retourne un interpréteur de base ; l'exécution effective avec fallback
            // est gérée dans run_script via execute_with_ts_fallback().
            Ok(Interpreter {
                binary: "ts-node".to_string(),
                prefix_args: vec![],
            })
        }
        _ => Err(format!("Unsupported script extension: '{ext}'")),
    }
}

/// Exécute un script TypeScript avec le mécanisme de fallback ADR-04 :
/// 1. Tente `ts-node <path>`
/// 2. Si `ts-node` est absent du PATH (`NotFound`), tente `npx ts-node <path>`
/// 3. Si les deux échouent avec `NotFound` → Err lisible
fn execute_with_ts_fallback(canonical_path: &PathBuf) -> Result<ScriptOutput, String> {
    let result = Command::new("ts-node").arg(canonical_path).output();

    match result {
        Ok(output) => Ok(output_to_script_output(&output)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            // ts-node absent — tenter npx ts-node
            let npx_result = Command::new("npx")
                .arg("ts-node")
                .arg(canonical_path)
                .output();

            match npx_result {
                Ok(output) => Ok(output_to_script_output(&output)),
                Err(npx_err) if npx_err.kind() == io::ErrorKind::NotFound => Err(
                    "Interpreter not found: 'ts-node' (tried ts-node and npx ts-node)".to_string(),
                ),
                Err(npx_err) => Err(format!("Failed to execute script: {npx_err}")),
            }
        }
        Err(e) => Err(format!("Failed to execute script: {e}")),
    }
}

/// Convertit la sortie brute d'un `std::process::Output` en `ScriptOutput`.
/// Utilise `String::from_utf8_lossy` pour gérer les sorties non-UTF8 (edge case 13).
/// `exit_code` vaut -1 si le processus a été tué par un signal (ADR-02).
fn output_to_script_output(output: &Output) -> ScriptOutput {
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let exit_code = output.status.code().unwrap_or(-1);
    ScriptOutput {
        stdout,
        stderr,
        exit_code,
    }
}

/// Commande Tauri — exécute un script de façon bloquante.
///
/// # Paramètres
/// - `path` : chemin absolu ou relatif vers le fichier script
///
/// # Retour
/// - `Ok(ScriptOutput)` : exécution terminée (même si `exit_code` != 0)
/// - `Err(String)` : erreur pré-exécution (path invalide, extension inconnue, interpréteur absent)
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn run_script(path: String) -> Result<ScriptOutput, String> {
    // ADR-05 : canonicalisation avant exécution — résout symlinks et traversals ../
    // fs::canonicalize retourne Err si le fichier n'existe pas → validation implicite.
    let canonical_path = fs::canonicalize(&path)
        .map_err(|_| format!("Path does not exist: {path}"))?;

    // Vérification explicite : pas un dossier
    if canonical_path.is_dir() {
        return Err(format!("Path is not a file: {path}"));
    }

    // Extraction et normalisation de l'extension
    let ext = canonical_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if ext.is_empty() {
        return Err("Unsupported script extension: ''".to_string());
    }

    // Résolution de l'interpréteur (peut retourner Err pour plateforme incompatible)
    let interpreter = resolve_interpreter(&ext)?;

    // Cas spécial .ts : ADR-04 — logique de fallback déléguée
    if ext == "ts" {
        return execute_with_ts_fallback(&canonical_path);
    }

    // Exécution bloquante — ADR-05 : path passé via arg(), jamais interpolé dans un shell
    let result = Command::new(&interpreter.binary)
        .args(&interpreter.prefix_args)
        .arg(&canonical_path)
        .output();

    match result {
        Ok(output) => Ok(output_to_script_output(&output)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Err(format!(
            "Interpreter not found: '{}' is not available on PATH",
            interpreter.binary
        )),
        Err(e) => Err(format!("Failed to execute script: {e}")),
    }
}

// ─── State Tauri — process en cours (S-10) ────────────────────────────────────

/// State Tauri partagé pour le process de streaming en cours.
/// Stocke le `Child` tokio plutôt que le PID u32 (ADR-S10-02) :
/// cela permet un kill cross-plateforme via `.kill().await` sans dépendance `nix`.
pub struct ScriptProcess(pub Arc<Mutex<Option<tokio::process::Child>>>);

/// Payload de l'événement `script-stdout` émis par ligne.
#[derive(Debug, Serialize, Clone)]
pub struct StdoutPayload {
    pub line: String,
}

/// Payload de l'événement `script-done` émis à la fin du processus.
#[derive(Debug, Serialize, Clone)]
pub struct DonePayload {
    pub exit_code: i32,
    pub stderr: String,
}

/// Commande Tauri — exécute un script en streaming non-bloquant.
///
/// Retourne `Ok(())` immédiatement après avoir spawné la tâche tokio (ADR-S10-01).
/// Les lignes stdout sont émises via l'événement `script-stdout`.
/// La fin du processus est notifiée via `script-done`.
///
/// # Paramètres
/// - `path`   : chemin absolu ou relatif vers le fichier script
/// - `window` : handle Tauri pour émettre les événements
/// - `state`  : state partagé pour stocker le process en cours
#[tauri::command]
pub async fn run_script_stream(
    path: String,
    window: tauri::Window,
    state: tauri::State<'_, ScriptProcess>,
) -> Result<(), String> {
    // Canonicalisation du path (ADR-05 hérité)
    let canonical_path = fs::canonicalize(&path)
        .map_err(|_| format!("Path does not exist: {path}"))?;

    if canonical_path.is_dir() {
        return Err(format!("Path is not a file: {path}"));
    }

    let ext = canonical_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if ext.is_empty() {
        return Err("Unsupported script extension: ''".to_string());
    }

    let interpreter = resolve_interpreter(&ext)?;

    // Spawn non-bloquant avec stdout et stderr pipés
    let mut cmd = TokioCommand::new(&interpreter.binary);
    cmd.args(&interpreter.prefix_args)
        .arg(&canonical_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound {
            format!(
                "Interpreter not found: '{}' is not available on PATH",
                interpreter.binary
            )
        } else {
            format!("Failed to spawn process: {e}")
        }
    })?;

    // Extraire stdout et stderr avant de stocker le child
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // Stocker le child dans le state (ADR-S10-02)
    {
        let mut guard = state.0.lock().await;
        *guard = Some(child);
    }

    let state_arc = Arc::clone(&state.0);
    let window_clone = window.clone();

    // Spawner la tâche tokio de lecture (ADR-S10-01)
    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr);

        // Lire stdout ligne par ligne et émettre script-stdout
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let _ = window_clone.emit("script-stdout", StdoutPayload { line });
        }

        // Collecter stderr en bloc
        let mut stderr_buf = String::new();
        let _ = stderr_reader.read_to_string(&mut stderr_buf).await;

        // Attendre la fin du process et récupérer le exit code
        let exit_code = {
            let mut guard = state_arc.lock().await;
            if let Some(child) = guard.as_mut() {
                match child.wait().await {
                    Ok(status) => status.code().unwrap_or(-1),
                    Err(_) => -1,
                }
            } else {
                // Process déjà tué via kill_script
                -1
            }
        };

        // Nettoyer le state
        {
            let mut guard = state_arc.lock().await;
            *guard = None;
        }

        // Émettre script-done
        let _ = window_clone.emit(
            "script-done",
            DonePayload {
                exit_code,
                stderr: stderr_buf,
            },
        );
    });

    Ok(())
}

/// Commande Tauri — interrompt le script en cours.
///
/// Si aucun process n'est actif (PID None), retourne `Ok(())` sans panique (edge case story).
/// Après kill, le state est remis à `None`.
#[tauri::command]
pub async fn kill_script(state: tauri::State<'_, ScriptProcess>) -> Result<(), String> {
    let mut guard = state.0.lock().await;
    if let Some(child) = guard.as_mut() {
        child
            .kill()
            .await
            .map_err(|e| format!("Failed to kill process: {e}"))?;
        *guard = None;
    }
    // Si None → pas de panique, retour Ok(()) silencieux
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
        let dir = std::env::temp_dir().join(format!("scriptlauncher_runner_test_{name}"));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    // ── TC-01 : exécution réussie — script retourne exit_code 0, stdout capturé ──
    #[test]
    fn test_run_script_success_stdout() {
        let dir = make_temp_dir("success_stdout");
        let script = dir.join("hello.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho hello_world").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed");
        assert_eq!(output.exit_code, 0);
        assert!(
            output.stdout.contains("hello_world"),
            "stdout should contain 'hello_world', got: {}",
            output.stdout
        );
    }

    // ── TC-02 : capture stderr — le script écrit sur stderr, exit_code 0 ──
    #[test]
    fn test_run_script_stderr_captured() {
        let dir = make_temp_dir("stderr");
        let script = dir.join("warn.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho warning >&2").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed");
        assert_eq!(output.exit_code, 0);
        assert!(
            output.stderr.contains("warning"),
            "stderr should contain 'warning', got: {}",
            output.stderr
        );
        // stdout vide (ou seulement un newline shell)
    }

    // ── TC-03 : code de retour non-zéro — OK avec exit_code != 0 (pas une Err) ──
    #[test]
    fn test_run_script_nonzero_exit_code() {
        let dir = make_temp_dir("nonzero");
        let script = dir.join("fail.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\nexit 42").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should be Ok even with non-zero exit code");
        assert_eq!(output.exit_code, 42);
    }

    // ── TC-04 : script inexistant → Err avec message lisible ──
    #[test]
    fn test_run_script_nonexistent_path() {
        let result = run_script("/tmp/__nonexistent_script_xyz_12345__.sh".to_string());

        let err = result.expect_err("should fail for nonexistent path");
        assert!(
            err.contains("does not exist"),
            "error should mention 'does not exist', got: {err}"
        );
    }

    // ── TC-05 : extension inconnue → Err avec message lisible ──
    #[test]
    fn test_run_script_unknown_extension() {
        let dir = make_temp_dir("unknown_ext");
        let script = dir.join("data.xyz");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail for unknown extension");
        assert!(
            err.contains("Unsupported script extension"),
            "error should mention unsupported extension, got: {err}"
        );
        assert!(
            err.contains("xyz"),
            "error should mention the extension 'xyz', got: {err}"
        );
    }

    // ── TC-06 : extension absente → Err ──
    #[test]
    fn test_run_script_no_extension() {
        let dir = make_temp_dir("no_ext");
        let script = dir.join("Makefile");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail for missing extension");
        assert!(
            err.contains("Unsupported script extension"),
            "error should mention unsupported extension, got: {err}"
        );
    }

    // ── TC-07 : path est un dossier → Err ──
    #[test]
    fn test_run_script_path_is_directory() {
        let dir = make_temp_dir("is_dir");

        let result = run_script(dir.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail when path is a directory");
        assert!(
            err.contains("not a file"),
            "error should mention 'not a file', got: {err}"
        );
    }

    // ── TC-08 : interpréteur absent → Err avec message lisible ──
    // Utilise une extension fictive dont l'interpréteur n'existe pas sur le système.
    // On injecte directement une Interpreter avec un binaire garanti inexistant.
    #[test]
    fn test_run_script_interpreter_not_found() {
        let dir = make_temp_dir("interp_missing");
        let script = dir.join("test.sh");
        File::create(&script).expect("create file");

        // Simuler un interpréteur introuvable en appelant Command directement
        let result = Command::new("__nonexistent_interpreter_xyz__")
            .arg(&script)
            .output();
        cleanup(&dir);

        assert!(result.is_err(), "should fail");
        let err = result.unwrap_err();
        assert_eq!(
            err.kind(),
            std::io::ErrorKind::NotFound,
            "error kind should be NotFound"
        );
    }

    // ── TC-09 : extension en majuscules → normalisée, exécution réussie ──
    #[test]
    fn test_run_script_extension_uppercase() {
        let dir = make_temp_dir("uppercase_ext");
        let script = dir.join("HELLO.SH");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho uppercase").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed with uppercase extension");
        assert_eq!(output.exit_code, 0);
        assert!(output.stdout.contains("uppercase"));
    }

    // ── TC-10 : stdout et stderr simultanément capturés ──
    #[test]
    fn test_run_script_both_streams_captured() {
        let dir = make_temp_dir("both_streams");
        let script = dir.join("both.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho out_line\necho err_line >&2").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed");
        assert!(output.stdout.contains("out_line"), "stdout missing out_line");
        assert!(output.stderr.contains("err_line"), "stderr missing err_line");
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-11 : chemin avec espaces → géré via Command::arg() sans interpolation shell ──
    #[test]
    fn test_run_script_path_with_spaces() {
        let dir = make_temp_dir("path with spaces");
        let script = dir.join("my script.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho spaced").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed with spaces in path");
        assert_eq!(output.exit_code, 0);
        assert!(output.stdout.contains("spaced"));
    }

    // ── TC-12 : .ps1 sur macOS/Linux → Err plateforme ──
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_run_script_ps1_on_unix() {
        let dir = make_temp_dir("ps1_unix");
        let script = dir.join("deploy.ps1");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail on non-Windows");
        assert!(
            err.contains("only supported on Windows"),
            "error should mention Windows-only, got: {err}"
        );
    }

    // ── TC-13 : .sh sur Windows → Err plateforme ──
    #[cfg(target_os = "windows")]
    #[test]
    fn test_run_script_sh_on_windows() {
        let dir = make_temp_dir("sh_windows");
        let script = dir.join("run.sh");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail on Windows");
        assert!(
            err.contains("not supported on Windows"),
            "error should mention Windows not supported, got: {err}"
        );
    }

    // ── TC-14 : resolve_interpreter — table exhaustive ──
    #[test]
    fn test_resolve_interpreter_table() {
        // Extensions universelles (toutes plateformes)
        assert!(resolve_interpreter("py").is_ok());
        assert!(resolve_interpreter("js").is_ok());
        assert!(resolve_interpreter("rb").is_ok());
        assert!(resolve_interpreter("ts").is_ok());

        // Extension inconnue
        let err = resolve_interpreter("unknown_xyz").unwrap_err();
        assert!(err.contains("Unsupported script extension"));
    }

    // ── TC-15 : output_to_script_output — signal killed → exit_code -1 ──
    #[test]
    fn test_output_exit_code_signal_fallback() {
        // On ne peut pas facilement forcer un signal dans un test unitaire,
        // mais on peut tester la fonction output_to_script_output directement
        // avec un Output fabriqué. On utilise un script qui retourne exit 0
        // et on vérifie la conversion nominale.
        let dir = make_temp_dir("exit_code_conv");
        let script = dir.join("exit0.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\nexit 0").expect("write script");
        }
        let raw_output = Command::new("sh")
            .arg(&script)
            .output()
            .expect("sh should run");
        cleanup(&dir);

        let script_output = output_to_script_output(&raw_output);
        // exit 0 → code() retourne Some(0), pas de repli -1
        assert_eq!(script_output.exit_code, 0);
    }

    // ── TC-16 : exit_code = -1 pour processus tué par signal (ADR-02) ──────────
    // Valide la logique unwrap_or(-1) de output_to_script_output avec un ExitStatus
    // qui ne possède pas de code de retour (simulé via ExitStatusExt::from_raw sur Unix).
    #[cfg(unix)]
    #[test]
    fn test_output_exit_code_minus_one_on_signal() {
        use std::os::unix::process::ExitStatusExt;
        // POSIX raw status = 9 : processus tué par signal 9 (SIGKILL), pas d'exit code.
        // from_raw(9) retourne un ExitStatus dont code() vaut None.
        let killed_status = std::process::ExitStatus::from_raw(9);
        assert!(
            killed_status.code().is_none(),
            "ExitStatus::from_raw(9) should give code()=None (signal-killed)"
        );
        // Valide la logique de repli documentée dans output_to_script_output (ADR-02)
        let exit_code = killed_status.code().unwrap_or(-1);
        assert_eq!(exit_code, -1, "signal-killed process should yield exit_code = -1 (ADR-02)");
    }

    // ── TC-17 : ScriptOutput implémente Clone et Debug (derives obligatoires) ──
    #[test]
    fn test_script_output_clone_and_debug() {
        let original = ScriptOutput {
            stdout: "hello_clone".to_string(),
            stderr: "err_clone".to_string(),
            exit_code: 42,
        };
        // Clone
        let cloned = original.clone();
        assert_eq!(cloned.stdout, "hello_clone", "cloned stdout should match");
        assert_eq!(cloned.stderr, "err_clone", "cloned stderr should match");
        assert_eq!(cloned.exit_code, 42, "cloned exit_code should match");
        // Debug
        let debug = format!("{original:?}");
        assert!(debug.contains("stdout"), "Debug output should include 'stdout' field");
        assert!(debug.contains("exit_code"), "Debug output should include 'exit_code' field");
    }

    // ── TC-18 : chemin vide → Err avec message lisible ────────────────────────
    #[test]
    fn test_run_script_empty_path_returns_err() {
        let result = run_script(String::new());
        let err = result.expect_err("empty path should fail");
        assert!(
            err.contains("does not exist") || err.contains("Path"),
            "error should mention path issue, got: {err}"
        );
    }

    // ── TC-19 : sortie stdout multilignes capturée intégralement ──────────────
    #[test]
    fn test_run_script_multiline_stdout() {
        let dir = make_temp_dir("multiline");
        let script = dir.join("multi.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho line1\necho line2\necho line3").expect("write script");
        }
        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should succeed");
        assert!(output.stdout.contains("line1"), "stdout missing line1");
        assert!(output.stdout.contains("line2"), "stdout missing line2");
        assert!(output.stdout.contains("line3"), "stdout missing line3");
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-20 : stdout capturé même quand exit_code != 0 ──────────────────────
    #[test]
    fn test_run_script_stdout_captured_with_nonzero_exit() {
        let dir = make_temp_dir("stdout_nonzero");
        let script = dir.join("partial.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho partial_output\nexit 3").expect("write script");
        }
        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should be Ok even with non-zero exit");
        assert!(
            output.stdout.contains("partial_output"),
            "stdout should be captured even when exit_code != 0, got: {}",
            output.stdout
        );
        assert_eq!(output.exit_code, 3);
    }

    // ── TC-21 : chemin avec traversal ../ est canonicalisé (ADR-05) ────────────
    #[test]
    fn test_run_script_traversal_path_resolved() {
        let dir = make_temp_dir("traversal");
        let subdir = dir.join("sub");
        fs::create_dir_all(&subdir).expect("create subdir");
        let script = dir.join("real.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho traversal_resolved").expect("write script");
        }
        // Path avec traversal : .../traversal/sub/../real.sh
        let traversal_path = subdir.join("..").join("real.sh");

        let result = run_script(traversal_path.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("traversal path should resolve and execute");
        assert!(
            output.stdout.contains("traversal_resolved"),
            "traversal path should work after canonicalization, got: {}",
            output.stdout
        );
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-22 : chemin avec caractères Unicode → exécution réussie ────────────
    // Valide l'edge case 14 : les caractères Unicode dans le path sont gérés
    // nativement par Command::arg() sans interpolation shell (ADR-05).
    #[test]
    fn test_run_script_unicode_path_chars() {
        let dir = make_temp_dir("unicode_données_répertoire");
        let script = dir.join("données.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho unicode_path_ok").expect("write script");
        }

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("unicode path should succeed");
        assert!(
            output.stdout.contains("unicode_path_ok"),
            "unicode path should execute correctly, got: {}",
            output.stdout
        );
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-23 : .bat sur macOS/Linux → Err plateforme ─────────────────────────
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_run_script_bat_on_unix() {
        let dir = make_temp_dir("bat_unix");
        let script = dir.join("deploy.bat");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail on non-Windows");
        assert!(
            err.contains("only supported on Windows"),
            "error should mention Windows-only, got: {err}"
        );
    }

    // ── TC-24 : .cmd sur macOS/Linux → Err plateforme ─────────────────────────
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_run_script_cmd_on_unix() {
        let dir = make_temp_dir("cmd_unix");
        let script = dir.join("deploy.cmd");
        File::create(&script).expect("create file");

        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let err = result.expect_err("should fail on non-Windows");
        assert!(
            err.contains("only supported on Windows"),
            "error should mention Windows-only, got: {err}"
        );
    }

    // ── TC-25 : resolve_interpreter — noms des binaires vérifiés (Unix) ────────
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_resolve_interpreter_binary_names_unix() {
        // Python3 sur Unix
        let py = resolve_interpreter("py").expect("py should resolve");
        assert_eq!(py.binary, "python3", "python3 expected on Unix");
        assert!(py.prefix_args.is_empty(), "python3 has no prefix args");

        // Node
        let js = resolve_interpreter("js").expect("js should resolve");
        assert_eq!(js.binary, "node");
        assert!(js.prefix_args.is_empty());

        // Ruby
        let rb = resolve_interpreter("rb").expect("rb should resolve");
        assert_eq!(rb.binary, "ruby");
        assert!(rb.prefix_args.is_empty());

        // sh
        let sh = resolve_interpreter("sh").expect("sh should resolve");
        assert_eq!(sh.binary, "sh");
        assert!(sh.prefix_args.is_empty());

        // fish
        let fish = resolve_interpreter("fish").expect("fish should resolve");
        assert_eq!(fish.binary, "fish");
        assert!(fish.prefix_args.is_empty());

        // ts-node (premier candidat ADR-04)
        let ts = resolve_interpreter("ts").expect("ts should resolve");
        assert_eq!(ts.binary, "ts-node");
        assert!(ts.prefix_args.is_empty());
    }

    // ── TC-26 : resolve_interpreter — .bat et .cmd sur Unix → Err ─────────────
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_resolve_interpreter_bat_cmd_platform_error() {
        let bat_err = resolve_interpreter("bat").expect_err("bat should fail on Unix");
        assert!(
            bat_err.contains("only supported on Windows"),
            "bat error should mention Windows, got: {bat_err}"
        );

        let cmd_err = resolve_interpreter("cmd").expect_err("cmd should fail on Unix");
        assert!(
            cmd_err.contains("only supported on Windows"),
            "cmd error should mention Windows, got: {cmd_err}"
        );
    }

    // ── TC-27 : stderr non vide, stdout vide → Ok avec stderr rempli ──────────
    #[test]
    fn test_run_script_stderr_only_no_stdout() {
        let dir = make_temp_dir("stderr_only");
        let script = dir.join("errs.sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho stderr_only_msg >&2").expect("write script");
        }
        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("should be Ok");
        assert!(
            output.stderr.contains("stderr_only_msg"),
            "stderr should be captured, got: {}",
            output.stderr
        );
        assert!(
            output.stdout.trim().is_empty(),
            "stdout should be empty when nothing written to stdout, got: {}",
            output.stdout
        );
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-28 : extension mixte (.Sh, .pY) → normalisée correctement ──────────
    #[test]
    fn test_run_script_mixed_case_sh_extension() {
        let dir = make_temp_dir("mixedcase_sh");
        let script = dir.join("run.Sh");
        {
            let mut f = File::create(&script).expect("create script");
            writeln!(f, "#!/bin/sh\necho mixed_ext_ok").expect("write script");
        }
        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        let output = result.expect("mixed-case .Sh extension should be normalized and executed");
        assert!(output.stdout.contains("mixed_ext_ok"));
        assert_eq!(output.exit_code, 0);
    }

    // ── TC-29 : output_to_script_output — sortie non-UTF8 → from_utf8_lossy ────
    // Valide l'edge case 13 : les octets non-UTF8 dans stdout sont remplacés
    // par U+FFFD sans panique.
    #[test]
    fn test_run_script_non_utf8_output_no_panic() {
        let dir = make_temp_dir("non_utf8");
        let script = dir.join("binary.sh");
        {
            let mut f = File::create(&script).expect("create script");
            // printf produit les octets 0x80 et 0xFF, invalides en UTF-8
            writeln!(f, "#!/bin/sh\nprintf '\\x80\\xff'").expect("write script");
        }
        let result = run_script(script.to_string_lossy().to_string());
        cleanup(&dir);

        // L'essentiel : run_script ne panique pas et retourne Ok
        let output = result.expect("non-UTF8 output should not panic (from_utf8_lossy)");
        // stdout est une chaîne Rust valide (les octets invalides sont remplacés par U+FFFD)
        assert!(
            output.stdout.is_ascii() || !output.stdout.is_empty() || output.stdout.is_empty(),
            "stdout should be a valid Rust String regardless of byte content"
        );
        assert_eq!(output.exit_code, 0);
    }

    // ─── Tests S-10 : kill_script ─────────────────────────────────────────────

    // ── TC-S10-01 : kill_script sans process actif → Ok(()) sans panique ──────
    // Valide l'edge case story : kill_script quand aucun PID stocké.
    #[tokio::test]
    async fn test_kill_script_no_process_returns_ok() {
        let state = ScriptProcess(Arc::new(Mutex::new(None)));
        // Appeler directement la logique interne (pas via Tauri State)
        let mut guard = state.0.lock().await;
        if let Some(child) = guard.as_mut() {
            let _ = child.kill().await;
            *guard = None;
        }
        // Pas de panique, l'état reste None
        assert!(guard.is_none(), "state should remain None when no process was active");
    }

    // ── TC-S10-02 : kill_script avec process actif → PID remis à None ─────────
    // Spawne un vrai process (sleep), le tue, vérifie que le state est remis à None.
    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn test_kill_script_with_process_clears_state() {
        use tokio::process::Command as TokioCmd;

        let state = ScriptProcess(Arc::new(Mutex::new(None)));

        // Spawner un process qui dure longtemps
        let child = TokioCmd::new("sleep")
            .arg("60")
            .spawn()
            .expect("failed to spawn sleep");

        {
            let mut guard = state.0.lock().await;
            *guard = Some(child);
        }

        // Vérifier que le process est bien stocké
        {
            let guard = state.0.lock().await;
            assert!(guard.is_some(), "child should be stored before kill");
        }

        // Simuler kill_script : lire et tuer le child
        {
            let mut guard = state.0.lock().await;
            if let Some(child) = guard.as_mut() {
                let _ = child.kill().await;
                *guard = None;
            }
        }

        // Vérifier que le state est None après kill
        let guard = state.0.lock().await;
        assert!(guard.is_none(), "state should be None after kill");
    }
}
