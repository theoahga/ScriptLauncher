import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ScriptInfo, HistoryEntry } from "../types";
import "./ScriptExecutor.css";

interface ScriptExecutorProps {
  /** UUID de l'onglet — aussi utilisé comme execution_id côté backend */
  executionId: string;
  script: ScriptInfo | null;
  /** Appelé après chaque exécution terminée pour signaler à App.tsx de recharger l'historique */
  onExecutionComplete?: () => void;
}

// Payloads des événements Tauri (S-10)
interface StdoutPayload {
  execution_id: string;
  line: string;
}

interface DonePayload {
  execution_id: string;
  exit_code: number;
  stderr: string;
}

export default function ScriptExecutor({
  executionId,
  script,
  onExecutionComplete,
}: ScriptExecutorProps): JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [stderrOutput, setStderrOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [argsInput, setArgsInput] = useState("");
  const [stdinValue, setStdinValue] = useState("");
  const syncIsRunning = (v: boolean) => { isRunningRef.current = v; setIsRunning(v); };

  // Ref sur le conteneur terminal (div) pour l'auto-scroll
  const terminalRef = useRef<HTMLDivElement>(null);

  // ADR-01 (S-07) : reset des états quand le script sélectionné change
  // ADR-06 (S-07) : ref pour annuler les invocations obsolètes
  const cancelledRef = useRef(false);
  const isRunningRef = useRef(false);

  // S-11 : timestamp de début pour calculer duration_ms
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    cancelledRef.current = false;
    setLines([]);
    setExitCode(null);
    setStderrOutput("");
    setError(null);
    setStdinValue("");
    syncIsRunning(false);

    return () => {
      cancelledRef.current = true;
    };
  }, [script]);

  // Auto-scroll : descend en bas quand une nouvelle ligne arrive ou quand le run démarre
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, isRunning]);

  // ADR-03 : listeners Tauri avec cleanup dans useEffect
  const unlistenStdoutRef = useRef<(() => void) | undefined>(undefined);
  const unlistenDoneRef = useRef<(() => void) | undefined>(undefined);

  // Ref pour capturer la liste de lignes dans le handler script-done (évite closure stale)
  const linesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isRunning) return;

    const setupListeners = async () => {
      unlistenStdoutRef.current = await listen<StdoutPayload>(
        "script-stdout",
        (event) => {
          if (event.payload.execution_id !== executionId) return;
          setLines((prev) => {
            const updated = [...prev, event.payload.line];
            linesRef.current = updated;
            return updated;
          });
        },
      );

      unlistenDoneRef.current = await listen<DonePayload>(
        "script-done",
        (event) => {
          if (event.payload.execution_id !== executionId) return;
          const { exit_code, stderr } = event.payload;
          setExitCode(exit_code);
          setStderrOutput(stderr);
          syncIsRunning(false);
          unlistenStdoutRef.current?.();
          unlistenDoneRef.current?.();

          // S-11 : persister l'exécution dans l'historique (ADR-S11-04)
          if (script !== null && !cancelledRef.current) {
            const duration_ms = Date.now() - startTimeRef.current;
            const entry: HistoryEntry = {
              id: crypto.randomUUID(),
              script_name: script.name,
              script_path: script.path,
              started_at: new Date(startTimeRef.current).toISOString(),
              duration_ms,
              exit_code,
              stdout: linesRef.current.join("\n"),
              stderr,
            };

            invoke<void>("append_history", { entry }).catch((err) => {
              console.error("[ScriptExecutor] append_history failed:", err);
            });

            onExecutionComplete?.();
          }
        },
      );
    };

    setupListeners().catch((err) => {
      if (!cancelledRef.current) {
        setError(String(err));
        syncIsRunning(false);
      }
    });

    return () => {
      unlistenStdoutRef.current?.();
      unlistenDoneRef.current?.();
    };
  }, [isRunning, script, executionId, onExecutionComplete]);

  const handleRun = useCallback(async () => {
    if (script === null) return;

    // Tuer le process précédent avant de démarrer (évite la race condition)
    if (isRunningRef.current) {
      await invoke<void>("kill_script", { executionId }).catch(() => {});
    }

    cancelledRef.current = false;
    setLines([]);
    linesRef.current = [];
    setExitCode(null);
    setStderrOutput("");
    setError(null);
    setStdinValue("");
    startTimeRef.current = Date.now();
    syncIsRunning(true);

    try {
      await invoke<void>("run_script_stream", { executionId, path: script.path, args: argsInput });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(String(err));
        syncIsRunning(false);
      }
    }
  }, [script, executionId, argsInput]);

  const handleStop = useCallback(async () => {
    try {
      await invoke<void>("kill_script", { executionId });
    } catch (err) {
      setError(String(err));
    }
  }, [executionId]);

  const handleCtrlC = useCallback(async () => {
    try {
      await invoke<void>("send_ctrl_c", { executionId });
    } catch {
      // SIGINT non supporté sur cette plateforme, ignoré
    }
  }, [executionId]);

  const handleSendStdin = useCallback(async () => {
    if (!stdinValue) return;
    try {
      await invoke<void>("write_stdin", { executionId, data: stdinValue + "\n" });
      setStdinValue("");
    } catch (err) {
      setError(String(err));
    }
  }, [executionId, stdinValue]);

  const handleStdinKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendStdin();
      } else if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        handleCtrlC();
      }
    },
    [handleSendStdin, handleCtrlC],
  );

  if (script === null) {
    return (
      <div className="script-executor">
        <p className="script-executor__empty">Aucun script sélectionné</p>
      </div>
    );
  }

  const showTerminal = lines.length > 0 || exitCode !== null || isRunning;

  return (
    <div className="script-executor">
      <div className="script-executor__header">
        <span className="script-executor__script-name">{script.name}</span>
        <div className="script-executor__actions">
          <button
            type="button"
            className="script-executor__run-btn"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? "En cours..." : "Exécuter"}
          </button>
          {isRunning && (
            <>
              <button
                type="button"
                className="script-executor__ctrl-c"
                onClick={handleCtrlC}
                title="Envoyer SIGINT — ou Ctrl+C dans le terminal"
              >
                ^C
              </button>
              <button
                type="button"
                className="script-executor__stop-btn"
                onClick={handleStop}
                title="Forcer l'arrêt (SIGKILL)"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      <div className="script-executor__args-row">
        <span className="script-executor__args-label">Args</span>
        <input
          type="text"
          className="script-executor__args-input"
          placeholder='--flag value "arg with spaces"'
          value={argsInput}
          onChange={(e) => setArgsInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !isRunning) handleRun(); }}
          disabled={isRunning}
        />
      </div>

      {error !== null && (
        <p className="script-executor__error">{error}</p>
      )}

      {showTerminal && (
        <div className="script-executor__output">
          {exitCode !== null && (
            <span
              className={
                exitCode === 0
                  ? "script-executor__status script-executor__status--success"
                  : "script-executor__status script-executor__status--error"
              }
            >
              {exitCode === 0 ? "Succès" : `Erreur (code : ${exitCode})`}
            </span>
          )}

          <div className="script-executor__section" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <span className="script-executor__section-label">Sortie standard</span>
            <div ref={terminalRef} className="script-executor__terminal">
              <pre className="script-executor__stdout">
                {lines.join("\n")}
              </pre>
              {isRunning && (
                <div className="script-executor__stdin-row">
                  <span className="script-executor__stdin-prompt">›</span>
                  <input
                    type="text"
                    className="script-executor__stdin-input"
                    value={stdinValue}
                    onChange={(e) => setStdinValue(e.target.value)}
                    onKeyDown={handleStdinKeyDown}
                    placeholder="Entrée pour envoyer, Ctrl+C pour interrompre"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {stderrOutput.trim() !== "" && (
            <div className="script-executor__section">
              <span className="script-executor__section-label">Erreur standard</span>
              <pre className="script-executor__stderr">{stderrOutput}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
