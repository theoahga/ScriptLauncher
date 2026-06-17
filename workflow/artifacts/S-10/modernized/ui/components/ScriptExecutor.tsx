import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ScriptInfo } from "../types";
import "./ScriptExecutor.css";

interface ScriptExecutorProps {
  script: ScriptInfo | null;
}

// Payloads des événements Tauri (S-10)
interface StdoutPayload {
  line: string;
}

interface DonePayload {
  exit_code: number;
  stderr: string;
}

export default function ScriptExecutor({
  script,
}: ScriptExecutorProps): JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [stderrOutput, setStderrOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // ADR-04 : auto-scroll via ref sur le <pre>
  const outputRef = useRef<HTMLPreElement>(null);

  // ADR-01 (S-07) : reset des états quand le script sélectionné change
  // ADR-06 (S-07) : ref pour annuler les invocations obsolètes
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setLines([]);
    setExitCode(null);
    setStderrOutput("");
    setError(null);
    setIsRunning(false);

    return () => {
      cancelledRef.current = true;
    };
  }, [script]);

  // ADR-04 : auto-scroll à chaque nouvelle ligne
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // ADR-03 : listeners Tauri avec cleanup dans useEffect
  // Les unlisten sont stockés dans refs pour être accessibles dans le handler script-done
  // et dans le cleanup useEffect sans capture de closure stale.
  const unlistenStdoutRef = useRef<(() => void) | undefined>(undefined);
  const unlistenDoneRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) return;

    const setupListeners = async () => {
      unlistenStdoutRef.current = await listen<StdoutPayload>(
        "script-stdout",
        (event) => {
          setLines((prev) => [...prev, event.payload.line]);
        },
      );

      unlistenDoneRef.current = await listen<DonePayload>(
        "script-done",
        (event) => {
          setExitCode(event.payload.exit_code);
          setStderrOutput(event.payload.stderr);
          setIsRunning(false);
          unlistenStdoutRef.current?.();
          unlistenDoneRef.current?.();
        },
      );
    };

    setupListeners().catch((err) => {
      if (!cancelledRef.current) {
        setError(String(err));
        setIsRunning(false);
      }
    });

    return () => {
      unlistenStdoutRef.current?.();
      unlistenDoneRef.current?.();
    };
  }, [isRunning]);

  const handleRun = useCallback(async () => {
    if (script === null) return;

    cancelledRef.current = false;
    // ADR-05 : vider la zone output à chaque nouveau run
    setLines([]);
    setExitCode(null);
    setStderrOutput("");
    setError(null);
    setIsRunning(true);

    try {
      await invoke<void>("run_script_stream", { path: script.path });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(String(err));
        setIsRunning(false);
      }
    }
  }, [script]);

  const handleStop = useCallback(async () => {
    try {
      await invoke<void>("kill_script");
    } catch (err) {
      setError(String(err));
    }
  }, []);

  if (script === null) {
    return (
      <div className="script-executor">
        <p className="script-executor__empty">Aucun script sélectionné</p>
      </div>
    );
  }

  const hasOutput = lines.length > 0 || exitCode !== null;

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
            <button
              type="button"
              className="script-executor__stop-btn"
              onClick={handleStop}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {error !== null && (
        <p className="script-executor__error">{error}</p>
      )}

      {hasOutput && (
        <div className="script-executor__output">
          {exitCode !== null && (
            <span
              className={
                exitCode === 0
                  ? "script-executor__status script-executor__status--success"
                  : "script-executor__status script-executor__status--error"
              }
            >
              {exitCode === 0
                ? "Succès"
                : `Erreur (code : ${exitCode})`}
            </span>
          )}

          <div className="script-executor__section">
            <span className="script-executor__section-label">
              Sortie standard
            </span>
            <pre
              ref={outputRef}
              className="script-executor__stdout"
            >
              {lines.length > 0 ? lines.join("\n") : isRunning ? "" : "(vide)"}
            </pre>
          </div>

          {stderrOutput.trim() !== "" && (
            <div className="script-executor__section">
              <span className="script-executor__section-label">
                Erreur standard
              </span>
              <pre className="script-executor__stderr">{stderrOutput}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
